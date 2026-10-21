# SyncArch

React 프로토타입에 Flask + MariaDB 백엔드 기반을 추가한 프로젝트입니다.
프론트엔드 파일은 `frontend/`, Flask 서버는 `backend/`로 분리되어 있습니다.
기존 React 화면은 유지하고 기본 개발 서버는 Vite로 실행합니다.
이전 Express/Gemini 서버는 `frontend/server.ts`에 보존하며 `npm run dev:legacy`로만 실행합니다.
공개 DB 상태 API `/api/health`와 명시적 팀원 계정 초기화 CLI를 제공합니다.
인증·프로젝트 업무 API·프론트 저장 연동은 후속 작업입니다.

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
  .aistudio/                 기존 프로토타입 생성 도구 산출물
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

환경별 설정은 아래와 같습니다. 이 값들은 향후 세션 인증을 위한 기반이며 로그인 API는 아직 없습니다.

| 설정 | 개발 환경 | 시연 환경 |
| --- | --- | --- |
| `APP_ENV` | `development` | `demo` |
| `FLASK_DEBUG` | 로컬에서만 `1` 허용 | `0` 필수 |
| `SECRET_KEY` | 지정 권장. 없으면 실행마다 임시 키 생성 | 무작위 32자 이상 필수 |
| `TRUSTED_HOSTS` | 기본 localhost·127.0.0.1·[::1] | 실제 시연 호스트 목록 명시 |
| 세션 쿠키 | HttpOnly, SameSite=Lax | 동일 설정과 Secure 추가. HTTPS 필요 |

시연 모드는 DB 비밀번호도 명시해야 하며 잘못된 필수 설정으로 시작하지 않습니다.
세션 수명은 8시간 기준입니다. 개발 중에도 재시작 간 세션을 유지하려면 고정된 SECRET_KEY를 설정합니다.

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

Notion의 구현 기준안에 맞춰 운영 모델을 아래 5개 테이블로 분리했습니다.

| 테이블 | 용도 |
| --- | --- |
| `app_users` | 로그인 ID, 표시 이름, 비밀번호 해시, 활성 여부 |
| `projects` | 소유자, 제목·분류·대상 DBMS·보관 시각 |
| `project_members` | 프로젝트·사용자 복합 키와 OWNER/EDITOR 역할 |
| `project_documents` | 문서 JSON, 문서·스키마 버전, 수정자 |
| `document_mutations` | 중복 저장 방지에 사용할 요청 ID·해시·결과 버전 |

UUID는 CHAR(36), MariaDB 시간은 UTC DATETIME(6), 문서 버전은 양수 BIGINT를 사용합니다.
FK·고유 제약과 역할·버전 CHECK를 정의했습니다. 인증·권한·CAS 저장·문서 검증 서비스는 후속 구현입니다.
Pydantic와 Flask-WTF는 해당 기능을 구현할 때 추가하며 현재 사용하지 않는 의존성으로 넣지 않았습니다.
설계 화면의 SQL은 결과물이며 운영 DB에서 실행하는 API를 만들지 않습니다.

기존 `0001`은 보존하고 `0002`에서 JSON을 `project_documents`로 이동합니다.
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
