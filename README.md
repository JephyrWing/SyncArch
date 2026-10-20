# SyncArch

React 프로토타입에 Flask + MariaDB 백엔드 기반을 추가한 프로젝트입니다.
프론트엔드 파일은 `frontend/`, Flask 서버는 `backend/`로 분리되어 있습니다.
기존 React 화면, Express 서버(`frontend/server.ts`), 실행 스크립트는 유지합니다.
API URL, 엔드포인트, 프록시, 프론트엔드 데이터 저장 연동은 추가하지 않았습니다.
이미 정한 API 명세에 맞춰 이후 Flask Blueprint를 등록하면 됩니다.

## 구조

```text
frontend/
  src/                       기존 React 프로토타입
  server.ts                  기존 Express/Vite 서버
  package.json               프론트엔드 의존성과 실행 스크립트
  vite.config.ts             Vite 설정
  tsconfig.json              TypeScript 설정
  index.html                 React 진입 HTML
  .env.example               기존 프론트엔드 개발 서버 환경변수 예제
  .aistudio/                 기존 프로토타입 생성 도구 산출물
backend/
  app/
    __init__.py              Flask 앱 팩토리, 확장 초기화, 공통 JSON 오류 처리
    config.py                환경변수와 MariaDB 연결 설정
    extensions.py            SQLAlchemy / Flask-Migrate
    models.py                초기 프로젝트 문서 모델
    commands.py              URL 없이 DB 연결을 확인하는 CLI
  migrations/                Alembic 마이그레이션과 최초 스키마
  tests/                     DB 저장, 마이그레이션, 설정 검증
  .env.example               백엔드 환경변수 예제
  wsgi.py                    WSGI 실행 진입점
compose.yaml                 로컬 개발용 MariaDB
```

## 실행 (Windows PowerShell)

Python **3.12.6**, Node.js, MariaDB가 필요합니다. Compose를 사용할 때는 Docker Desktop도 필요합니다.

### 1. 백엔드 설정

프로젝트 루트에서 실행합니다. 가상환경 활성화 없이도 아래 명령을 사용할 수 있습니다.
이 작업 환경의 Python 3.12.6은 `C:\Python312`에 설치되어 있습니다.
다른 PC에서는 [Python 3.12.6](https://www.python.org/downloads/release/python-3126/)을 설치하고
아래 첫 명령의 실행 파일 경로를 해당 설치 경로로 바꿉니다.
버전 기준은 `backend/.python-version`에도 기록합니다.

```powershell
& C:\Python312\python.exe -m venv backend/.venv
.\backend\.venv\Scripts\python.exe --version # Python 3.12.6
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Copy-Item backend/.env.example backend/.env
```

`backend/.env`의 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`를 설정합니다.
기본값은 로컬 개발용 Compose와 일치합니다. 개별 변수 대신 `DATABASE_URL`을 지정할 수도 있습니다.
개별 DB 변수를 쓰면 비밀번호에 `@`, `#` 같은 문자가 있어도 직접 URL 인코딩할 필요가 없습니다.
DB 계정 정보는 프론트엔드의 `VITE_*` 환경변수에 넣지 않습니다.

### 2. MariaDB 실행

Docker를 사용하는 경우 프로젝트 루트에서 실행합니다.

```powershell
docker compose --env-file backend/.env up -d --wait db
```

Compose는 MariaDB 11.4, UTF-8 연결, 영구 볼륨을 사용하며 포트는 로컬 PC에만 공개합니다.
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

Flask는 기본 개발 포트 5000에서 실행됩니다. 등록한 HTTP 엔드포인트가 없으므로
브라우저로 접속하면 JSON 404가 반환됩니다. 서버 실행 시 테이블은 자동 생성하지 않습니다.
`db-check`는 접속만 확인하며, 스키마 생성은 `db upgrade`로 명시적으로 수행합니다.

개발 서버 대신 Windows에서도 쓸 수 있는 WSGI 서버로 실행하려면 `backend`에서:

```powershell
.\.venv\Scripts\waitress-serve.exe --listen=127.0.0.1:5000 wsgi:app
```

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

React 화면의 프로젝트 데이터는 기존과 같이 메모리에 유지됩니다.
Flask를 실행하는 것만으로 화면 데이터가 DB에 저장되지는 않습니다.

## 모델과 확장 방법

`projects`는 `id`, `title`, `summary`, JSON `data`, UTC 생성·수정 시각을 갖는 초기 모델입니다.
아이디어·기능 명세·아키텍처·ERD 등의 설계 문서를 우선 JSON으로 담을 수 있도록 했습니다.
이는 서비스 자체의 저장 테이블이며, 화면에서 사용자가 설계한 ERD를 실행하지 않습니다.
도메인이 확정되면 필요한 테이블과 관계를 분리하면 됩니다.

모델 변경 후에는 `backend`에서 마이그레이션을 생성하고 검토합니다.

```powershell
.\.venv\Scripts\python.exe -m flask --app app:create_app db migrate -m "describe schema change"
.\.venv\Scripts\python.exe -m flask --app app:create_app db upgrade
```

설정 구조는 [Flask-SQLAlchemy 공식 문서](https://flask-sqlalchemy.palletsprojects.com/en/stable/quickstart/)와
[SQLAlchemy MariaDB/PyMySQL 문서](https://docs.sqlalchemy.org/en/21/dialects/mysql.html)에 맞췄습니다.

## 검증

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

자동 테스트는 SQLite 메모리 DB로 마이그레이션 적용·롤백, 한글/JSON 저장,
CLI 성공·실패 처리, 연결 설정, 미등록 API 상태를 확인합니다.
MariaDB 드라이버와 실제 DB 연결은 별도로 MariaDB를 실행한 뒤 `db-check`, `db upgrade`로 확인합니다.
