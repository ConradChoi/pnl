-- P&L SaaS 초기 스키마 (PRD.md / SERVICE_SPEC.md 1차 범위 기준)
-- 실행 순서: Supabase 프로젝트 생성 후 이 파일을 migration으로 적용
-- 2026-08-17 개정: SECURITY_REVIEW.md 치명적 1,2 / 주요 3 / 권고 7 반영
--   (치명적1) memberships UPDATE에 WITH CHECK 추가 — 권한 자기 격상 차단
--   (치명적2) projects/transactions RLS에 role 기반 하한선 직접 반영 (role_permissions 커스텀 매트릭스 포함)
--   (주요3)  삭제 요청 본인 승인 방지
--   (권고7)  최소 1 오너 유지 트리거
-- 2026-08-17 추가: platform_admins / platform_settings — 사업자정보·고객센터·DPO·탈퇴정책을
--   배포 없이 백오피스에서 수정 가능하도록 (PRIVACY_POLICY_DRAFT.md 4~6절 동적 소스)

-- ============================================================
-- 0. 확장
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- 1. companies / profiles
-- ============================================================
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- auth.users 확장 (Supabase 컨벤션)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 2. teams / memberships / invitations
-- ============================================================
create table teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','team_lead','member')),
  team_id uuid references teams(id) on delete set null,
  is_representative boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PRD 2절: 이메일(유저) 1개는 활성 멤버십 1개만 — 회사 간 소속 유일성
create unique index memberships_one_active_per_user
  on memberships (user_id)
  where status = 'active';

-- PRD 5.2: 대표계정은 회사당 1명
create unique index memberships_one_representative_per_company
  on memberships (company_id)
  where is_representative = true and status = 'active';

create index memberships_company_idx on memberships (company_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','team_lead','member')), -- 오너는 초대 대상 아님(회사 생성 시 자동 부여)
  team_id uuid references teams(id) on delete set null,
  invited_by uuid not null references auth.users(id),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','canceled','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create unique index invitations_token_idx on invitations (token);
create index invitations_company_email_idx on invitations (company_id, email);

-- ============================================================
-- 3. role_permissions (커스텀 권한 매트릭스)
-- ============================================================
-- 회사별 role 단위 오버라이드. jsonb로 저장 — has_permission() 함수가
-- 행이 없으면 default_permissions()의 하드코딩 기본값으로 폴백한다.
-- 오너 role은 오버라이드 대상에서 제외(check 제약으로 원천 차단, 항상 전권).
create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  role text not null check (role in ('admin','team_lead','member')),
  permissions jsonb not null,
  updated_at timestamptz not null default now(),
  unique (company_id, role)
);

-- ============================================================
-- 4. projects / transactions
-- ============================================================
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  status text not null default '진행중' check (status in ('진행중','진행완료','진행예정')),
  field text,
  start_date date,
  end_date date,
  owner_name text,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_company_idx on projects (company_id);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  tx_date date not null,
  category text not null,
  kind text not null check (kind in ('수익','비용')),
  item_name text,
  amount numeric(14,2) not null check (amount <> 0),
  currency text not null default 'KRW',
  note text,
  source text not null default 'manual' check (source in ('manual','excel_upload')),
  upload_batch_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_company_idx on transactions (company_id);
create index transactions_project_idx on transactions (project_id);
create index transactions_dup_check_idx
  on transactions (company_id, project_id, tx_date, category, amount, item_name);

-- ============================================================
-- 5. upload_batches (엑셀 업로드 이력)
-- ============================================================
-- SECURITY_REVIEW.md 주요4: 파일 크기/행수 상한, 파싱 타임아웃, SheetJS 버전 고정은
-- DB 제약이 아니라 Server Action(commitExcelUpload) 레벨에서 강제한다 (비즈니스 조정 가능해야 하므로).
create table upload_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  file_name text not null,
  total_rows int not null default 0,
  saved_rows int not null default 0,
  excluded_rows int not null default 0,
  error_rows int not null default 0,
  created_at timestamptz not null default now()
);

alter table transactions
  add constraint transactions_upload_batch_fk
  foreign key (upload_batch_id) references upload_batches(id) on delete set null;

-- ============================================================
-- 6. deletion_requests (팀원 삭제 승인 워크플로우)
-- ============================================================
create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references auth.users(id),
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (num_nonnulls(project_id, transaction_id) = 1)
);

