# 보안/개인정보 점검 — 1차 스키마 리뷰

작성: privacy-security-officer · 대상: `supabase/migrations/0001_init_schema.sql`, `BACKEND_DESIGN.md` · 2026-08-17

## 요약
치명적 2건은 **지금 스키마 단계에서 반드시 수정**. 주요/권고 항목은 구현 진행하면서 반영.

## 구현 중 추가 발견/수정 (frontend-developer, 2026-08-17)
- **`accept_invitation`에 이메일 일치 검증 누락** — 초대 링크가 전달/전파되면 초대 대상이 아닌 다른 로그인 계정이 수락할 수 있었음. `inv.email`과 `auth.users.email`(현재 로그인 계정) 일치 검사를 추가해 수정. (`0001_init_schema.sql` 10절)

## 처리 결과 (2026-08-17 backend-developer 반영)

| # | 이슈 | 상태 | 반영 위치 |
|---|---|---|---|
| 1 | memberships 자기 격상 | ✅ 수정 | `0001_init_schema.sql` — `memberships_update` WITH CHECK |
| 2 | projects/transactions role 미반영 | ✅ 수정 | `0001_init_schema.sql` — `has_permission()`, insert/update/delete 정책 분리 |
| 3 | 삭제 요청 자기승인 | ✅ 수정 | `0001_init_schema.sql` — RLS + `decide_deletion_request` RPC 이중 체크 |
| 4 | SheetJS/업로드 제한 | ⏳ 구현 단계 | `BACKEND_DESIGN.md` 5절 주석 — Server Action 구현 시 적용 예정 |
| 5 | 자유입력 PII 혼입 고지 | ✅ 문서화 | `PRIVACY_POLICY_DRAFT.md` 1절 |
| 6 | 국외이전 | ✅ 해결 | Supabase 리전 `ap-northeast-2`(서울) 확정 — 국내 저장으로 국외이전 미해당. `PRIVACY_POLICY_DRAFT.md` 4절 |
| 7 | 최소 1 오너 유지 | ✅ 수정 | `0001_init_schema.sql` — `prevent_last_owner_removal` 트리거 |
| 8 | 개인정보처리방침 없음 | ✅ 초안 작성 | `PRIVACY_POLICY_DRAFT.md` (플레이스홀더 포함, 런칭 전 확정 필요) |
| (추가) | 초대 시 상위 role 부여 서버 미검증 | ✅ 수정 | `0001_init_schema.sql` — `invitations_manage` WITH CHECK `role_rank()` |

**리뷰 중 추가로 발견한 이슈**: `invitations` 테이블에 서버측 role 검증이 전혀 없었고(SERVICE_SPEC 2.2가 요구한 "본인보다 높은 role 시도 시 서버 재검증"이 구현 누락), 모든 회사 구성원이 초대 목록을 볼 수 있었다(팀원 관리 권한자만으로 제한해야 함). 둘 다 이번 수정에 포함.

---

## 2차 리뷰 — ADMIN 백오피스 확장 (회원관리/감사로그/공지사항/FAQ, 2026-08-17)

대상: `platform_admins`(등급 추가), `platform_admin_access_log`, `admin_get_company_*`/`admin_list_companies` RPC, `notices`/`faqs`. 1차 리뷰의 치명적 수정분은 이번 라운드에서 변경 없음(그대로 유효).

### 🟡 주요 — 개인정보처리방침에 운영자 열람 권한 미고지
**이슈**: 회원관리 기능으로 운영자가 회원 계정 정보와 회사 실데이터를 열람할 수 있게 됐는데, 처리방침에 이 사실이 없었다. PIPA상 개인정보 처리 목적/범위 고지 원칙 위반 소지.
**위험도**: 주요 — 법적 고지 공백.
**조치**: ✅ 수정 — `PRIVACY_POLICY_DRAFT.md` 1절에 "서비스 운영자의 열람" 문단 추가(열람 범위, 목적, 기록·보관 사실 명시).

### 🟢 권고 (선택사항, 미수정 — 기록만)
- `platform_admins` 테이블(운영자 명단·등급) 조회가 모든 운영자(operator 포함)에게 열려있음 — 최소권한 원칙상 super_admin 전용으로 좁히는 것도 고려 가능.
- 회원관리(`admin_get_company_*`)는 등급 구분 없이 모든 운영자가 전체 회사 데이터에 접근 가능. 감사 로그로 사후 추적은 되지만 사전 스코핑(예: 담당 회사만 열람)은 없음 — 운영 인원 증가 시 재검토 권장.
- `is_super_admin()` 함수가 정의만 되고 아직 정책에서 쓰이지 않음(현재 `can_view_audit_log()`에 role 체크가 인라인됨) — 향후 super_admin 전용 화면이 생기면 재사용 가능, 지금은 문제 아님.

