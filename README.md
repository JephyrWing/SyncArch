# SyncArch

React 프로토타입에 Flask + MariaDB 백엔드 기반을 추가한 프로젝트입니다.
프론트엔드 파일은 `frontend/`, Flask 서버는 `backend/`로 분리되어 있습니다.
기존 React 화면은 유지하고 기본 개발 서버는 Vite로 실행합니다.
이전 Express/Gemini 서버는 `frontend/server.ts`에 보존하며 `npm run dev:legacy`로만 실행합니다.
공개 DB 상태 API `/api/health`와 명시적 팀원 계정 초기화 CLI를 제공합니다.
JWT 인증·Redis RT 회전과 프로젝트·멤버·문서 원자 저장·활동/대시보드 API를 제공합니다.
프론트 저장 화면 연결은 W06, 실제 웹소켓 전달은 W15 후속 작업입니다.

## 구조

```text
frontend/
  src/                       기존 React 프로토타입
  server.ts                  선택적으로 실행하는 이전 Express/Gemini 서버
  package.json               프론트엔드 의존성과 실행 스크립트
  vite.config.ts             Vite 설정
  tsconfig.json              TypeScript 설정
  index.html                 React 진입 HTML
  .env.example               기존 프론트엔드 개발 서버 환경변수 예제
backend/
  app/
    __init__.py              Flask 앱 팩토리와 구성 등록
    errors.py                공통 JSON 오류 변환과 업무 예외
    config.py                환경변수와 MariaDB 연결 설정
    extensions.py            SQLAlchemy / Flask-Migrate
    models/                  사용자·프로젝트·멤버·문서·저장 기록 모델과 공개 import
    routes/health.py         공개 DB 상태 확인 HTTP 처리
    services/                health와 계정 초기화 업무·트랜잭션
    repositories/            DB 상태 조회와 사용자 저장
    schemas/seed_schema.py   계정 초기화 입력 검증
    commands.py              DB 연결 확인과 명시적 계정 초기화 CLI
    frontend.py              React 빌드 제공, API를 제외한 SPA fallback
  migrations/                Alembic 마이그레이션과 최초 스키마
  tests/                     DB 저장, 마이그레이션, 설정 검증
  scripts/verify_mariadb.py   격리된 MariaDB 11.4 검증과 재시작 확인
  .env.example               백엔드 환경변수 예제
  wsgi.py                    WSGI 실행 진입점
compose.yaml                 로컬 개발용 MariaDB
```

`.env`·개인 키, Python/npm 실행 환경·캐시, 빌드·테스트 결과, Flask `instance/`,
격리 DB와 검증 증빙을 보관하는 `.local/`은 Git에서 제외합니다.
AI Studio 임시 산출물(`.aistudio/`)과 기존 `frontend/dropdown-test.png`도 로컬 파일로만 유지합니다.
환경변수 예제(`.env.example`, `.env.*.example`, `*.env.example`), `package-lock.json`,
고정 requirements, 마이그레이션, 프로젝트 템플릿 JSON, 소스·테스트 코드는 계속 Git에서 관리합니다.
공유할 SQL·JSON·이미지와 테스트 fixture는 확장자 전체를 제외하지 않고 필요한 파일을 명시해 추가합니다.

## 실행 (Windows PowerShell)

Python **3.12.6**, Node.js, MariaDB **11.4.13**을 기준으로 검증합니다.
Python 런타임 의존성·전이 의존성은 requirements에 고정하며 프론트는 npm lockfile을 사용합니다.
Compose를 사용할 때는 Docker Desktop도 필요합니다.

### 1. 백엔드 설정