-- 동일 대상에 대해 동시에 대기중 요청은 1건만
create unique index deletion_requests_one_pending_per_project
  on deletion_requests (project_id) where status = 'pending' and project_id is not null;
create unique index deletion_requests_one_pending_per_transaction
  on deletion_requests (transaction_id) where status = 'pending' and transaction_id is not null;

-- ============================================================
-- 7. 헬퍼 함수 (RLS/RPC 공용)
-- ============================================================
create function my_membership()
returns memberships
language sql stable
security definer
set search_path = public
as $$
  select * from memberships where user_id = auth.uid() and status = 'active' limit 1;
$$;

create function my_company_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select company_id from memberships where user_id = auth.uid() and status = 'active' limit 1;
$$;

create function my_role()
returns text
language sql stable
security definer
set search_path = public
as $$
  select role from memberships where user_id = auth.uid() and status = 'active' limit 1;
$$;

create function my_team_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select team_id from memberships where user_id = auth.uid() and status = 'active' limit 1;
$$;

-- role 서열 (초대 시 "본인보다 낮은 role만 초대 가능" 서버측 재검증용, SERVICE_SPEC 2.2)
create function role_rank(p_role text)
returns int
language sql
immutable
as $$
  select case p_role
    when 'owner' then 4
    when 'admin' then 3
    when 'team_lead' then 2
    when 'member' then 1
    else 0
  end;
$$;

-- role_permissions 미설정 시 폴백 기본값 (BACKEND_DESIGN.md 3절 표와 동일 — 가정치, 확인 필요)
create function default_permissions(p_role text)
returns jsonb
language sql
immutable
as $$
  select case p_role
    when 'admin' then
      '{"project_create":true,"project_update":true,"project_delete":true,
        "transaction_create":true,"transaction_update":true,"transaction_delete":true,
        "excel_upload":true,"invite_member":true,"company_settings":true}'::jsonb
    when 'team_lead' then
      '{"project_create":true,"project_update":true,"project_delete":true,
        "transaction_create":true,"transaction_update":true,"transaction_delete":true,
        "excel_upload":true,"invite_member":true,"company_settings":false}'::jsonb
    when 'member' then
      '{"project_create":false,"project_update":false,"project_delete":false,
        "transaction_create":true,"transaction_update":true,"transaction_delete":false,
        "excel_upload":true,"invite_member":false,"company_settings":false}'::jsonb
    else '{}'::jsonb
  end;
$$;

