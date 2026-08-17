-- QA 중 발견: has_permission()의 "and target_team_id is not null" 조건 때문에
-- 팀 대표/팀원이 team_id 없는(회사 전체 범위) 리소스에 대해서는 팀 스코핑 검사를
-- 건너뛰고 통과되는 허점이 있었다. 대표적으로 팀 대표가 무소속(회사 전체) 초대장을
-- 만들 수 있었음. null 비교는 SQL에서 NULL(=거부)로 평가되므로 조건 제거로 안전하게 수정.
create or replace function has_permission(perm_key text, target_team_id uuid default null)
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

  if r in ('team_lead','member') then
    return target_team_id = my_team_id();
  end if;

  return true;
end;
$$;
