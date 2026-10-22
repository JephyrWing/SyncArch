# AGENTS.md

SyncArch 저장소에서 일하는 모든 AI 도구(Claude Code, Codex, Gemini, Copilot, Cursor 등)와 사람을 위한 시작 지침입니다.
작업 규칙의 원본은 프로젝트 Google Drive의 **06. 프로젝트 AI 작업 하네스 v1.6**입니다(2026-10-21 확인).
이전 Notion은 보존본이며 새 이력은 Drive에 씁니다. 이 파일은 규칙을 복사하지 않고
(A) Drive 문서를 읽고 쓰는 방법, (B) 코드에서 확인한 SyncArch 관례, (C) 커밋·push 전 검증 절차만 둡니다.
이 파일과 Drive 원본이 다르면 Drive가 우선이며, 차이를 보고하고 이 파일을 고치는 PR을 제안합니다.

## (A) 작업 시작

작업 전에 아래 시작 프롬프트(00 시작 안내 "팀원 GPT에 전달할 시작 프롬프트" 원문)를 따릅니다.

```markdown
나는 [본인 실명]이고 SyncArch 팀 프로젝트를 진행한다.
프로젝트 폴더 https://drive.google.com/drive/folders/11FlVjf_NctuYpLzWMcrrjryQlJ3T-iln
시작 안내 https://docs.google.com/document/d/1Sjji_rYH9IGK3B1my0bJkTuG00O4YIq-GgyRKKngpBQ/edit?usp=drivesdk
하네스 v1.6 https://docs.google.com/document/d/1dqRpNt7WUzy3i6_RfmrQ8X1PjwWeb8jHeXWyvwBtV-U/edit?usp=drivesdk
운영 관리 Sheets https://docs.google.com/spreadsheets/d/1JnjU4kCS4aHQmJRLedZDBSlAlVH_vvFbuFb42zkBTh8/edit
Git https://github.com/JephyrWing/SyncArch.git
Google Drive 도구로 원본 시작 안내와 하네스 본문을 직접 읽고, 작업 보드에서 내 실명의 담당 카드와 연결 테스트를 찾는다.
이미 있는 파일 ID와 계획 코드를 유지한다. 사본 프로젝트·카드를 만들지 않는다.
개발 전 관련 명세와 실제 코드를 확인하고 작업 브랜치에서 구현·테스트 후 origin push와 develop 대상 PR/병합을 따른다.
작업 보드를 갱신하면 연결 테스트의 재검토를 확인하고 실제 RUN·카드·테스트 결과를 같은 작업에서 갱신한다.
완료 전 MVC 검토와 작업자 이해 확인을 진행한다.
실패하면 사용한 도구 이름·대상 파일 ID·실제 오류를 알리고 읽기/쓰기 성공을 추정하지 않는다.
```

- 문서는 이름 검색 대신 **고정 파일 ID**로 찾습니다(06 "Drive 운영 전환 기준"). 작업 카드 15개의 ID는 00 시작 안내에 있습니다.

  | 문서 | 파일 ID |
  | --- | --- |
  | 00 시작 안내 | `1Sjji_rYH9IGK3B1my0bJkTuG00O4YIq-GgyRKKngpBQ` |
  | 01 목표·범위·요구사항 | `1mSusJkid69yYn1T_UjwDRBYqpHSeeGJFBHlN0yU9d7o` |
  | 02 설계·개발 환경 | `1T9UEm699DUSkkRrXX9fXLMiM23lq3bCCTFeW7wupE_c` |
  | 03 작업 운영·카드 양식 | `18_ewFpJZK6iRTigkMG8awyhrJcbCwY_sofDnq2F6_Y0` |
  | 04 결정·이슈·회의 기록 | `1GachILOZYokii5l6n3acJqWZtc3on4vcxssMFNwe5CI` |
  | 05 검증·배포·인계 | `1C__j-0BiZkjNSaHLu_ai-RqITGNsBqUf-MiyPH3eI-8` |
  | 06 프로젝트 AI 작업 하네스 | `1dqRpNt7WUzy3i6_RfmrQ8X1PjwWeb8jHeXWyvwBtV-U` |
  | 07 요구사항별 테스트·실행 기록 | `1sCAgecbzgZ9fP3SHWAmqHg3GHeqvDC9DZJIuciWlUhI` |
  | 07A 테스트 절차 상세 | `1oq6xeKl3Vz6ZeC5NVXabBZYMPC7mnbjyMeIAN5s_z0w` |
  | 08 운영 관리 Sheets | `1JnjU4kCS4aHQmJRLedZDBSlAlVH_vvFbuFb42zkBTh8` (작업 보드 탭 gid `1090520649`) |