-- 실제 권한 판정. owner는 항상 true. admin/team_lead/member는 role_permissions
-- 커스텀 오버라이드(없으면 default_permissions)를 조회하고, team_lead/member는
-- target_team_id가 본인 소속 팀과 같을 때만 허용(팀 범위 스코핑).
create function has_permission(perm_key text, target_team_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r text := my_role();
  perms jsonb;
  allowed boolean;
begin
  if r is null then
    return false;
  end if;

  if r = 'owner' then
    return true;
  end if;

  select permissions into perms from role_permissions
    where company_id = my_company_id() and role = r;

  if perms is null then
    perms := default_permissions(r);
  end if;

  allowed := coalesce((perms ->> perm_key)::boolean, false);
  if not allowed then
    return false;
  end if;

  -- QA 중 발견: "and target_team_id is not null" 조건 때문에 팀 대표/팀원이
  -- team_id 없는(회사 전체 범위) 리소스에 대해서는 스코핑 검사를 건너뛰고 통과시켰다
  -- (예: 팀 대표가 무소속 초대장을 만들 수 있었음). null 비교는 SQL에서 NULL(=거부)로
  -- 평가되므로 조건을 제거해도 안전하게 항상 "내 팀과 일치해야 함"이 강제된다.
  if r in ('team_lead','member') then
    return target_team_id = my_team_id();
  end if;

  return true;
end;
$$;

-- ============================================================
-- 8. RLS 활성화 + 정책
--    원칙 (SECURITY_REVIEW.md 치명적2 반영 개정):
--    RLS는 "같은 회사"라는 하한선뿐 아니라, role 기반 CRUD 하한선(팀원 직접
--    삭제 불가 등)과 role_permissions 커스텀 매트릭스까지 DB 레벨에서 직접
--    강제한다. 클라이언트(Next.js Server Action이든 브라우저의 Supabase
--    클라이언트든 무엇으로 접근하든) 어느 경로로도 이 하한선을 우회할 수 없다.
--    API 레이어는 여기 반영하기 애매한 UX 수준의 추가 검증(에러 메시지,
--    프리뷰 등)만 담당한다.
-- ============================================================
alter table companies enable row level security;
alter table profiles enable row level security;
alter table teams enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table role_permissions enable row level security;
alter table projects enable row level security;
alter table transactions enable row level security;
alter table upload_batches enable row level security;
alter table deletion_requests enable row level security;

create policy companies_select on companies
  for select using (id = my_company_id());
create policy companies_update on companies
  for update using (id = my_company_id() and my_role() in ('owner','admin'));

create policy profiles_select on profiles
  for select using (
    id = auth.uid()
    or id in (select user_id from memberships where company_id = my_company_id())
  );
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

create policy teams_select on teams
  for select using (company_id = my_company_id());
create policy teams_write on teams
  for all using (company_id = my_company_id() and my_role() in ('owner','admin'));

create policy memberships_select on memberships
  for select using (company_id = my_company_id());

-- (치명적1 수정) WITH CHECK로 새 값(role/is_representative/user_id)을 제한.
-- owner로의 격상, is_representative 탈취, 본인 row 수정을 모두 이 경로로는 불가능하게 한다.
-- is_representative 이관은 2차 위임 RPC(PRD 5.2)로만, owner 승계는 별도 절차로만.
create policy memberships_update on memberships
  for update
  using (
    company_id = my_company_id()
    and my_role() in ('owner','admin')
  )
  with check (
    company_id = my_company_id()
    and my_role() in ('owner','admin')
    and role <> 'owner'
    and is_representative = false
    and user_id <> auth.uid()
  );

-- (추가 발견) 기존엔 모든 회사 구성원이 초대 목록을 볼 수 있었고, 초대 시
-- "본인보다 높은 role 부여 금지"가 서버에 전혀 강제되지 않았다. 둘 다 수정.
create policy invitations_manage on invitations
  for all
  using (
    company_id = my_company_id()
    and my_role() in ('owner','admin','team_lead')
    and has_permission('invite_member', team_id)
  )
  with check (
    company_id = my_company_id()
    and my_role() in ('owner','admin','team_lead')
    and has_permission('invite_member', team_id)
    and role_rank(role) < role_rank(my_role())
  );

create policy role_permissions_select on role_permissions
  for select using (company_id = my_company_id());
create policy role_permissions_write on role_permissions
  for all using (
    company_id = my_company_id()
    and my_role() in ('owner','admin')
  );

-- (치명적2 수정) select는 회사 전원, insert/update는 has_permission(팀 스코핑 포함),
-- delete는 owner/admin/team_lead만 대상 role이 될 수 있고 그마저 has_permission 통과해야 함.
-- member는 애초에 delete 정책 매칭 대상이 아니므로(기본 거부) 직접 삭제가 DB 레벨에서 불가능 —
-- 반드시 deletion_requests → decide_deletion_request RPC 경유만 가능.
create policy projects_select on projects
  for select using (company_id = my_company_id());
create policy projects_insert on projects
  for insert with check (company_id = my_company_id() and has_permission('project_create', team_id));
create policy projects_update on projects
  for update using (company_id = my_company_id() and has_permission('project_update', team_id));
create policy projects_delete on projects
  for delete using (
    company_id = my_company_id()
    and my_role() in ('owner','admin','team_lead')
    and has_permission('project_delete', team_id)
  );

create policy transactions_select on transactions
  for select using (company_id = my_company_id());
-- (엑셀 업로드 구현 중 발견) excel_upload는 role_permissions에 별도 키로 존재하지만
-- 어떤 RLS 정책도 실제로 검사하지 않아, transaction_create만 있으면 대량 업로드도
-- 그냥 통과하는 상태였다. source='excel_upload'인 행에는 excel_upload 권한도 추가로 요구.
create policy transactions_insert on transactions
  for insert with check (
    company_id = my_company_id()
    and has_permission('transaction_create', (select p.team_id from projects p where p.id = project_id))
    and (
      source <> 'excel_upload'
      or has_permission('excel_upload', (select p.team_id from projects p where p.id = project_id))
    )
  );
create policy transactions_update on transactions
  for update using (
    company_id = my_company_id()
    and has_permission('transaction_update', (select p.team_id from projects p where p.id = project_id))
  );
create policy transactions_delete on transactions
  for delete using (
    company_id = my_company_id()
    and my_role() in ('owner','admin','team_lead')
    and has_permission('transaction_delete', (select p.team_id from projects p where p.id = project_id))
  );

create policy upload_batches_select on upload_batches
  for select using (company_id = my_company_id());
create policy upload_batches_insert on upload_batches
  for insert with check (company_id = my_company_id());

create policy deletion_requests_select on deletion_requests
  for select using (company_id = my_company_id());
create policy deletion_requests_insert on deletion_requests
  for insert with check (company_id = my_company_id() and requested_by = auth.uid());

-- (주요3 수정) 본인이 요청한 건은 본인이 승인/반려 불가 (requested_by <> auth.uid() 추가)
create policy deletion_requests_decide on deletion_requests
  for update using (
    company_id = my_company_id()
    and requested_by <> auth.uid()
    and (
      my_role() in ('owner','admin')
      or (my_role() = 'team_lead' and my_team_id() = (
        select coalesce(p.team_id, tr_p.team_id)
        from deletion_requests dr
        left join projects p on p.id = dr.project_id
        left join transactions t on t.id = dr.transaction_id
        left join projects tr_p on tr_p.id = t.project_id
        where dr.id = deletion_requests.id
      ))
    )
  );

-- ============================================================
-- 9. RPC: 회사 생성(신규 가입 시 오너로 자동 가입)
-- ============================================================
create function create_company_with_owner(company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
begin
  if exists (select 1 from memberships where user_id = auth.uid() and status = 'active') then
    raise exception '이미 다른 회사에 소속되어 있습니다';
  end if;

  insert into companies (name) values (company_name) returning id into new_company_id;

  insert into memberships (company_id, user_id, role, is_representative, status)
  values (new_company_id, auth.uid(), 'owner', true, 'active');

  return new_company_id;
end;
$$;

-- ============================================================
-- 9b. RPC: 초대 미리보기 (비로그인 접근 가능 — 구현 중 발견해 추가)
-- ============================================================
-- 초대 수락 화면(SERVICE_SPEC 1.2)은 로그인 전 상태에서 "초대 대상 이메일"을
-- 보여줘야 하는데, invitations 테이블의 일반 RLS는 회사 관리 권한자만 조회 가능해서
-- 초대받은 당사자(아직 비회원)는 자기 초대장도 못 읽는 문제가 있었다.
-- 토큰(추측 불가능한 uuid)을 아는 사람에게만 최소 정보를 공개하는 별도 함수로 해결.
create function get_invitation_preview(invitation_token uuid)
returns table (
  email text,
  company_name text,
  role text,
  status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select i.email, c.name, i.role, i.status, i.expires_at
    from invitations i
    join companies c on c.id = i.company_id
    where i.token = invitation_token;
end;
$$;

-- ============================================================
-- 10. RPC: 초대 수락
-- ============================================================
create function accept_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations;
begin
  if exists (select 1 from memberships where user_id = auth.uid() and status = 'active') then
    raise exception '이미 다른 회사에 소속되어 있습니다';
  end if;

  select * into inv from invitations
    where token = invitation_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception '유효하지 않거나 만료된 초대입니다';
  end if;

  -- 프론트엔드 구현 중 발견: 초대 링크가 전달/전파되어 다른 계정이 수락하는 것을 방지
  -- (초대장의 email과 현재 로그인한 auth 계정의 email이 일치해야만 수락 가능)
  if lower(inv.email) <> lower((select email from auth.users where id = auth.uid())) then
    raise exception '이 초대는 %(으)로 발송되었습니다. 해당 이메일로 로그인해주세요.', inv.email;
  end if;

  insert into memberships (company_id, user_id, role, team_id, is_representative, status)
  values (inv.company_id, auth.uid(), inv.role, inv.team_id, false, 'active');

  update invitations set status = 'accepted' where id = inv.id;

  return inv.company_id;
end;
$$;

-- ============================================================
-- 11. RPC: 삭제 요청 생성 (팀원)
-- ============================================================
create function request_deletion(
  p_project_id uuid,
  p_transaction_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into deletion_requests (company_id, project_id, transaction_id, requested_by, reason)
  values (my_company_id(), p_project_id, p_transaction_id, auth.uid(), p_reason)
  returning id into new_id;
  return new_id;
end;
$$;

-- ============================================================
-- 12. RPC: 삭제 요청 승인/반려 (팀 대표/관리자/오너)
-- ============================================================
create function decide_deletion_request(
  p_request_id uuid,
  p_approve boolean,
  p_decision_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req deletion_requests;
begin
  select * into req from deletion_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception '대기중인 요청을 찾을 수 없습니다';
  end if;

  -- (주요3 수정) RLS와 별개로 RPC 내부에서도 이중 방어
  if req.requested_by = auth.uid() then
    raise exception '본인이 요청한 삭제 건은 본인이 승인/반려할 수 없습니다';
  end if;

  if p_approve then
    if req.project_id is not null then
      delete from projects where id = req.project_id;
    else
      delete from transactions where id = req.transaction_id;
    end if;
    update deletion_requests
      set status = 'approved', decided_by = auth.uid(), decision_reason = p_decision_reason, decided_at = now()
      where id = p_request_id;
  else
    update deletion_requests
      set status = 'rejected', decided_by = auth.uid(), decision_reason = p_decision_reason, decided_at = now()
      where id = p_request_id;
  end if;
end;
$$;

-- ============================================================
-- 13. 트리거: 최소 1 오너 유지 (권고7)
--    UI(SERVICE_SPEC 2.2)에서 이미 막고 있지만, 직접 API 호출/버그에 대비한
--    DB 레벨 이중 방어. 회사의 마지막 활성 오너를 role 변경/비활성화하려 하면 차단.
-- ============================================================
create function prevent_last_owner_removal()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active') then
    if not exists (
      select 1 from memberships
      where company_id = old.company_id
        and role = 'owner'
        and status = 'active'
        and id <> old.id
    ) then
      raise exception '회사에는 최소 1명의 오너가 필요합니다';
    end if;
  end if;
  return new;
end;
$$;

create trigger memberships_protect_last_owner
  before update on memberships
  for each row execute function prevent_last_owner_removal();

-- ============================================================
-- 14. 플랫폼 운영자 백오피스 — 사업자정보/고객센터/DPO/탈퇴정책
-- ============================================================
-- platform_admins: 회사(memberships)와 무관한 플랫폼 전체 운영자 allowlist.
-- 최초 운영자 등록은 앱 UI가 아니라 Supabase 콘솔에서 수동으로 한다
-- (자기 자신을 운영자로 등록하는 자기 임명 경로를 만들지 않기 위한 의도적 설계 —
--  PRD 5.4의 "정식 백오피스 UI는 2차"라는 결정과 별개로, "누가 운영자가 되는가"는
--  이 기능이 생겨도 여전히 사람이 수동으로 결정해야 하는 신뢰 경계임).
-- role: 'super_admin'(시스템 관리자, 최고 관리자) / 'operator'(일반 운영자).
-- can_view_audit_log: operator에게 개별로 부여하는 감사 로그 열람 권한(super_admin은 항상 열람 가능).
-- 둘 다 앱에는 부여 UI가 없다 — platform_admins 자체가 Supabase 콘솔 전용이므로
-- 등급/권한 부여도 같은 신뢰 경계 안에서 콘솔로 처리한다 (일관성 유지).
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('super_admin','operator')),
  can_view_audit_log boolean not null default false,
  created_at timestamptz not null default now()
);

create function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create function is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid() and role = 'super_admin');
$$;

-- 감사 로그 열람 가능 여부: 최고 관리자는 항상 가능, 일반 운영자는 can_view_audit_log=true일 때만
create function can_view_audit_log()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_admins
    where user_id = auth.uid()
      and (role = 'super_admin' or can_view_audit_log = true)
  );
$$;

-- 싱글턴 테이블(운영 설정은 플랫폼에 1세트만 존재) — id를 boolean true 고정값으로 강제
create table platform_settings (
  id boolean primary key default true check (id),
  business_name text,
  representative_name text,
  business_registration_number text,
  business_address text,
  support_email text,
  support_phone text,
  dpo_name text,
  dpo_contact text,
  company_withdrawal_policy text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into platform_settings (id) values (true);

alter table platform_admins enable row level security;
alter table platform_settings enable row level security;

-- 운영자만 누가 운영자인지 조회 가능 (일반 회원에게 노출 안 함)
create policy platform_admins_select on platform_admins
  for select using (is_platform_admin());
-- insert/update/delete 정책 없음 = 앱에서 운영자 추가/제거 불가 (Supabase 콘솔 전용, 의도된 설계)

-- 처리방침/이용약관 등 공개 페이지에서 비로그인 방문자도 읽어야 하므로 select는 완전 공개
create policy platform_settings_public_read on platform_settings
  for select using (true);
create policy platform_settings_admin_write on platform_settings
  for update using (is_platform_admin())
  with check (is_platform_admin());

-- ============================================================
-- 15. ADMIN 회원관리 — 회사 데이터 열람 (감사 로그 필수)
-- ============================================================
-- 사용자 결정: "회원관리는 계정 + 소속 회사의 PNL 데이터까지 전체 열람" 허용.
-- 이는 지금까지의 핵심 원칙("회사간 데이터 절대 격리")에 대한 의도적 예외이므로,
-- RLS로 조용히 열어주지 않고 반드시 **감사 로그를 남기는 RPC 경유로만** 접근하게 한다.
-- projects/transactions에는 platform_admin용 SELECT 정책을 추가하지 않는다 —
-- 접근 기록 없이 열람 가능한 경로를 만들지 않기 위함.
create table platform_admin_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  company_id uuid not null references companies(id),
  resource text not null check (resource in ('members','projects','transactions')),
  accessed_at timestamptz not null default now()
);

alter table platform_admin_access_log enable row level security;
-- 감사 로그는 모든 운영자가 아니라 최고 관리자 + 권한 부여받은 운영자만 열람 가능
create policy platform_admin_access_log_select on platform_admin_access_log
  for select using (can_view_audit_log());
-- insert 정책 없음: 아래 RPC 함수(security definer) 경유로만 기록 생성

create function admin_get_company_members(p_company_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  email text,
  role text,
  team_id uuid,
  is_representative boolean,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception '운영자 권한이 필요합니다';
  end if;

  insert into platform_admin_access_log (admin_user_id, company_id, resource)
  values (auth.uid(), p_company_id, 'members');

  return query
    select m.id, m.user_id, p.display_name, u.email, m.role, m.team_id, m.is_representative, m.status
    from memberships m
    join profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.company_id = p_company_id;
end;
$$;

create function admin_get_company_projects(p_company_id uuid)
returns setof projects
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception '운영자 권한이 필요합니다';
  end if;

  insert into platform_admin_access_log (admin_user_id, company_id, resource)
  values (auth.uid(), p_company_id, 'projects');

  return query select * from projects where company_id = p_company_id;
end;
$$;

create function admin_get_company_transactions(p_company_id uuid)
returns setof transactions
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception '운영자 권한이 필요합니다';
  end if;

  insert into platform_admin_access_log (admin_user_id, company_id, resource)
  values (auth.uid(), p_company_id, 'transactions');

  return query select * from transactions where company_id = p_company_id;
end;
$$;

-- ============================================================
-- 16. ADMIN "PNL 데이터" — 사용 현황 메타데이터 (집계만, 실제 금액/항목 비노출)
-- ============================================================
-- 사용자 결정: 이 화면은 메타데이터(건수 등)만 — 개별 회사 상세 열람이 아니므로
-- access_log 기록 대상이 아니다 (실제 데이터 열람은 15절의 RPC로 별도 수행).
create function admin_list_companies()
returns table (
  company_id uuid,
  company_name text,
  member_count bigint,
  project_count bigint,
  transaction_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception '운영자 권한이 필요합니다';
  end if;

  return query
    select
      c.id,
      c.name,
      (select count(*) from memberships m where m.company_id = c.id and m.status = 'active'),
      (select count(*) from projects p where p.company_id = c.id),
      (select count(*) from transactions t where t.company_id = c.id),
      c.created_at
    from companies c
    order by c.created_at desc;
end;
$$;

-- ============================================================
-- 17. 공지사항 / FAQ (공개 콘텐츠 — 테넌트 데이터 아님, 일반 RLS로 충분)
-- ============================================================
create table notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notices enable row level security;
alter table faqs enable row level security;

create policy notices_read on notices
  for select using (is_published = true or is_platform_admin());
create policy notices_admin_write on notices
  for all using (is_platform_admin()) with check (is_platform_admin());

create policy faqs_read on faqs
  for select using (is_published = true or is_platform_admin());
create policy faqs_admin_write on faqs
  for all using (is_platform_admin()) with check (is_platform_admin());
