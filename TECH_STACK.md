# 기본 기술 스택

이 AI팀이 프로젝트에서 기본으로 따르는 표준 스택. 프로젝트별로 다른 스택을 쓰기로 명시하지 않는 한, 아래 구성을 기본값으로 삼는다.

| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트엔드 프레임워크 | Next.js (TypeScript) | App Router 기준, 타입 안정성 필수 |
| 스타일링/컴포넌트 | Tailwind CSS + uipro-cli | 컴포넌트는 uipro-cli로 스캐폴딩 후 커스터마이징 |
| 백엔드/DB/Auth | Supabase | Postgres, Auth, Storage, RLS(Row Level Security) 활용 |
| 경량 백오피스/자동화 | Google Sheets + Apps Script + Google Forms | 내부 운영, 데이터 수집, 간단한 자동화용. 서비스 핵심 DB로는 쓰지 않고 Supabase와 역할을 분리한다 |
| 배포 | AWS Amplify | CI/CD, 호스팅, 환경변수 관리 |

## 역할별 적용 원칙

- **frontend-developer**: Next.js(TypeScript) + Tailwind + uipro-cli 기준으로 구현. 새 UI는 uipro-cli로 먼저 스캐폴딩 가능한지 확인 후, 없으면 Tailwind 유틸리티로 직접 구성한다.
- **web-app-publisher**: 마크업은 Tailwind 유틸리티 클래스 기준, 컴포넌트 구조는 uipro-cli 산출물과 호환되게 만든다.
- **backend-developer**: 서비스 핵심 데이터/인증은 Supabase를 기본으로 한다. 내부 운영·경량 자동화(폼 수집, 간단 대시보드, 알림 트리거)는 Google Sheets/Apps Script/Forms 조합을 우선 검토하고, 핵심 서비스 로직까지 확장되면 Supabase로 옮기는 것을 제안한다.
- **mobile-app-developer**: 클라이언트는 네이티브/하이브리드/RN/Flutter 중 상황에 맞게 선택하되, 백엔드는 동일한 Supabase를 공유한다.
- **project-manager**: 배포 파이프라인(AWS Amplify) 기준으로 일정/릴리즈 계획을 짠다.
- **qa-reviewer**: Supabase RLS 정책, Amplify 환경변수/브랜치 배포 설정도 리뷰 범위에 포함한다.
- **privacy-security-officer**: Supabase RLS/Auth 설정, Amplify 환경변수(시크릿) 관리, Google Forms/Sheets에 개인정보가 쌓일 경우의 접근권한·보관기간을 점검한다.

## 원칙

- 이미 프로젝트에 이 스택으로 구축된 코드/설정이 있으면 그 컨벤션을 그대로 따른다.
- 이 표준 스택에서 벗어나야 할 이유(성능, 팀 역량, 특수 요구사항)가 있으면 임의로 다른 기술을 쓰지 않고 project-manager/ceo-advisor에게 먼저 이유를 설명하고 승인을 받는다.