프로젝트 루트에서 실행합니다. 가상환경 활성화 없이도 아래 명령을 사용할 수 있습니다.
이 작업 환경의 Python 3.12.6은 `C:\Python312`에 설치되어 있습니다.
다른 PC에서는 [Python 3.12.6](https://www.python.org/downloads/release/python-3126/)을 설치하고
아래 첫 명령의 실행 파일 경로를 해당 설치 경로로 바꿉니다.
버전 기준은 `backend/.python-version`에도 기록합니다.

```powershell
& C:\Python312\python.exe -m venv backend/.venv
.\backend\.venv\Scripts\python.exe --version # Python 3.12.6
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

`backend/.env`의 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`를 설정합니다.
기본값은 로컬 개발용 Compose와 일치합니다. 개별 변수 대신 `DATABASE_URL`을 지정할 수도 있습니다.
개별 DB 변수를 쓰면 비밀번호에 `@`, `#` 같은 문자가 있어도 직접 URL 인코딩할 필요가 없습니다.
DB 계정 정보는 프론트엔드의 `VITE_*` 환경변수에 넣지 않습니다.

환경별 설정은 아래와 같습니다. 인증은 JWT와 Redis 세션을 사용합니다.

| 설정 | 개발 환경 | 시연 환경 |
| --- | --- | --- |
| `APP_ENV` | `development` | `demo` |
| `FLASK_DEBUG` | 로컬에서만 `1` 허용 | `0` 필수 |
| `SECRET_KEY` | 지정 권장. 없으면 실행마다 임시 키 생성 | 무작위 32자 이상 필수 |
| `TRUSTED_HOSTS` | 기본 localhost·127.0.0.1·[::1] | 실제 시연 호스트 목록 명시 |
| 세션 쿠키 | HttpOnly, SameSite=Lax | 동일 설정과 Secure 추가. HTTPS 필요 |

시연 모드는 DB 비밀번호도 명시해야 하며 잘못된 필수 설정으로 시작하지 않습니다.
JWT 서명키 `JWT_SECRET_KEY`는 `SECRET_KEY`와 별도로 설정합니다. 기본 AT 수명은 900초,
RT 세션은 로그인부터 604800초(7일)이며 회전해도 절대 만료 시각을 늘리지 않습니다.
`JWT_ACCESS_TOKEN_EXPIRES`, `JWT_REFRESH_TOKEN_EXPIRES`로 초 단위 설정을 바꿀 수 있습니다.

Redis Cloud는 사용자 확정에 따라 개발·배포 모두 TLS 없이 연결합니다.
`backend/.env`의 `REDIS_URL=redis://default:<URL인코딩한비밀번호>@<호스트>:<포트>/0`을 채웁니다.
Endpoint는 이 URL의 호스트와 포트에 해당합니다. 별도 API 키는 필요하지 않습니다.
Redis 접속 정보는 Flask만 보관하고 프론트의 `VITE_*` 변수에는 넣지 않습니다.
`ALLOWED_ORIGINS`에는 브라우저가 접속하는 정확한 출처를 쉼표로 구분해 넣습니다.
demo 환경은 무작위 32자 이상의 `JWT_SECRET_KEY`, `REDIS_URL`, 실제 `ALLOWED_ORIGINS`를 요구합니다.
브라우저↔Flask는 배포 시 HTTPS를 사용하며 RT 쿠키의 Secure 정책은 Redis TLS 설정과 별개입니다.

### 2. MariaDB 실행

Docker를 사용하는 경우 프로젝트 루트에서 실행합니다.

```powershell
docker compose --env-file backend/.env up -d --wait db
```

Compose는 MariaDB 11.4.13, UTF-8 연결, 영구 볼륨을 사용하며 포트는 로컬 PC에만 공개합니다.
기본 비밀번호는 로컬 개발용입니다. `DB_ROOT_PASSWORD`로 root 비밀번호도 변경할 수 있습니다.
초기화 환경변수는 **빈 볼륨으로 처음 시작할 때** 적용됩니다. 기존 볼륨의 계정 비밀번호는
`.env` 변경만으로 바뀌지 않으므로 MariaDB에서 별도로 변경해야 합니다.

기존 MariaDB를 사용하는 경우 Docker 실행은 생략하고 DBA가 생성한 DB와 계정을 지정합니다.
새 DB를 직접 준비해야 한다면 관리자 계정에서 아래 예시를 조정해 실행합니다.

```sql
CREATE DATABASE syncarch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'syncarch'@'localhost' IDENTIFIED BY 'replace-with-your-password';
GRANT ALL PRIVILEGES ON syncarch.* TO 'syncarch'@'localhost';
```

서버가 다른 호스트에 있다면 접속 계정의 허용 호스트도 실제 서버 주소에 맞춥니다.

### 3. DB 연결 확인, 마이그레이션, 서버 시작

```powershell
cd backend
.\.venv\Scripts\python.exe -m flask --app app:create_app db-check
.\.venv\Scripts\python.exe -m flask --app app:create_app db upgrade
.\.venv\Scripts\python.exe -m flask --app app:create_app run --debug
```

Flask는 기본 개발 포트 5000에서 실행됩니다. React 빌드가 있으면 화면과 정적 파일을 제공합니다.
빌드가 없거나 미구현 `/api` 경로를 요청하면 JSON 404가 반환됩니다.
오류 코드는 `NOT_FOUND`, `BAD_REQUEST`, `DB_UNAVAILABLE` 등 명세의 문자열 형식입니다.
서버 실행 시 테이블은 자동 생성하지 않습니다.
`db-check`는 접속만 확인하며, 스키마 생성은 `db upgrade`로 명시적으로 수행합니다.

`GET /api/health`는 DB에 `SELECT 1`을 실행한 뒤
`{"data":{"status":"ok","database":"ok"}}`를 반환합니다. DB 접속 실패는
`503`과 공통 `DB_UNAVAILABLE` 오류로 반환하며 접속 정보나 SQL을 노출하지 않습니다.
스키마 준비·Redis·JWT·웹소켓 상태까지 검증하는 readiness는 후속 범위입니다.

### 인증 API와 클라이언트

| 경로 | 입력·인증 | 결과 |
| --- | --- | --- |
| `POST /api/auth/login` | JSON `loginId`, `password`; 허용된 `Origin` 필수 | `data.user`, `accessToken`, `expiresIn`; RT 쿠키 발급 |
| `GET /api/auth/me` | `Authorization: Bearer <AT>` | `data.id/loginId/displayName` |
| `GET /api/auth/csrf` | RT 쿠키 | `data.csrfToken`; `no-store` |
| `POST /api/auth/refresh` | RT 쿠키, 허용된 `Origin`, `X-CSRF-TOKEN` | RT 1회 회전, 새 AT와 RT |
| `POST /api/auth/logout` | RT 쿠키, 허용된 `Origin`, `X-CSRF-TOKEN` | 세션 폐기, RT 쿠키 삭제 |

RT는 `syncarch_refresh` HttpOnly·SameSite=Lax·Path=/api/auth/ 쿠키입니다.
demo에서는 Secure를 사용합니다. AT는 쿠키·URL·브라우저 저장소에 넣지 않고 메모리에 둡니다.
인증 응답은 `Cache-Control: no-store`입니다. Origin/CSRF 거부는 400 `CSRF_FAILED`,
잘못된 계정·토큰·만료·폐기는 401 `AUTH_REQUIRED`, Redis 연결 실패는 503 `AUTH_UNAVAILABLE`입니다.
일반 API는 Bearer AT만 받고 RT 쿠키를 AT 대신 사용하지 않습니다.

`frontend/src/api/auth.ts`의 `authClient`는 login/me/refresh/logout과 메모리 AT를 제공합니다.
같은 탭의 갱신은 single flight로 합치고 Web Locks 지원 브라우저에서는 같은 출처의 여러 탭을 직렬화합니다.
공유 RT 쿠키의 최신 CSRF 값을 잠금 안에서 다시 읽습니다. RT를 동시에 재사용하면 세션 family가 폐기됩니다.
Web Locks가 없는 브라우저에서는 탭 간 직렬화를 보장하지 않으며 동시 갱신 시 재로그인이 필요할 수 있습니다.
현재 편집 화면에 로그인 UI를 연결하는 작업은 W06에서 이어 갑니다.

Redis에는 `syncarch:auth:rt:{sessionId}`에 사용자 ID·RT jti 해시·활성 상태·절대 만료 시각만 기록합니다.
Lua로 현재 jti를 비교해 한 번만 교체하며, 이전 RT 재사용 시 같은 세션의 AT도 거부합니다.
매 보호 요청에서 세션과 사용자 활성을 다시 확인합니다. Redis 키 누락·만료·장애는 인증 허용으로 처리하지 않습니다.

W15는 `app.auth.verify_access_token(token)`의 `(Actor, {sessionId, expiresAt})` 반환값과
`session_revoked` 신호의 `session_id` 인자를 사용할 수 있습니다. 소켓 연결/이벤트의 Origin·프로젝트 멤버십·보관 정책,
만료 타이머와 room 수신 중단은 W15에서 별도 구현해야 합니다. 신호 연결만으로 소켓 종료가 구현된 것은 아닙니다.

### 일반 회원가입 (W16)

로그인 화면의 **처음이라면 회원가입**에서 아이디·이름·비밀번호·비밀번호 확인을 입력합니다.
이메일은 선택이며 인증메일이나 SMTP는 사용하지 않습니다. 가입 완료 후 아이디가 채워진 로그인 화면에서 별도로 로그인합니다.
프로젝트는 직접 생성하거나 초대 코드로 참여하며 가입만으로 기존 프로젝트 권한을 받지는 않습니다.

`POST /api/auth/register`는 허용 Origin과 JSON `{loginId, displayName, password, email?}`만 받습니다.
아이디 trim 1~100자·이름 trim 1~80자·신규 비밀번호 8~128자이며 비밀번호 공백은 보존합니다.
이메일은 기존 정규화/유일성 규칙을 따릅니다. 입력/추가 필드 오류는 400, 아이디·이메일 중복은
409 `REGISTRATION_CONFLICT`, DB 실패는 503 `DB_UNAVAILABLE`입니다.
커밋 후 `201 {data:{user:{id,loginId,displayName}}}`을 반환하며 토큰·쿠키·Redis 세션·멤버십은 만들지 않습니다.
Redis 장애로 후속 로그인이 실패해도 생성한 계정은 유지되므로 다시 가입하지 말고 로그인만 재시도합니다.
기존 계정은 덮어쓰지 않습니다. Google 최초 연결은 로그인 후 **Google 연결**에서 비밀번호를 다시 확인합니다. 이메일만 일치해 자동 연결하지 않습니다.
모델·기존 마이그레이션을 재사용하므로 W16 전용 스키마 변경이나 DB 초기화는 필요 없습니다.

### Google 로그인·계정 연결·이메일 등록 (W03 확장)

`backend/.env`에서 `GOOGLE_OAUTH_ENABLED=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`를 설정합니다. 로컬 승인 URI는 `http://localhost:5173/api/auth/google/callback`입니다.
Google Cloud의 **웹 애플리케이션** OAuth client에 같은 URI를 등록하고 브라우저도 `localhost:5173`으로 접속합니다.
Vite의 `/api` 프록시가 Flask 5000으로 전달합니다. `127.0.0.1`은 별도 출처이므로 서로 섞지 않습니다.
demo에서는 허용된 HTTPS 출처의 동일 callback 경로를 등록합니다. ID/secret은 Flask에만 두고 `VITE_*`에 넣지 않습니다.
설정이 없으면 Google 기능을 끄고 `/api/auth/options` 결과로 UI 노출 여부를 판단합니다.

| 경로 | 입력·인증 | 결과 |
| --- | --- | --- |
| `GET /api/auth/options` | 없음 | `data.google.enabled`, `data.emailRegistration.enabled=true` |
| `POST /api/auth/google/start` | 허용 Origin, 빈 JSON `{}` | `authorizationUrl`, `expiresIn=300`, HttpOnly 브라우저 바인딩 쿠키 |
| `POST /api/auth/google/link/start` | 허용 Origin, 활성 AT, JSON `password` | 기존 사용자/세션에 묶인 연결 시작 |
| `GET /api/auth/google/callback` | Google의 `code/state` 또는 `error/state`, 바인딩 쿠키 | 검증·연결 후 RT 쿠키와 고정 `/auth/callback` 303 |
| `POST /api/auth/email` | 허용 Origin, 활성 AT, JSON `email/password` | 본인 비밀번호 재확인 후 이메일 직접 저장, `data.email` |

Google은 Authorization Code + OIDC, PKCE S256, state/nonce를 사용합니다. scope는 `openid email profile`이며
Google API용 추가 권한이나 Google refresh token을 요청하지 않습니다. 서버가 code를 교환하고 공식 `google-auth`로
서명·issuer·audience·iat·exp를 검증한 뒤 nonce·azp·subject를 확인합니다. 정상 로그인 callback은
앱의 RT 쿠키만 발급합니다. React는 `/auth/callback`에서 기존 csrf → refresh → me 순서로 메모리 AT를 복구해야 합니다.
명시적 연결 성공은 `/auth/callback?flow=link&linked=true`로 돌아오며 기존 로그인 세션을 바꾸지 않습니다.
클라이언트의 `userId`·임의 `returnTo`는 받지 않습니다. 취소·검증 실패는 JSON 401 `GOOGLE_AUTH_FAILED`,
추가 확인 필요는 409 `GOOGLE_LINK_REQUIRED`, 계정/이메일 충돌은 409 `IDENTITY_CONFLICT`입니다.
Redis·provider 장애는 503 `AUTH_UNAVAILABLE`이며 DB 장애는 503 `DB_UNAVAILABLE`입니다.

Google 로그인은 이미 연결된 provider+sub만 조회합니다. 연결이 없으면 409 `GOOGLE_LINK_REQUIRED`로
회원가입 또는 기존 계정 로그인 후 **Google 연결**을 안내합니다(DEC-024·CHG-029).
로그인한 사용자가 SyncArch 비밀번호를 재확인하고 Google OAuth도 통과해야 같은 UUID에 연결됩니다.
이메일 등록만으로 연결하지 않으며, 공개 가입자가 다른 사람의 이메일을 선점해도 Google 로그인으로 연결되지 않습니다.
이메일 일치는 명시 연결의 조건이 아닙니다. 프로젝트가 없는 새 계정도 로비에서 Google을 연결할 수 있습니다.
기존 연결·사용자 UUID·비밀번호·프로젝트·JWT/RTR는 유지합니다. 자체 인증메일·SMTP는 사용하지 않습니다.
이메일 정규화는 ASCII 공백 제거·소문자화이며 Gmail의 점·`+tag`를 합치지 않습니다.

`0005` migration은 기존 `0004` 뒤에 이메일 3열과 `app_user_identities`를 추가합니다.
기존 이메일은 모두 NULL로 시작합니다. 이메일은 비밀번호 재확인 후 직접 저장하며 정규화 유일 키를 사용하고,
identity는 `(provider, subject)`와 `(user_id, provider)`의 유일성을 DB로 보장합니다. subject는 ASCII 대소문자를 구분합니다.
사용자 행 잠금 뒤 최신 이메일·활성 여부·기존 연결을 재확인하고 하나의 SQL 트랜잭션에서 저장합니다.
이메일 변경도 같은 잠금을 사용합니다. `0005` downgrade는 새 이메일/identity만 제거하므로 해당 데이터를 백업해야 합니다.
CHG-024에 따라 앱 자체의 이메일 인증은 제외합니다. 이미 적용된 `0005`와 nullable `email_verified_at`는
과거 이력·데이터 호환을 위해 유지합니다. 이 값은 현재 이메일의 인증 여부를 나타내지 않으며,
직접 등록/수정과 Google 연결에서 읽거나 갱신하지 않습니다. 새 migration이나 DB 초기화는 필요하지 않습니다.

Redis의 `auth:oauth:google:<stateHash>`는 바인딩·nonce·PKCE verifier·목적·연결 세션을 TTL 300초로 보관하고
Lua에서 바인딩 확인과 일회 소비를 함께 처리합니다. 쿠키는 Path `/api/auth/google/`, HttpOnly, SameSite=Lax,
demo Secure이며 성공/실패 callback에서 제거합니다. 여러 탭에서 시작하면 다시 시작해야 할 수 있습니다.
DB와 Redis를 하나의 분산 트랜잭션으로 취급하지 않습니다. identity 커밋 뒤 RT 기록이 실패하면 identity는 보존하고
503과 함께 새 RT를 발급하지 않습니다. OAuth를 새로 시작하면 기존 연결로 재시도합니다.
직접 이메일 저장은 비밀번호·활성 사용자·Redis 세션을 확인하고 사용자 행 잠금 뒤 다시 상태를 검사합니다.
중복 이메일은 409, DB 오류는 503이며 부분 변경을 롤백합니다. 응답 유실 시 같은 주소로 다시 저장할 수 있습니다.
메일 코드·인증 링크·SMTP 설정/어댑터·Redis 이메일 challenge는 사용하지 않습니다.
이전 `/api/auth/email/start`·`/api/auth/email/verify`는 제거되어 JSON 404를 반환합니다.
과거 Redis email 키는 더 이상 사용하지 않고 기존 TTL로 만료됩니다. OAuth state·앱 RT 키는 유지합니다.
기존 `.env`에 남아 있는 `SMTP_*` 값은 읽지 않으며 새 설정에는 필요하지 않습니다.

callback 응답은 `no-store`, `Referrer-Policy: no-referrer`입니다. Werkzeug 로그에서 callback query를 가립니다.
운영 React 프록시·Flask 서버·APM도 callback query/code/state와 인증 헤더·쿠키·secret을 기록하지 않도록 설정해야 합니다.
W06은 로그인/이메일 직접 등록·수정/연결 UI와 callback 복구·오류 안내, W11은 실제 Google E2E,
W13은 동의 화면·HTTPS·프록시 운영 설정을 이어갑니다. provider fixture를 실제 Google 로그인 성공으로 간주하지 않습니다.
검증 구현 근거: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect),
[공식 ID 토큰 검증](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html),
[이메일 소유권 조건](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

### 프로젝트·멤버 API (W04)

아래 API는 Bearer AT와 활성 사용자 확인이 필요합니다. 요청 본문의 `ownerId`, `actorId`, `role`,
`payload`로 권한이나 문서를 지정할 수 없습니다. 객체 권한은 매 요청의 DB 멤버십으로 확인합니다.
다른 프로젝트의 ID를 직접 요청하거나 제외된 계정으로 재요청하면 404를 반환합니다.

| 경로 | 요청 | 동작 |
| --- | --- | --- |
| `GET /api/projects?archived=false` | `false` 기본값, `true`, `all` | 가입 프로젝트만 조회 |
| `POST /api/projects` | `title`, 선택 `summary/categoryTag/targetDbms` | 새 프로젝트·OWNER 멤버십·빈 v2 문서·활동 이력 원자 생성; 201 |
| `GET /api/projects/{pid}/document` | 선택 `If-None-Match` | 멤버만 메타데이터·문서 조회; ETag/304; `private, no-cache` |
| `POST /api/projects/{pid}/clone` | `sourceVersion`, `title` | 서버 저장본을 새 소유자/프로젝트·version 1로 복사; 원본/내부 참조 보존 |
| `PATCH /api/projects/{pid}/archive` | `archived` 불리언 | OWNER만 보관/복원; 실제 변경 시 version·수정자·활동 이력 동시 저장 |
| `GET /api/projects/{pid}/members` | 없음 | 멤버 목록; 비밀번호/해시 제외 |
| `POST /api/projects/{pid}/members` | `loginId` | OWNER가 기존 활성 사용자를 EDITOR로 추가; 중복은 기존 멤버 반환 |
| `DELETE /api/projects/{pid}/members/{uid}` | 없음 | OWNER만 제외; 자신 제외 금지; 204 |
| `GET /api/project-templates` | 없음 | 기존 React 예시의 읽기 전용 스냅샷; DB 저장 없음 |
| `POST /api/project-templates/{templateId}/clone` | `sourceVersion`, `title` | 명시적 예시 복사만 새 DB 프로젝트 생성; 201 |

`targetDbms`는 `mariadb`만 받습니다. 프로젝트 문서 응답은 `data.project/version/payload/updatedAt`입니다.
ETag 일치 여부보다 인증·멤버십을 먼저 확인하므로 304로 권한 검사를 우회할 수 없습니다.
복사의 sourceVersion이 바뀌었으면 409 `VERSION_CONFLICT`와 `currentVersion`을 반환합니다.
보관된 프로젝트는 조회가 가능하며 멤버 변경·쓰기 정책은 403 `PROJECT_ARCHIVED`로 거부합니다.
OWNER 권한 위반은 403 `FORBIDDEN`이고 클라이언트의 역할 변경 필드는 받지 않습니다.
프로젝트 제목/설계 수정은 W05의 `PUT document` 계약으로 이어갑니다. 이번 작업에서 별도 문서 쓰기 경로를 추가하지 않았습니다.

생성·보관/복원·멤버 변경의 트랜잭션은 서비스가 소유합니다. 모든 변경은 projects 행을 먼저 잠그고
그 후 최신 멤버십과 문서를 확인합니다. MariaDB의 잠금 대기 뒤 오래된 멤버십 snapshot을 사용하지 않도록
권한 변경 경로의 멤버십 조회도 locking read를 사용합니다. 중복 추가/이미 같은 보관 상태는 version·이력을 중복 생성하지 않습니다.
멤버 제외는 문서 내용·과거 작성자를 삭제하지 않으며 이후 REST 접근을 거부합니다.

W15는 `app.services.project_events.project_changed`와 `access_revoked` 신호를 연결할 수 있습니다.
신호의 sender는 `project-service`이며, 전자는 `event`(eventId/projectId/version/mutationId/actorId/actorName/committedAt/changes),
후자는 `project_id/user_id/reason=MEMBER_REMOVED`를 받습니다. 신호는 성공한 DB 커밋 뒤에만 발생합니다.
알림 실패는 커밋 성공을 취소하지 않습니다. W15는 제거된 사용자의 room 수신 중단·Origin·만료 검사와 재접속 조회를 구현해야 합니다.
공유 권한 함수 `services.project_access.require_access(session, actor_id, project_id, lock=True, write=True)`는 W05 저장 서비스에서도 재사용합니다.
W15의 읽기/room 참여는 같은 정책의 `lock=False, write=False`를 사용하고 편집 허용은 `write=True`로 확인할 수 있습니다.

### 문서 원자 저장·활동·대시보드 (W05)

`PUT /api/projects/{pid}/document`는 Bearer AT와 현재 멤버십을 확인한 뒤
`baseVersion`, UUID `mutationId`, `project`, `payload`를 받습니다. `project`는 생성 API와 같은
`title`, 선택 `summary/categoryTag/targetDbms` 필드이며 대상 DBMS는 `mariadb`입니다.
응답 `data`는 `project`, `payload`, `version`, `updatedAt`, `mutationId`, `eventId`, `replayed`,
`normalizations`를 반환합니다. PUT 응답에는 ETag와 `Cache-Control: no-store`를 설정합니다.

프로젝트→멤버십→문서 순서로 잠그고 동일 트랜잭션에서 문서 CAS·메타데이터·수정자·버전·멱등 기록·
서버 diff 기반 활동 이력을 저장합니다. 오래된 버전은 409 `VERSION_CONFLICT/currentVersion`,
같은 키의 다른 본문이나 다른 작성자는 409 `IDEMPOTENCY_KEY_REUSED`입니다.
현재 권한·보관 정책을 확인한 뒤 버전 비교보다 먼저 멱등 기록을 확인합니다.
같은 요청은 최초 정규화 응답과 같은 eventId를 돌려주며 새 이력·알림을 만들지 않습니다.
그사이 더 최신 저장이 있어도 과거 결과를 최신 데이터로 바꾸지 않습니다.

`0004`는 기존 `document_mutations`에 nullable `result_data` JSON만 추가합니다.
기존 0001~0003과 문서·이력은 보존합니다. 이전 기록에 응답 스냅샷이 없으면 당시 버전·시각·
알려진 eventId와 `requiresReload: true`를 반환합니다. 현재 문서를 과거 결과로 반환하지 않습니다.
멱등 기록을 시연 중 자동 삭제하지 않습니다.

요청 JSON은 UTF-8 인코딩 기준 1 MiB 이하입니다. 잘못된 구조·참조·작성자는 422
`VALIDATION_FAILED`와 `fieldErrors[{path,message}]`, 크기 초과는 413 `DOCUMENT_TOO_LARGE`입니다.
새 항목/댓글/컬럼 ID는 UUID이며 기존 내부 ID는 유지합니다. 같은 종류 내 중복 ID, 없는 참조,
트리 순환·자기 부모·분류 불일치, 잘못된 enum/좌표/SQL 이름·FK 대상·자료형을 거부합니다.
자식 `category`와 삭제·이름 변경에 영향을 받는 참조는 클라이언트가 한 문서에서 함께 갱신해야 합니다.
접기/펼치기·탭·선택 등 개인 상태는 문서에 넣지 않습니다.

새 아이디어·댓글의 `authorId`와 결정자는 인증 사용자이며 댓글 시각은 서버 UTC로 지정합니다.
투표는 `voterIds`의 본인 ID만 추가/제거합니다. 다른 작성자의 댓글 개별 수정/삭제와 기존 작성자·
시각 조작은 거부합니다. 과거 표시용 `author/votedBy/votes`와 상대 시각은 불변 호환 기록으로
보존하며 실제 작성자 ID를 추측하지 않습니다. 화면의 새 투표 수는 `voterIds`에서 계산해야 합니다.
멤버가 제외돼도 과거 작성자와 투표 기록을 유지합니다.

v1 문서는 명시적 저장 때 v2로 정규화합니다. 부모 누락은 null, 형제 순서는 기존 배열 순서로
채우고 `connection.description` 누락은 빈 문자열로 채웁니다. 기존 ID·댓글·호환 스냅샷을 유지합니다.
`archVersions/stepLocks/currentArchVersionId`는 기존 읽기 호환만 허용하고 PUT으로 변경하지 않습니다.
PostgreSQL 예시의 INTEGER→INT, TIMESTAMPTZ→DATETIME(정밀도 6), JSONB→JSON 및
VARCHAR/DECIMAL의 길이·정밀도 분리를 수행하고 `normalizations`에 변환을 명시합니다.
논리 UUID는 유지하되 MariaDB 출력 시 CHAR(36) 변환이 필요하다는 정보를 반환합니다.
변환 안내 UI·SQL 출력 연결은 W06/W10에서 이어 갑니다. GET·복사는 기존 v1 원본을 자동 변경하지 않습니다.

`GET /api/projects/{pid}/activity?beforeVersion=&limit=20`은 현재 멤버에게
`data.items`와 `nextBeforeVersion`을 반환합니다. 최근 version·eventId 역순이며 limit 상한은 100입니다.
활동에는 삭제된 항목의 label도 남습니다. 커밋 뒤 알림 전송 실패는 저장 성공을 취소하지 않으며
활동 조회로 변경을 복구할 수 있습니다. 영속 이벤트 전송 큐는 추가하지 않았습니다.

`GET /api/projects/{pid}/dashboard`는 같은 프로젝트 잠금 아래 같은 상태의 `version`, `counts`,
`featureStatuses`, `progress`, `recentActivity`를 반환합니다.
`progress`는 COMPLETED 기능 수/전체 기능 수의 백분율이며 기능 0개이면 0입니다.
두 조회 API는 현재 객체 권한을 확인하고 `no-store`를 설정합니다.
실제 편집 UI·충돌 비교·자동 저장은 W06, WebSocket room/presence·이벤트 전달은 W15 후속입니다.

`backend/app/data/project_templates.json`은 기존 `INITIAL_PROJECTS` 두 예시의 version 1 스냅샷입니다.
예시와 기존 v1 저장본은 읽기/복사 시 원본 JSON과 내부 ID를 보존하고 W05의 명시적 저장 때 v2로 정규화합니다.
편집 UI의 프로젝트/멤버 화면 연결은 W06, 실제 소켓 전송은 W15 후속이며 API 테스트 통과로 이를 완료 처리하지 않습니다.

계정 준비는 마이그레이션 후 `python -m flask --app app:create_app seed-accounts`로
명시적으로 실행합니다. `SEED_ACCOUNT_PASSWORDS`는 아래 로그인 ID를 키로 갖는 JSON 객체이며
서로 다른 12~128자 비밀번호를 환경변수로 안전하게 전달합니다. 명령행·Git·공유 문서에는
실제 비밀번호를 넣지 않습니다.

| 로그인 ID | 표시 이름 |
| --- | --- |
| `choi_jinwoo` | 최진우 |
| `jeon_seolmin` | 전설민 |
| `maeng_dongyeong` | 맹동영 |
| `kim_donghyeon` | 김동현 |
| `shin_osim` | 신오심 |

비밀번호는 해시로 저장하며, 다섯 계정의 생성은 한 트랜잭션입니다. 재실행은 기존 ID·비밀번호를
유지하고 누락 계정만 추가합니다. 같은 로그인 ID의 표시 이름이 다르거나 비활성인 계정이 있으면
전체 작업을 거부합니다. 기존 프로젝트·문서·멤버십을 생성/초기화하지 않으며, 앱 시작 시 seed를
자동 실행하지 않습니다. 위 로그인 ID는 W02 초기 계정 계약이며 W03 로그인에서 재사용합니다.

아래 Waitress 명령은 기존 REST/정적 화면의 로컬 확인에만 사용합니다.
v1.7 웹소켓 운영 구성은 W15의 고정 의존성과 W13의 Gunicorn 단일 worker + threads +
simple-websocket 검증 후 적용합니다. 현재 명령으로 웹소켓 운영 준비를 완료했다고 판단하지 않습니다.

```powershell
.\.venv\Scripts\waitress-serve.exe --listen=127.0.0.1:5000 wsgi:app
```

시연 전 `frontend`에서 `npm run build`를 실행합니다. Flask가 `frontend/dist`를 제공합니다.
SPA 새로고침 fallback은 화면 경로에만 적용하며 `/api`와 없는 정적 파일은 JSON 404로 유지합니다.
시연 호스팅의 HTTPS와 환경변수는 별도로 구성해야 하며 이 명령만으로 배포가 완료되지는 않습니다.

실제 서비스의 도메인·API URL·리버스 프록시·CORS는 기존에 정한 배포 구성에 맞춰 추가합니다.

### 4. 기존 React 실행

다른 터미널에서 프로젝트 루트로 이동해 실행합니다.

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

프론트엔드 명령(`npm run build`, `npm run lint`, `npm test`)도 `frontend`에서 실행합니다.
개발 화면은 Vite 기본 포트 5173에서 실행되며 Express나 Gemini 키를 사용하지 않습니다.
`npm start`는 로컬 빌드 미리보기입니다. 시연 실행은 위의 Flask/Waitress 경로를 사용합니다.

React 화면의 프로젝트 데이터는 기존과 같이 메모리에 유지됩니다.
Flask를 실행하는 것만으로 화면 데이터가 DB에 저장되지는 않습니다.

## 모델과 확장 방법

운영 모델은 기존 5개 테이블과 W04에서 추가한 활동 이력 테이블로 구성됩니다.

| 테이블 | 용도 |
| --- | --- |
| `app_users` | 로그인 ID, 표시 이름, 비밀번호 해시, 활성 여부 |
| `projects` | 소유자, 제목·분류·대상 DBMS·보관 시각 |
| `project_members` | 프로젝트·사용자 복합 키와 OWNER/EDITOR 역할 |
| `project_documents` | 문서 JSON, 문서·스키마 버전, 수정자 |
| `document_mutations` | 중복 저장 방지에 사용할 요청 ID·해시·결과 버전 |
| `project_activity` | 생성·보관/복원·멤버 변경의 version·작업자·changes 영구 이력; W05 재사용 |

UUID는 CHAR(36), MariaDB 시간은 UTC DATETIME(6), 문서 버전은 양수 BIGINT를 사용합니다.
FK·고유 제약과 역할·버전 CHECK를 정의했습니다. 객체 권한·CAS 저장·문서 검증은 W04/W05 서비스에 구현했습니다.
Pydantic와 Flask-WTF는 해당 기능을 구현할 때 추가하며 현재 사용하지 않는 의존성으로 넣지 않았습니다.
설계 화면의 SQL은 결과물이며 운영 DB에서 실행하는 API를 만들지 않습니다.

기존 `0001`은 보존하고 `0002`에서 JSON을 `project_documents`로 이동합니다.
`0003`은 기존 문서/계정/멤버/버전을 바꾸지 않고 `project_activity`만 추가합니다.
`0002`로 내리면 활동 이력만 제거되므로 운영에서는 먼저 백업하고 명시적으로 실행합니다.
기존 데이터가 있으면 로그인할 수 없는 비활성 `__legacy_import__` 계정을 임시 소유자로 연결합니다.
원 JSON은 그대로 보존하며 실제 소유자 배정과 문서 정규화는 이후 명시적으로 처리해야 합니다.
기존 ID가 36자, 제목이 120자를 넘으면 DDL 전에 중단하여 자동 잘림을 막습니다.
기존 데이터가 있는 환경에서는 먼저 백업하고 서비스를 중지해 마이그레이션합니다.
MariaDB DDL은 암묵 커밋되므로 중간 실패 시 백업 복구 또는 실패 단계 확인이 필요합니다.
`0001`로 되돌리면 프로젝트 JSON은 복원되지만 새 계정·멤버·저장 기록 등 새 운영 정보는 제거됩니다.

모델 변경 후에는 `backend`에서 마이그레이션을 생성하고 검토합니다.

```powershell
.\.venv\Scripts\python.exe -m flask --app app:create_app db migrate -m "describe schema change"
.\.venv\Scripts\python.exe -m flask --app app:create_app db upgrade
```

설정 구조는 [Flask-SQLAlchemy 공식 문서](https://flask-sqlalchemy.palletsprojects.com/en/stable/quickstart/)와
[SQLAlchemy MariaDB/PyMySQL 문서](https://docs.sqlalchemy.org/en/20/dialects/mysql.html)에 맞췄습니다.

## 검증

### ERD MariaDB 자료형 입력

Step 4에서 대상 DBMS가 MariaDB이면 데이터 타입 입력란을 클릭해 전체 추천 목록을 볼 수 있습니다.
타입 이름·별칭·한국어 분류로 검색하고 마우스 또는 방향키와 Enter로 선택합니다.
문자·바이너리·BIT는 길이/비트 수, DECIMAL은 전체·소수 자릿수, 날짜/시간은 소수초 자릿수 입력칸이 나타납니다.
숫자 입력칸에서 Enter를 누르거나 입력칸 그룹 밖으로 이동하면 적용합니다. DECIMAL의 두 입력칸 사이 이동은 저장하지 않으므로 두 값을 함께 수정할 수 있습니다.
잘못된 범위·빈 값은 저장하지 않으며 Escape로 취소합니다. `VARCHAR(100)`, `DECIMAL(12,2)`, `TIMESTAMP(6)`처럼 괄호로 직접 입력해도 됩니다.
입력은 Enter 또는 포커스 이동 시 적용하며 Escape는 취소합니다. 잘못된 타입은 입력란에 오류를 표시하고 저장에 보내지 않습니다.
타입 변경 시 이전 타입의 길이·정밀도를 제거하며 서버가 분리해 저장한 값을 화면·SQL에서 다시 조합합니다.

MariaDB 11.4의 숫자(UNSIGNED 포함)·문자·바이너리·날짜/시간·JSON·UUID·IP·공간 타입과 ENUM/SET을 지원합니다.
ENUM/SET은 `ENUM('Active','inactive')`처럼 작은따옴표로 입력하며 값의 대소문자를 보존합니다.
값에 작은따옴표가 있으면 `''`로 표기합니다. 백슬래시 이스케이프는 SQL 모드에 따라 해석이 달라 지원하지 않습니다.
자료형 표기는 4,000자 이하이며 VARCHAR 길이는 기존 utf8mb4 계약에 따라 1~16,383으로 제한합니다.
정수 표시 폭·ZEROFILL·SQL_MODE 전용 타입/별칭 등 모든 MariaDB 문법을 제공하는 것은 아닙니다.
UUID는 기존 문서 계약대로 MariaDB SQL에서 CHAR(36)으로 내보냅니다. 기존 컬럼은 DBMS 선택만으로 변환하지 않습니다.
다른 DBMS는 기존 직접 입력·미리보기를 유지하며 전용 자동완성은 후속 범위입니다.
FK 체크 후 참조 컬럼을 `users.id` 형식으로 입력하면 저장 전에 양쪽의 타입·길이·정밀도·UNSIGNED를 비교합니다.
타입이 다르거나 참조 대상이 없거나 PK/UNIQUE가 아니면 입력란 아래에 이유를 표시하고 연결을 저장하지 않습니다.
호환되는 연결만 Enter 또는 입력란 밖으로 이동할 때 FK 표시와 참조를 한 번에 적용합니다.
Escape는 연결 편집을 취소하며, FK 체크를 해제하면 참조도 함께 제거합니다.
이미 연결된 양쪽 컬럼의 타입·길이를 변경해 관계가 깨지는 경우도 저장 전에 차단합니다.
오류 메시지에 표시된 두 컬럼의 타입을 확인하고, 타입을 바꿔야 한다면 연결을 해제한 뒤 양쪽을 맞추고 다시 연결하세요.
참고: [MariaDB 자료형](https://mariadb.com/docs/server/reference/data-types),
[DECIMAL 범위](https://mariadb.com/docs/server/reference/data-types/numeric-data-types/decimal).

관련 검증은 `frontend`의 `npm test`와 `npm run lint`, `npm run build`,
`backend`의 `python -m pytest tests/test_document_schema.py tests/test_mariadb_types.py`로 실행합니다.
실제 제품의 로그인 → 자료형·숫자 속성 입력 → 자동 저장 → 새로고침 복원은
`backend/tests/test_erd_workspace_browser.py`가 검사합니다. 프런트 빌드와 인증 클라이언트 번들,
Python Playwright·Chrome을 준비한 뒤 위 공통 runner로 실행합니다.
DB/Flask 재시작 보존은 `backend/scripts/verify_mariadb.py`의 격리 인스턴스 검증에 포함됩니다.

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest
```

기본 테스트는 FK 검사를 활성화한 SQLite에서 실행합니다. 이전 JSON의 보존·마이그레이션 롤백,
제약조건, 오류 형식·정보 보호, 환경 설정, SPA/API 경계 등을 검증합니다.

Windows에서 실제 MariaDB 11.4 검증은 다음 명령으로 실행합니다.

```powershell
.\.venv\Scripts\python.exe scripts/verify_mariadb.py
# 다른 설치 위치라면 --bin-dir 'C:\your-path\bin' 지정
```

이 명령은 로컬 임시 포트에 별도 MariaDB를 띄워 같은 테스트를 실행하고,
DB 서버 재시작 및 새 Flask 앱 생성 후 JSON 유지와 `db-check`를 확인합니다.
기존 서비스·계정·DB는 변경하지 않습니다. 임시 계정 비밀번호는 실행마다 생성하고 출력하지 않습니다.
테스트 디렉터리는 Git에서 제외되는 `.local` 하위에서 생성·정리합니다.
`TEST_DATABASE_URL`을 직접 지정하는 경우 삭제 가능한 `syncarch_test_<UUID hex>` DB만 허용하며,
테스트는 그 DB의 테이블을 초기화하므로 서비스 DB를 지정하면 안 됩니다.
이 검증은 기반 스키마 검증이며 로그인·실제 두 계정 협업·배포 검증의 완료를 뜻하지 않습니다.

W03의 인증 검사에는 실제 Redis와 설치된 Chrome이 필요합니다. 먼저 인증 모듈을 테스트용으로 빌드합니다.
프로젝트 루트에서 다음 명령을 실행합니다. `.env`의 Redis URL은 출력하지 않으며,
Redis 테스트는 매번 고유한 `syncarch:test:<UUID>:` 영역만 만들고 정리합니다.
공용 세션 키와 기존 DB는 초기화하지 않습니다.

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
.\frontend\node_modules\.bin\esbuild.cmd frontend/src/api/auth.ts --bundle --format=esm --outfile=.local/auth-client.js
.\backend\.venv\Scripts\python.exe backend/scripts/run_auth_checks.py --junitxml .local/w03-sqlite.xml
.\backend\.venv\Scripts\python.exe backend/scripts/run_auth_checks.py --mariadb-bin 'C:\your-MariaDB-11.4\bin' --junitxml .local/w03-mariadb.xml
```

`TEST_REDIS_URL`을 별도로 설정하면 `.env` 대신 그 테스트용 Redis에 연결합니다.
RT 재사용/동시 회전·CSRF/Origin·세션 폐기/누락·Redis 장애·브라우저 새로고침·다중 탭/독립 계정을 검사합니다.
댓글/투표 작성자 보호와 실제 소켓 room·만료·로그아웃 수신 중단은 W07A/W05/W15 구현 후 통합 검증해야 합니다.
브라우저 검사는 테스트용 HTTP 페이지에서 인증 클라이언트를 직접 사용하며 편집 UI의 로그인 흐름을 검증한 것은 아닙니다.
운영 HTTPS에서의 Secure 쿠키 전송·프록시 검증은 W13에 남겨 둡니다.

W04 검사도 위 공통 runner를 사용합니다. `--junitxml`에 `.local/w04-sqlite.xml` 또는
`.local/w04-mariadb.xml`을 지정해 결과를 구분합니다. 새 프로젝트/멤버 API의 브라우저 검사는 실제 두 계정에서
목록 격리·예시 복사·OWNER 보호·제외 후 404·보관/복원을 확인합니다.
`mariadb` 표시의 행 잠금 검사 2개는 SQLite 실행에서 명시적으로 제외되고 실제 MariaDB 실행에서는 반드시 포함됩니다.
마이그레이션 테스트는 DDL 전후 읽기 세션을 닫아 새 세션으로 확인합니다. 기존 실패 보고서를 지우지 않고 수정 후 전체 재실행합니다.

W05도 같은 runner에서 결과 경로를 `.local/w05-sqlite.xml` 또는 `.local/w05-mariadb.xml`로 구분합니다.
`test_document_schema.py`는 구조·트리·참조·기존 예시 호환을 검사하고 `test_documents.py`는
원자 저장·멱등·작성자 보호·활동/대시보드·실제 CAS와 멤버 제외 경쟁을 검사합니다.
`test_documents_browser.py`는 실제 Chrome 두 context에서 API 저장·409·재시도·새로고침·제외를 확인합니다.
이는 W06 편집 UI를 검증한 결과가 아닙니다. MariaDB 재시작 검사는 W05로 저장한 네 영역·위치·
메타데이터·버전·댓글 작성자/시각·최초 멱등 응답·활동 이력을 DB와 Flask 재시작 뒤 비교합니다.

### W06 이메일 화면과 연결 중단 복구

로그인 뒤 로비 또는 편집 화면 상단의 **이메일**에서 주소와 본인 비밀번호를 입력해
이메일을 직접 등록/수정합니다. 인증메일·코드·SMTP는 사용하지 않습니다.
실패하면 입력과 편집 초안을 유지하며, 저장 성공 또는 창 닫기 때 비밀번호를 지웁니다.

문서·채팅·접속 상태·멤버·초대 요청이 401/403/404로 거부되면 해당 프로젝트의
후속 요청을 함께 중단합니다. 미저장 초안은 JSON 백업으로 보존할 수 있으며,
**다시 연결** 시 미저장 초안이 있으면 폐기 여부를 먼저 확인합니다.
서로 다른 로그인 계정/세대 사이에는 401 요청을 재전송하지 않습니다.
문서 조회는 중첩되지 않으며, 연속 409는 최대 3회 뒤 자동 저장을 멈추고 명시적인 재시도를 기다립니다.

`backend/tests/test_workspace_browser.py`는 실제 React 빌드·Flask·SQL·Redis·Chrome으로
이메일 오류/성공, 두 계정 편집·새로고침, 초안/권한 상실, 지연 응답과 409 한도를 검사합니다.
Vite 검사는 별도 임시 포트에서 `/api` 프록시의 로그인/쿠키·ETag/304·저장·로그아웃도 확인합니다.
개발 Flask 포트를 바꾸려면 Vite 시작 전에 `API_PROXY_TARGET` 환경변수를 설정합니다.
이 변수는 개발 서버에서만 읽으며 `VITE_*` 변수로 비밀값을 전달하지 않습니다.
제품 UI 검사 전 `frontend`에서 `npm run build`와 위 인증 클라이언트 빌드를 실행하고,
같은 공통 runner의 `--junitxml .local/w06-mariadb.xml`로 실제 실행 결과를 구분합니다.
외부 Google 동의·Cloudtype HTTPS 검증은 로컬 provider fixture/프록시 검사와 구분합니다.
### 프로젝트 현황과 활동 이력

로비의 프로젝트 카드에 서버 저장본의 기능 완료율과 최근 변경을 표시합니다.
카드 또는 편집 화면 상단의 **현황·활동**에서 영역별 개수·수정자·시각과 이전 활동을 조회합니다.
진행률은 같은 버전의 `COMPLETED / 전체 기능`이며, 기능이 없으면 0%입니다. 미저장 초안은 집계에 포함하지 않습니다.
현황은 5초 간격 및 포커스/온라인 복귀에 갱신되고, 편집 화면에서는 저장 문서 버전 변경에도 갱신됩니다.
숨김 탭은 현황 폴링을 멈춥니다. 활동은 해당 집계 버전 이하를 20개씩 커서로 읽으며 이벤트 ID 중복을 제거합니다.
프로젝트 전환 뒤의 늦은 응답을 무시하고, 접근 상실 시 기존 공동 중단·초안 백업을 유지합니다.
로비의 특정 프로젝트 404는 다른 프로젝트 카드의 조회를 막지 않습니다.

실제 React·Flask·MariaDB/Redis 검사는 `backend/tests/test_dashboard_browser.py`에 있습니다.
프런트 빌드와 인증 클라이언트 번들을 준비한 뒤 공통 runner에 `PYTEST_ADDOPTS='-k dashboard_browser'`를 지정하면 선택 실행할 수 있습니다.


### W09 ERD 이름 변경과 기능 연결

컬럼명은 입력 후 영향받는 FK 목록을 확인하고 **컬럼명 적용**을 눌러 반영합니다.
취소 또는 Escape는 원래 이름과 참조를 유지합니다. 테이블명 변경도 모든 FK 참조를
같은 문서 저장에 담으며, 참조하는 컬럼의 업무상 이름은 유지합니다.
컬럼의 **고유 값**, **기본값**과 테이블의 **연관 기능**을 편집할 수 있습니다.
연결된 기능을 삭제하면 영향 테이블을 확인한 뒤 테이블·컬럼의 기능 연결을 함께 해제합니다.

`backend/tests/test_erd_workspace_browser.py`는 실제 React·Flask·Redis·Chrome으로
이름 중복/취소, 다중 FK 일괄 저장, 실제 두 계정의 409 재기준화, 422 저장 거부,
새로고침 복원, 기능 연결·삭제와 아이디어 하위 항목·아키텍처 요소 삭제를 검사합니다.
컬럼 속성·자료형 매개변수와 PK 전환도 검사하며, 테이블당 PK 컬럼 하나라는 서버 계약을 화면에서도 확인합니다.
위 공통 runner에 포함되며 SQLite에서는 테스트별 파일 DB를 사용해 HTTP 스레드의 연결을 분리합니다.
MariaDB 검증은 지정한 격리 테스트 DB를 사용합니다. 다른 DB 버전의 결과는 11.4 검증과 구분해 기록합니다.