- **읽기**: 문서가 링크 공유로 열려 있어 로그인·토큰·MCP 없이 본문을 받을 수 있습니다. 어떤 AI 도구든 같은 방법을 씁니다.

  ```powershell
  curl.exe -sL "https://docs.google.com/document/d/<ID>/export?format=md"                      # Google Docs → Markdown
  curl.exe -sL "https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<탭 gid>"    # Sheets 탭 → CSV
  ```

  HTML 로그인 화면이 오면 공유 설정이 바뀐 것입니다. 그때는 각 도구의 Google Drive 연결이나 로그인된 브라우저로 읽습니다.
- **쓰기**(카드·작업 보드·RUN·연결 확인): 자기 Google 계정이 필요합니다. 도구의 Google Drive 연결이나 로그인된 브라우저로
  같은 파일 ID의 필요한 구간·셀만 고치고, 사본을 만들거나 오래된 사본으로 덮어쓰지 않습니다(DRIVE-03·04).
  링크 공유 읽기는 연결 확인 탭의 자기 계정 읽기·쓰기 확인을 대신하지 않습니다(DRIVE-01·02).
- 읽지 못하면 **읽지 못한 문서를 그대로 보고**하고 권한 안에서 가능한 분석만 진행합니다. 링크를 본 것과 본문을 읽은 것은 다릅니다(CORE-01).
- 작업 시작 기록에는 읽은 문서 ID·버전, 읽지 못한 자료, 수정 범위, 완료 조건과 검증 방법을 적습니다.
- 공통 규칙은 06 하네스의 ID로 참조합니다. 본문은 Drive에서 읽습니다.
  CORE-01~10(공통), DRIVE-01~06(Drive 연결·갱신), GIT-01~05(브랜치·PR), MVC-01~10(계층), TEST-01~08(테스트·배포), UNDERSTAND-01~07(이해 확인).

## (B) SyncArch 프로젝트 관례

코드에서 확인한 사실과, 02 설계 계약 중 코드 작성에 바로 필요한 것만 적습니다. 괄호 안이 출처입니다.
02에서 "제안"인 항목은 **(제안)**으로 표시합니다. 02와 코드가 다르면 추측하지 말고 차이를 보고합니다.

### 구조

```text
frontend/src/App.tsx          전체 상태와 단계 전환
frontend/src/components/      Step1IdeaBoard ~ Step4ErdStudio와 하위 폴더 step1~step4, 모달, Header, 로비·채팅
frontend/src/api/             auth.ts(JWT 인증 클라이언트), client.ts(공통 요청), projects.ts(프로젝트·문서·협업 API)
frontend/src/hooks/           문서 저장·실시간 병합(useProjectDocument), 접속 표시, 채팅
frontend/src/types/index.ts   도메인 타입 (ProjectData 등)
frontend/src/utils/           SQL 생성, ERD 린터, Markdown 생성, 3-way 병합 (순수 함수 + *.test.ts)
frontend/server.ts            이전 Express/Gemini 서버. npm run dev:legacy 전용, 기능 추가 금지
backend/app/__init__.py       create_app, Blueprint 등록
backend/app/routes/           HTTP 경계 (auth, social_auth, projects, members, documents, collaboration, health)
backend/app/services/         업무 규칙·트랜잭션 (*_service.py, project_access.require_access)
backend/app/repositories/     DB 접근 (*_repository.py)
backend/app/schemas/          요청 구조 검사 (*_schema.py)
backend/app/models/           app_users, app_user_identities, projects, project_members, project_documents,
                              document_mutations, project_activity, project_messages
backend/migrations/versions/  Alembic 마이그레이션 0001 ~ 0006
backend/tests/                pytest (test_*_browser.py는 Playwright)
```

