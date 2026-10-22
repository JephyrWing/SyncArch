# GitHub Actions → Cloudtype

대상은 JephyrWing/SyncArch, Cloudtype gad03302/syncarch의 main 배포환경이다.
일반 개발은 기능 브랜치 → develop PR → main PR 순서로 진행한다.
실제 main 릴리스는 PM의 병합 결정 후 진행한다.

## 검사와 배포 경계

| 필수 체크 | 실제 검사 |
| --- | --- |
| frontend-checks | TypeScript, 프런트 단위 테스트, production build, CI 게이트 실패 사례 |
| pytest | 격리 SQLite와 실제 Redis를 쓰는 비브라우저 테스트 |
| mariadb-integration | 운영과 같은 MariaDB 11.2의 행 잠금·경합 전용 검사, migration/schema drift, 실제 DB 컨테이너 재시작 보존 |
| playwright-e2e | production build와 실제 Chrome의 핵심 인증·문서 충돌·편집 UI 저장 5개, Nginx·Waitress 컨테이너 로그인·저장 smoke |

develop/main 대상 PR, main push 및 수동 검사에서 실행한다. develop push의 중복 실행은
제거했다. 같은 PR에 새 커밋이 올라오면 이전 검사를 취소한다. 필수 체크 이름 네 개는
기존 브랜치 보호와 호환되도록 유지한다. pytest 분할은 browser_session fixture와
mariadb/deployment_smoke marker를 사용한다. 공통 비브라우저 검사는 SQLite에서 한 번,
MariaDB 전용 검사는 운영 버전에서 실행한다. 각 단계는 선택한 테스트 1건 이상, skip/error/failure 0건을
요구하며 pytest 실패 코드를 전파한다. 증빙 업로드만 always()로 실행한다.

전체 브라우저 107개(덤프 복원·장애 주입 포함)와 MariaDB 11.2/11.4.13 각각의
전체 백엔드 호환 검사는 `Extended regression (manual)` 워크플로로 보존한다.
Actions에서 해당 워크플로의 Run workflow로 대상 브랜치를 선택해 실행한다.
DB 스키마·저장·인증·복원 동작을 바꾸는 릴리스는 병합 전에 이 회귀 검사도 실행한다.
일반 병합의 필수 체크에 전체 회귀 검사를 추가하지 않는다. Ubuntu 24.04 runner에
설치된 Chrome을 사용하므로 매번 브라우저와 OS 의존성을 다시 설치하지 않는다.
MariaDB CLI 설치는 덤프 복원이 필요한 전체 회귀 검사에만 남긴다.

과거 Linux esbuild 바이너리를 Node 스크립트로 실행하던 오류는 JS build API 사용으로,
내보내기 검사의 로그인 복원 시간 초과는 중복 탐색 제거로 수정돼 있다.
GitHub가 `startup_failure` 또는 테스트 종료 후 진행 중 상태를 반환하면 테스트 실패와
구분한다. run/job 로그와 annotation을 확인하고, 테스트가 끝났는데 상태만 갱신되지 않은
경우 전체 테스트를 반복하거나 브랜치 보호를 우회하지 않는다.

develop과 PR에서는 배포하지 않는다. main push의 같은 워크플로에서 네 체크가
모두 성공해야 배포 job이 시작한다. 사용자 요청에 따라 두 서비스의 Cloudtype
context.git.ref는 `refs/heads/main`으로 명시해 main 브랜치로 유지한다.
Cloudtype가 생성하는 GitHub Actions 설정의 github.ref와 같은 전체 ref 형식이다.
짧은 `main`은 콘솔의 브랜치 설정에 반영되지 않아 기본 브랜치를 선택할 수 있다.
검사한 전체 40자리 SHA는 RELEASE_SHA로
기록하고 공개 응답과 대조한다. 배포 직전 main head를 확인하지만 브랜치는 이동할 수
있으므로 소스 체크아웃의 불변성을 보장하지 않는다. 무료 Git 소스 빌드를 사용하며
GHCR push/pull과 비공개 레지스트리 구독은 사용하지 않는다.
CI는 Nginx·Waitress 컨테이너를 실제 실행하고, Dockerfile의 프런트 재빌드 결과를
검증한 production build의 파일별 SHA-256과 대조한다. Cloudtype의 재빌드 결과가
CI 이미지와 동일하다고 보장하지는 않는다. 실제 공개 SHA·health·저장 smoke가 통과해야
릴리스 성공으로 기록한다.

운영 배포는 cloudtype-production concurrency로 직렬화한다.
실행 중인 배포를 취소하지 않으며, 실제 main head를 대조하여 오래 대기한 SHA를 차단한다.
GitHub concurrency는 대기 실행을 최신 대기 실행으로 대체할 수 있으므로 취소된 실행을
릴리스로 기록하지 않는다. 분기 보호에는 위 네 체크를 required로 지정하고 관리자
우회 없이 PR을 사용한다. Cloudtype Git 직접 자동 배포는 연결하지 않는다.

