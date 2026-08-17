-- 팀원 관리 화면(SERVICE_SPEC 2.2) 구현 중 발견: auth.users는 PostgREST로 노출되지 않아
-- 일반 회원(security definer RPC를 거치지 않는 클라이언트)은 같은 회사 팀원의 이메일을
-- 조회할 방법이 없었다. profiles에 email을 반정규화해서 해결.
-- (재실행 안전하게 전부 idempotent하게 작성 — 이전 시도가 중간에 실패했을 경우 대비)
alter table profiles add column if not exists email text;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), new.email);
  return new;
end;
$$;

-- 이메일 변경 시(비밀번호 재설정과 무관, 계정 이메일 자체 변경) profiles와 동기화
create or replace function sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function sync_profile_email();
