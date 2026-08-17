-- 엑셀 업로드 기능 구현 중 발견: excel_upload 권한이 role_permissions에 키로는 있었지만
-- 어떤 RLS 정책도 실제로 검사하지 않았다. transaction_create만 있으면 소스가 excel_upload여도
-- 그냥 insert가 통과되는 상태였음. transactions_insert 정책을 교체해서 막는다.
drop policy if exists transactions_insert on transactions;

create policy transactions_insert on transactions
  for insert with check (
    company_id = my_company_id()
    and has_permission('transaction_create', (select p.team_id from projects p where p.id = project_id))
    and (
      source <> 'excel_upload'
      or has_permission('excel_upload', (select p.team_id from projects p where p.id = project_id))
    )
  );