## 서비스 구성

| 서비스 | 실행/연결 | 메모리 |
| --- | --- | --- |
| syncarch-web | Git 소스 빌드 → Nginx 8080, /api → http://syncarch-api:5000 | 256 MiB |
| syncarch-api (기존 서비스) | Python 3.12.6, Waitress 한 프로세스, 8 threads, 5000 | 256 MiB |
| 기존 mariadb | 현재 서비스와 영속 디스크 유지 | 기존 설정 |

.cloudtype/services.json에는 syncarch-web/기존 syncarch-api만 있다.
두 서비스의 context.path는 저장소 루트(/)로 명시해 기존 UI의 backend/frontend 서브디렉터리 설정을 초기화한다.
기존 MariaDB 512 MiB와 앱 두 개 각 256 MiB로 프리티어 1 GiB 범위에 맞춘다.
프리티어는 매일 중지되므로 상시 가동은 보장되지 않는다.
MariaDB 생성·초기화·seed·drop·버전 변경은 일반 배포에 포함하지 않는다.
백엔드는 DB 준비 확인 → forward flask db upgrade → Waitress 순서로 시작한다.
계정 seed는 별도의 명시적 관리 작업이다. 프런트에 DB/Redis/OAuth secret을 전달하지 않는다.
Presence가 프로세스 메모리를 사용하므로 backend replica를 늘리면 안 된다.
메일 서버는 사용하지 않으며 Redis URL은 합의한 redis:// 설정을 유지한다.

프런트 Dockerfile은 고정 Node 버전과 npm ci로 소스에서 dist를 빌드한다.
배포 도구가 지정한 공개 RELEASE_SHA만 시작 시 release.json에 기록한다.
Nginx는 같은 호스트로 API를 전달하고 Host·쿠키·ETag·304를 유지한다.
컨테이너의 DNS 서버로 백엔드 주소를 5초마다 갱신하며 Kubernetes 검색 도메인을
짧은 서비스명에 적용한다. 백엔드 재배포로 내부 IP가 바뀌어도 프런트 재시작이 필요 없다.
필수 컨테이너 smoke는 DNS 응답 IP를 실제로 바꾸고 같은 Nginx의 복구와 URI 보존을 검사한다.
OAuth callback query가 프록시 로그에 남지 않게 한다.
Waitress는 외부 forwarded header를 신뢰하지 않는다.
Secure 쿠키는 APP_ENV=demo에서 설정하고 OAuth redirect URI는 고정된 공개 URL을 사용한다.

## Cloudtype 환경변수

스테이지에 저장한 같은 이름의 secret을 options.env[].secret으로 참조한다.
이미 적용한 APP_ENV=demo, FLASK_DEBUG=0은 그대로 사용한다.
실제 secret을 GitHub 소스/이미지/증빙에 넣지 않는다.

| 변수 | 값/형식 |
| --- | --- |
| SECRET_KEY, JWT_SECRET_KEY | 각각 별도로 생성한 무작위 32자 이상 값 |
| DB_HOST, DB_PORT | 같은 환경의 MariaDB 호스트와 내부 포트. 보통 mariadb, 3306 |
| DB_NAME, DB_USER, DB_PASSWORD | 기존 DB와 일치하는 앱 접속 정보 |
| REDIS_URL | 인증정보가 포함된 기존 외부 Redis URL |
| TRUSTED_HOSTS | 공개 프런트 호스트명만. 예: example.com |
| ALLOWED_ORIGINS | HTTPS origin. 예: https://example.com (경로·끝 / 없음) |
| GOOGLE_OAUTH_ENABLED | Google 로그인 사용 여부 |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | 기존 Google OAuth 앱 설정 |
| GOOGLE_REDIRECT_URI | https://확정호스트/api/auth/google/callback |
| JWT_ACCESS_TOKEN_EXPIRES, JWT_REFRESH_TOKEN_EXPIRES | 초 단위. 예: 900, 604800 |

배포 주소가 확정되기 전 세 주소 변수는 임의로 채우지 않는다.
demo는 필수 키/호스트/origin이 빠지면 시작을 거부한다.
Google Console에도 동일한 redirect URI를 등록해야 한다.
처음 생성하는 서비스의 도메인은 Cloudtype syncarch-web 서비스 연결 화면에서 확보한다.
초기 도메인 확보·환경변수 입력이 끝나기 전 main 릴리스를 실행하지 않는다.

## GitHub와 Cloudtype 연결 (최초 1회)