- 계층 규칙은 06 MVC-01~10이 원본입니다. 호출 방향은 React → API → routes → services → repositories → models·DB이고,
  라우트는 HTTP 입출력·JWT 인증·오류 코드만, 서비스는 업무 규칙과 트랜잭션, Repository는 DB 접근만 맡습니다.
- 라우트는 `before_request`에서 `@jwt_required(locations=["headers"])`와 `actor_from_claims(get_jwt())`로 사용자를 정하고,
  서비스는 `session_factory`로 트랜잭션을 열어 `require_access(session, actor_id, project_id, ...)`로 권한을 확인합니다(`routes/members.py`).
  잠금 순서는 projects → project_members → project_documents입니다(`services/project_access.py`).
- Blueprint는 `backend/app/__init__.py`의 `create_app`에서 등록하고, URL 접두사는 Blueprint마다 `/api/...`로 둡니다.
- 새 API 추가 순서(예시 `routes/members.py` → `services/member_service.py` → `repositories/member_repository.py`):
  02 API 표에 있는지 확인 → `schemas/`에 입력 검사 → 서비스·Repository → 라우트 → `create_app`에 등록 →
  `backend/tests/test_<기능>.py`에 성공·권한·오류 테스트 → README 실행 안내 갱신.

### API·데이터 계약

- 성공 응답은 `{"data": ...}`, 실패 응답은 `{"error": {"code": "...", "message": "..."}}`. 204는 본문 없음(02 "API 정의서").
- 오류 코드는 02 "오류 계약" 표를 따릅니다. 업무 오류는 `backend/app/errors.py`의 `ApplicationError` 하위 클래스로 만들고,
  상태 코드→오류 코드 매핑과 처리기는 같은 파일의 `register_error_handlers`에 있습니다.
  사용자 메시지는 한국어, 5xx 응답과 로그에 SQL·바인딩 값·계정 정보·스택트레이스를 넣지 않습니다(코드 `database_error`).
- 시간은 UTC로 저장하고 API에서는 `Z`가 붙은 ISO 8601로 반환합니다(02 "운영 DB 모델"). 모델은 UTC naive `DATETIME(6)`과 `utc_now()`
  (`backend/app/models/common.py`), 응답 변환은 `services/project_service.py`의 `utc()`입니다.
- 모델: ID는 `CHAR(36)` + `new_id()`, 테이블 옵션 `TABLE_OPTIONS`, 제약 이름 `uq_/fk_/ck_<table>_<column>`(`backend/app/models/`).
- 프로젝트 데이터는 `project_documents.payload` JSON 하나와 `version`으로 관리합니다. 문서 구조를 바꾸면 `empty_document()`와 `frontend/src/types/index.ts`를 함께 확인합니다(02 "프로젝트 문서 계약").
- 문서 저장 계약 v2(`schemas/document_schema.py`, `services/document_validation.py`): 새 항목 id는 UUID, 작성자·투표자·결정자·댓글 작성자는
  로그인 사용자만, 투표는 `voterIds`, `stepLocks`·`archVersions`·`currentArchVersionId`는 읽기 전용입니다.
  서버는 저장 응답에 정규화한 payload를 돌려주므로 프론트는 저장 뒤 그 값을 반영합니다(`hooks/useProjectDocument.ts`).
- 설계 화면이 만드는 SQL은 텍스트 결과물입니다. 운영 DB에 실행하는 기능을 만들지 않습니다(02 "MariaDB DDL 검증").
- 비밀값은 `backend/.env` 환경변수로만 받습니다. `VITE_*` 변수에는 DB 계정·세션 키·AI 키를 넣지 않습니다(02 "세션과 비밀값").
  `demo` 모드 필수값 검사(`backend/app/config.py`)를 약하게 만들지 않습니다.

### 마이그레이션

모델 수정 → `flask db migrate` → **생성된 파일 직접 검토** → `flask db upgrade`. 앱 시작 시 `db.create_all()`이나 DB 초기화를 하지 않습니다.
머지된 마이그레이션 파일은 수정하지 않고 새 리비전을 추가합니다(README "모델과 확장 방법", 02 "환경변수와 실행 계약").

### 코드 스타일 (주변 코드를 따름)

- Python: 4칸 들여쓰기, 큰따옴표, import는 표준 라이브러리 → 서드파티 → 로컬 상대 import(`from .extensions import db`) 순서로 빈 줄 구분.
  앱 기능은 `register_*(app)` 함수로 붙입니다(`commands.py`, `frontend.py`).
