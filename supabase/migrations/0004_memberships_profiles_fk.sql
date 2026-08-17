-- QA 중 발견: memberships.user_id는 auth.users(id)만 참조하고 profiles(id)로의 직접 FK가
-- 없어서, PostgREST 임베디드 조인(select ...,profiles(display_name,email))이 관계를
-- 찾지 못해 실패한다 (/team 페이지에서 사용). profiles.id도 결국 auth.users(id)라 값은
-- 항상 일치하므로(핸들러 트리거가 가입 시 즉시 profiles row를 만듦), 안전하게 FK 추가 가능.
-- (재실행 안전하게 idempotent 처리 — ALTER TABLE ADD CONSTRAINT는 IF NOT EXISTS를 지원하지 않아 DO 블록으로 확인)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'memberships_user_id_profiles_fkey'
  ) then
    alter table memberships
      add constraint memberships_user_id_profiles_fkey
      foreign key (user_id) references profiles(id) on delete cascade;
  end if;
end;
$$;