### 검증한 항목 (문제 없음 확인)
- `admin_get_company_*` 3개 함수 모두 순수 SELECT만 수행 — "열람 전용" 요구사항대로 수정/삭제 경로 없음 확인.
- `platform_admin_access_log`는 insert/update/delete 정책이 전혀 없어 RPC 경유 외에는 앱에서 기록 생성·수정·삭제 불가 (사실상 append-only, 위변조 방지).
- `platform_admins`에 update 정책이 없어 operator가 스스로 super_admin으로 격상하거나 `can_view_audit_log`를 셀프 부여하는 경로 없음.

---

## 🔴 치명적

### 1. `memberships` UPDATE 정책에 `WITH CHECK` 없음 → 권한 자기 격상 가능
**이슈**: `memberships_write` 정책은 `USING (company_id = my_company_id() and my_role() in ('owner','admin'))` 만 있고 `WITH CHECK`가 없다. 즉 **관리자(admin)가 자기 자신의 membership row를 UPDATE해서 `role`을 `'owner'`로, 또는 `is_representative`를 `true`로 바꿔치기 할 수 있다.** `role` 컬럼의 CHECK 제약은 `'owner'`를 허용값에 포함하고 있어 이를 막지 못한다.
**위험도**: 치명적 — 권한 상승(Privilege Escalation). PRD 5.2가 명시한 "대표계정은 승인 기반 위임으로만 이동"이라는 정책을 DB 레벨에서 그냥 우회할 수 있음.
**권장 조치**:
```sql
alter policy memberships_write on memberships
  with check (
    company_id = my_company_id()
    and my_role() in ('owner','admin')
    and role <> 'owner'          -- UPDATE로 owner를 새로 만들 수 없음
    and is_representative = false -- is_representative는 이 경로로 변경 불가 (전용 RPC 필요)
    and user_id <> auth.uid()     -- 본인 자신의 membership은 이 정책으로 수정 불가
  );
```
대표계정 이관은 PRD 5.2에 정의된 대로 2차에서 승인 기반 RPC로만 처리하고, 그 전까지는 `is_representative` 변경 경로 자체를 막아야 한다.

### 2. `projects` / `transactions` 테이블 RLS가 role을 구분하지 않음 → 팀원이 삭제 승인 워크플로우 우회 가능
**이슈**: `projects_write`/`transactions_write` 정책이 `for all using (company_id = my_company_id())`로만 되어 있어, **역할과 무관하게 같은 회사의 모든 멤버(팀원 포함)가 테이블에 직접 INSERT/UPDATE/DELETE 가능**하다. `BACKEND_DESIGN.md`는 "세부 권한은 API 레이어(Server Action)에서 판단"이라고 적었지만, PRD 7절에서 확정한 **API-first 원칙(Supabase 클라이언트로 직접 통신, Flutter 대비)**과 정면으로 충돌한다 — 클라이언트가 Supabase JS SDK로 직접 DB에 접근하는 구조에서는, 브라우저 콘솔에서 `supabase.from('transactions').delete()`를 직접 호출하면 Server Action을 완전히 우회한다. 즉 **팀원이 삭제 승인 워크플로우(PRD 5.3) 없이 거래내역을 즉시 삭제할 수 있고, 커스텀 권한 매트릭스(PRD 5.1)도 DB 레벨에서는 전혀 강제되지 않는다.**
**위험도**: 치명적 — 이 서비스의 핵심 기능(권한 통제, 삭제 승인)이 설계상 무력화됨. 재무 데이터 무결성 문제로 직결.
**권장 조치** — 두 방식 중 하나를 택해야 함 (backend-developer 확인 필요):
   - **(A) RLS에 role 조건 반영**: `transactions`의 DELETE 정책을 `my_role() in ('owner','admin','team_lead')`로 제한(팀원 제외), `team_lead`는 `team_id = my_team_id()`까지 추가. `role_permissions` 커스텀 매트릭스까지 RLS 서브쿼리로 반영하거나(복잡도↑), 최소한 "팀원 delete 불가"라는 하드 하한선만이라도 RLS에 반드시 넣는다.
   - **(B) 클라이언트가 테이블에 직접 접근하지 못하게 구조 변경**: `projects`/`transactions`에 대한 쓰기는 전부 RPC/Server Action 경유만 허용하고, 브라우저의 Supabase 클라이언트에는 해당 테이블 direct write 권한 자체를 주지 않음 (RLS를 `for select`만 열고 insert/update/delete 정책을 아예 안 만들거나 `service_role`에서만 실행). PRD 7절의 "API-first"는 REST 계약이 있다는 의미이지, "클라이언트가 테이블에 무제한 직접 접근"을 뜻하지 않는다 — 이 둘을 혼동하면 안 됨.
   
   **권장**: (A) + (B) 병행. 최소한 delete는 RLS에서 role로 하한선을 걸고(A), insert/update의 세부 권한(role_permissions 기반)은 RPC 함수 안에서 검증(B)하는 방식. 지금처럼 raw table policy로 "전체 허용"해두고 앱 레이어만 믿는 구조는 채택 불가.