GitHub Settings → Environments에 cloudtype-production을 준비하고 배포 브랜치를
main으로 제한한다. 요금제가 지원하면 필요한 검토자 규칙도 적용한다.
다음은 해당 environment의 Secrets/Variables에 저장한다. 값을 채팅에 붙여 넣지 않는다.

| 종류 | 이름 | 용도 |
| --- | --- | --- |
| Secret | CLOUDTYPE_TOKEN | 해당 Cloudtype 스페이스에 배포하는 API key |
| Secret | SMOKE_LOGIN_ID | 별도 smoke 계정 아이디 |
| Secret | SMOKE_PASSWORD | 해당 계정 비밀번호 |
| Variable | DEPLOY_URL | 프런트 공개 HTTPS origin, 끝 / 없음 |

저장소가 공개이므로 HTTPS Git URL로 읽으며 GitHub PAT, GHP_TOKEN, 저장소 배포키가
필요하지 않다. GitHub job은 contents:read만 사용한다. CLOUDTYPE_TOKEN은
cloudtype-production 환경 Secret에 등록했다. main 브랜치만 환경에 접근하며 관리자
우회도 금지한다. Cloudtype 비공개 레지스트리 연결은 현재 유료 기능이므로 사용하지
않는다. 사용자 결정에 따라 무료 Git 소스 빌드로 전환했다.

Cloudtype 공식 deploy action의 고정 소스가 사용하는 HTTP 계약을 Python으로 호출한다.
공식 v1 action의 Node 12 runtime 의존성을 새 워크플로에 넣지 않는다.
대상은 https://app.cloudtype.io/api, gad03302/syncarch, main으로 고정한다.
실패 응답 본문이나 Authorization header를 로그로 출력하지 않는다.

## 릴리스 검증과 복구

공개 /release.json과 /api/release 모두 해당 main SHA인지 확인한다.
이후 health DB ok → 로그인 → 임시 프로젝트 생성 → 실제 문서 저장 → 다시 읽기 →
ETag 304 → 해당 임시 프로젝트 archive → 로그아웃을 수행한다.
HTTP redirect에 인증정보를 전달하지 않는다. smoke 계정은 정상 가입/관리 절차로 준비한다.
운영 DB에 테스트 seed를 실행하지 않는다. smoke는 자신의 임시 프로젝트만 archive한다.
archive된 smoke 프로젝트/활동은 추적 목적으로 DB에 남는다.
실제 Google 왕복 로그인은 별도 검증이며 provider fixture나 비밀번호 smoke로 완료 처리하지 않는다.

검사 실패/skip/0건, 환경 오류, 취소, commit 불일치, 배포 API 실패,
제한 시간 내 공개 smoke 실패 중 하나라도 발생하면 릴리스 실패다.

1. main 자동 배포 진행을 멈추고 실패 run URL, SHA, Cloudtype 배포 이력 ID와 설정 artifact를 기록한다.
2. 직전 공개 smoke가 성공한 run의 cloudtype-release.json과 커밋 SHA를 확보한다.
3. Cloudtype의 성공한 이전 배포 버전 복원을 우선 사용한다. 소스 SHA로 다시 빌드하면
   이전 이미지의 바이트 동일성은 보장되지 않으므로 공개 smoke를 다시 통과해야 한다.
   MariaDB 서비스와 볼륨을 지우지 않는다.
4. migration의 이전 앱 호환성을 확인한다. 자동 downgrade/drop/seed는 실행하지 않는다.
5. 호환되지 않으면 사전 DB snapshot/dump를 별도 DB에 복원·검증한 뒤 계획된 전환을 한다.
6. 복구된 SHA의 health·로그인·실제 read/save smoke를 통과하고 기록한다.

새 migration 배포 전에는 백업과 이전 앱 호환성을 확인한다.
이 파이프라인은 DB 백업이나 호환성 판단을 자동으로 대체하지 않는다.

## 설계 경계와 근거

제품 HTTP 추가는 routes/health의 revision 조회이고 config에서 SHA만 주입한다.
배포 시작/네트워크/Git 소스 지정은 deploy 및 .github/scripts 인프라 코드에 둔다.
제품 controller/service/repository 저장 로직을 배포 도구로 이동하지 않는다.

- [Cloudtype GitHub Actions](https://docs.cloudtype.dev/ko/developers/githubactions)
- [Cloudtype stage secret 참조](https://docs.cloudtype.dev/ko/developers/env)
- [Cloudtype Dockerfile 소스 빌드](https://docs.cloudtype.dev/ko/developers/dockerfile)
- [Cloudtype 공식 deploy 소스](https://github.com/cloudtype-github-actions/deploy/blob/43cf563907c5451c12ecc4461bdbf02e61528d1d/src/action.ts)