- 테스트: `backend/tests/conftest.py`의 `app` 픽스처, 로그인이 필요한 API는 `test_projects.py`의 `users` 픽스처(JWT 헤더 포함).
  인증 테스트는 실제 Redis가 필요해서 `backend/scripts/run_auth_checks.py`로 실행합니다(README). 기본 SQLite(FK 켬),
  MariaDB는 `scripts/verify_mariadb.py`. `TEST_DATABASE_URL`에는 `syncarch_test_<UUID hex>` 형식의 버릴 DB만 씁니다.
- TypeScript/React: 2칸 들여쓰기, 작은따옴표, 세미콜론. 컴포넌트는 `export const Name: React.FC<NameProps>`(App만 default export).
  타입은 `src/types/index.ts`, 상대 import에 `.ts` 확장자, 아이콘 `lucide-react`, 스타일 Tailwind.
- 계산 로직은 `src/utils/`의 순수 함수로 두고 `node:test` + `node:assert/strict` 테스트를 붙입니다(`src/utils/rules.test.ts`).
- 테스트 규칙은 06 TEST-01~08이 원본입니다. 기능을 만들거나 고치면 테스트도 작성·수정하고 실제로 실행합니다.
  React 사용자 흐름·UI 회귀는 Playwright, Flask 서비스·스키마·API는 pytest입니다(TEST-01).
  현재 Playwright 검사는 `backend/tests/test_*_browser.py`에 있고, 편집 화면 전체 흐름은 아직 자동화되지 않아 수동 확인을 기록합니다.
  테스트 0건·실패·필수 skip·실행 불가는 통과가 아닙니다(TEST-02). 실행 결과는 07 요구사항별 테스트에 RUN 이력으로 남깁니다(TEST-03).
- `vite.config.ts`의 HMR/watch 설정은 주석대로 건드리지 않습니다.
- 의존성은 실제로 쓸 때만 추가하고, `backend/requirements.txt`에 전이 의존성까지 정확한 버전으로 고정합니다(02 CHG-002).

### 주석

- 주석과 docstring은 **한국어**로 쓰고, 코드가 보여주지 못하는 이유만 짧게 적습니다. 식별자·명령·오류 코드는 원문 그대로 둡니다.
- 프론트엔드 주석은 `[기능명]`으로 시작합니다. 기능별 코드를 검색으로 바로 찾기 위해서입니다(예: `rg "\[문서 저장\]"`).
  `{/* [ERD 설계] 테이블 목록 */}`. 백엔드는 주변 develop 코드처럼 접두어 없이 이유만 씁니다.
- 예외: `backend/migrations/alembic.ini`는 영어 그대로 둡니다. Alembic이 시스템 코드페이지(cp949)로 읽어서 한글이 있으면
  `flask db`와 pytest가 실패합니다. 머지된 마이그레이션(0001~0006)과 라이선스 머리말도 고치지 않습니다.
  Windows PowerShell 5.1이 읽는 `.ps1`에 한글을 쓰면 UTF-8 BOM으로 저장합니다.
- 기능명은 아래 목록에서 고릅니다. 새 기능이 생기면 목록에 먼저 추가하고 같은 이름을 씁니다.