---

## 🟡 주요

### 3. 삭제 승인 시 요청자 본인 승인 방지 로직 없음
`decide_deletion_request` RPC/`deletion_requests_decide` 정책 어디에도 `requested_by <> auth.uid()` 체크가 없다. role이 바뀌는 시점(예: 팀원이 팀 대표로 승진)과 맞물리면 본인 요청을 본인이 승인하는 경우가 생길 수 있다. 방어적으로 조건 추가 권장.

### 4. 엑셀 업로드 — 서버측 파일 처리 라이브러리 검증 필요
`P&L 온라인 대시보드.html`이 번들한 SheetJS(xlsx.js)를 서버 파싱에도 재사용할 계획인데, SheetJS는 과거 특정 버전에서 프로토타입 오염(Prototype Pollution)·정규식 관련 취약점이 보고된 이력이 있다. **서버에서 사용자가 업로드한 파일을 파싱**하는 건 클라이언트 파싱과 리스크 성격이 다르다(서버 프로세스 자원 소모, RCE 부류 취약점 영향 범위가 큼). 조치: 최신 패치 버전 고정, 업로드 파일 크기/행 수 상한, 파싱 타임아웃 설정.

### 5. 자유 입력 필드의 개인정보 혼입 가능성
`projects.note`, `transactions.note`, `deletion_requests.reason`은 자유 텍스트라 사용자가 임의로 이름/연락처 등을 적어 넣을 수 있다. 기능적으로 막을 방법은 없으나, **개인정보처리방침에 "자유 입력 필드에 이용자가 개인정보를 기재할 경우 해당 정보도 처리될 수 있다"는 고지 문구**가 필요하다.

### 6. 개인정보 국외이전(國外移轉) 검토 필요 — PIPA 제28조의8
Supabase/AWS Amplify 사용 시 데이터가 국내가 아닌 리전에 저장되면 **개인정보보호법상 국외 이전**에 해당할 수 있다. 원칙적으로 정보주체 별도 동의가 필요하나, (a) 계약 이행에 필요한 처리위탁이고 처리방침에 위탁 사실을 공개한 경우, 또는 (b) 수탁사가 ISMS-P 등 인증(제32조의2)을 받고 안전조치를 다한 경우엔 별도 동의를 갈음할 수 있다. **확인 필요**: Supabase 프로젝트 리전 선택(가능하면 한국/APAC 리전 우선 검토), Supabase의 인증 현황, 회원가입 시 처리방침에 위탁/이전 사실 명시 여부. *이 부분은 실무 확인 사항이며 최종 판단은 법률 자문을 받는 것을 권장한다.*

Sources:
- [개인정보 보호법 제28조의8(개인정보의 국외 이전) - CaseNote](https://casenote.kr/%EB%B2%95%EB%A0%B9/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4_%EB%B3%B4%ED%98%B8%EB%B2%95/%EC%A0%9C28%EC%A1%B0%EC%9D%988)
- [개인정보 국외이전제도 - Public Policy Wiki](https://policywiki.kr/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4_%EA%B5%AD%EC%99%B8%EC%9D%B4%EC%A0%84%EC%A0%9C%EB%8F%84)

---

## 🟢 권고

### 7. "최소 1명의 오너 유지" 규칙이 DB 제약이 아닌 UI 로직에만 있음
SERVICE_SPEC 2.2절의 "마지막 오너 비활성화 차단"은 화면 단에서만 막고 있다. 앱 버그나 직접 API 호출 시 회사에 오너가 0명이 되는 상태가 가능하다. 트리거로 이중 방어 권장(1차 필수는 아님, 권고).

### 8. 개인정보처리방침 문서 아직 없음
수집 항목(이메일, display_name, 초대 대상 이메일), 목적(서비스 제공/인증/협업), 보관기간(탈퇴 후 처리 기준 미정) 초안이 필요. **런칭 전 필수** — 스키마가 안정화된 후 작성하는 걸 제안 (지금 쓰면 스키마 변경 시 다시 고쳐야 함).

---

## 다음 단계
1. **backend-developer** — 치명적 1, 2번 스키마/정책 수정 (승인 필요)
2. 수정 후 재검토 1회 더 진행
3. 주요 3~6번은 구현 단계에서 반영, 6번은 Supabase 리전 결정 시점에 재확인
4. 런칭 전: 개인정보처리방침 작성 (8번)