| 기능명 | 범위 |
| --- | --- |
| 앱 설정 | `create_app`, `config.py`, `extensions.py`, CLI 명령, `.env.example`, Vite 설정 |
| 공통 오류 | `errors.py`, `http_error`, API 오류 응답 |
| 헬스체크 | `/api/health`, DB 연결 확인 |
| 구글 로그인 | 로그인 화면(`LoginScreen`, Google·팀원 계정), JWT 인증 클라이언트(`api/auth.ts`) |
| 프로젝트 | 프로젝트 목록·생성·수정·삭제 |
| 멤버 관리 | 프로젝트 멤버 추가·삭제·권한 |
| 초대 코드 | 팀장 초대 코드 발급·재발급, 코드로 참가(`/api/projects/join`), 로비(`ProjectLobby`), `InviteButton`, `invite_service` |
| 채팅 | 프로젝트 대화(`project_messages`, `/messages`), `ChatPanel`, `useChat` |
| 문서 저장 | `project_documents` 저장·버전 충돌, 문서 스키마 검사, 프론트 저장 훅·어댑터 |
| 협업 상태 | 동시 편집 표시, 문서 비교(`documentDiff`), `CollabStatus` |
| DB 모델 | `backend/app/models/` |
| 마이그레이션 | Alembic 설정과 리비전 |
| 시드 데이터 | `flask seed-accounts`(`commands.py`, `services/seed_service.py`) |
| 화면 제공 | Flask의 React 빌드 제공(`frontend.py`) |
| API 통신 | `frontend/src/api/` |
| 공통 화면 | `App.tsx`의 단계 전환·전역 상태, `Header`, 공통 타입·스타일 |
| 아이디어 보드 | Step 1 |
| 기능 명세 | Step 2 |
| API 명세 엑셀 | Step 2 API 명세 `.xlsx` 생성·다운로드, 저장 때 자동 내보내기(`API_SPEC_EXPORT_DIR`) |
| 시스템 아키텍처 | Step 3 |
| ERD 설계 | Step 4, ERD 이름 변경(`erdRename`) |
| SQL 생성 | `sqlGenerator` |
| ERD 린터 | `erdLinter` |
| 명세서 생성 | `markdownGenerator`, 내보내기 모달 |
| AI 초안 | `AiDraftModal`, 레거시 Express/Gemini 서버 |
| 검증 스크립트 | `run_auth_checks.py`, `verify_mariadb.py`, 테스트 DB 권한 |

### 환경과 명령 (Windows PowerShell, 프로젝트 루트 기준)

Python 3.12(02 계약 3.12.6), Node.js + npm lockfile, MariaDB 11.4. 가상환경은 활성화 없이 `backend\.venv\Scripts\python.exe`로 씁니다.

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
.\frontend\node_modules\.bin\esbuild.cmd frontend/src/api/auth.ts --bundle --format=esm --outfile=.local/auth-client.js
.\backend\.venv\Scripts\python.exe backend/scripts/run_auth_checks.py --junitxml .local/backend.xml   # 백엔드 전체(실제 Redis)
cd frontend; npm run lint; npm test; npm run build
```

설치·실행·DB 준비는 `README.md`가 기준입니다.

## (C) 브랜치·검증·PR 절차

1. **작업 브랜치**: develop에는 직접 push할 수 없습니다. 최신 `origin/develop`에서 작업별 브랜치를 만듭니다
   (예: `feat/W07A-idea-board`, `fix/W05-save-conflict`, `chore/W12-ci`). 진행 중인 같은 작업 브랜치가 있으면 재사용합니다(GIT-01).
2. **커밋 전**: 변경과 관련된 06 규칙(CORE·MVC·TEST)을 다시 확인하고, 다른 AI나 사람에게 리뷰를 받습니다.
   Drive 규칙을 읽지 못했다면 그 사실을 리뷰 결과에 남깁니다.
3. **push 전**: 위 "환경과 명령"의 백엔드·프론트 검사가 모두 통과해야 합니다. 작업 브랜치는 origin에 push합니다(GIT-02).
   AI가 push할 때는 사람이 그 작업에서 명시적으로 요청한 경우에만 합니다.
4. **PR**: base를 `develop`으로 PR을 열고 무엇을·왜 바꿨는지, 실행한 검증 명령과 결과, 확인하지 못한 항목을 적습니다.
   필수 리뷰 승인은 없고 충돌이 없으면 병합할 수 있습니다(GIT-03). main 병합과 배포 버전 결정은 팀장 영역입니다(CORE-07).
   훅 우회(`--no-verify`)·force push·보호 해제를 하지 않습니다(CORE-08, GIT-04).
5. **기록과 완료**: 원격 push는 develop 반영 완료가 아닙니다. 카드에 브랜치·PR URL·커밋·실제 병합 여부와 develop 병합 SHA를
   나눠 적습니다(GIT-05). 작업 완료는 필수 테스트 통과, 07·카드 기록, MVC-10 검토, 이해 확인(UNDERSTAND-01~07)을
   모두 충족할 때만입니다. 이해 확인만 남으면 카드를 "검토 요청"으로 둡니다(TEST-08, UNDERSTAND-05).
