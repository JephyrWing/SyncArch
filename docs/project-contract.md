# 현재 구현 계약

PM 최진우가 최종 릴리스를 준비하며 코드 기준으로 현행화한 문서다. 원본 설계와 과거 실행 이력은 보존한다. 배포 완료 여부와 실제 검증 SHA는 릴리스 인계와 원본 작업보드에서 별도로 확인한다.

## 구성과 책임

React/Vite 편집기는 Flask HTTP API를 호출한다. 운영 프런트는 Nginx가 정적 파일과 `/api` 프록시를 제공하고, 백엔드는 Python 3.12.6·Waitress 단일 프로세스로 실행한다. MariaDB는 문서·계정·멤버·활동·identity·채팅을, 외부 Redis는 JWT refresh/OAuth 상태를 보관한다. Presence는 프로세스 메모리이므로 백엔드 replica를 늘리지 않는다. 실제 배포 설정은 [운영 안내](cloudtype-cicd.md)를 따른다.

View/Hook는 표시·입력·저장 상태를, routes는 HTTP 변환을, schemas는 입력 계약을, services는 권한·트랜잭션을, repositories는 DB 질의를 담당한다. 클라이언트가 보낸 사용자 ID나 역할로 권한을 결정하지 않는다.

## 계정과 프로젝트 권한

일반 가입은 `POST /api/auth/register`의 `loginId/displayName/password/email?`로 진행한다. 비밀번호 로그인 후 access token은 메모리에만 보관하고 refresh token은 HttpOnly 쿠키로 받는다. 새로고침은 CSRF 토큰과 refresh rotation으로 세션을 복구한다. 다중 탭은 Web Locks 지원 시 refresh를 직렬화한다. 로그아웃은 Origin·CSRF 검증 후 세션을 폐기한다.

Google 최초 연결은 기존 계정으로 로그인한 뒤 비밀번호를 다시 확인하는 명시 연결이다. 이메일이 같다는 이유로 자동 연결하지 않는다. Google subject와 사용자 UUID 연결을 저장하며, 이후 Google 로그인도 같은 계정과 프로젝트 권한을 사용한다. provider fixture·로컬 callback·공개 Google 왕복 결과는 구분한다.

프로젝트 생성자는 OWNER이고 초대 코드 가입자는 EDITOR다. 멤버십은 요청마다 DB에서 확인한다. 비멤버의 프로젝트 접근은 404, EDITOR의 OWNER 작업은 403으로 거부한다. 보관본은 읽기 전용이다. 보관 중 OWNER를 포함한 초대 조회·재발급·신규 가입은 `403 PROJECT_ARCHIVED`이며 코드가 없던 보관본에 GET으로 코드를 만들지 않는다. 복원은 기존 코드를 자동 회전하지 않는다. 재발급은 기존 멤버·역할을 바꾸지 않고 구코드를 무효화하며 반복 가입은 멤버십을 중복 생성하지 않는다.

## 문서 v2와 원자 저장

한 프로젝트의 문서는 `schemaVersion: 2`이며 `ideas/features/nodes/connections/tables`를 포함한다. 항목은 안정적인 UUID로 연결한다. 프로젝트 메타데이터와 전체 payload·version·mutation 결과·활동을 하나의 트랜잭션으로 저장한다. dangling 참조와 유효하지 않은 FK를 서버에서도 거부한다. JSON 요청 크기 한도는 1 MiB다.

```http
GET /api/projects/{projectId}/document
Authorization: Bearer <access token>
If-None-Match: "{projectId}:7"
```

변경된 문서는 `200 {"data": {"version": 8, "payload": {...}, ...}}`와 ETag로, 변경이 없으면 304로 반환한다. PUT 예시에서 실제 UUID와 현재 서버의 메타데이터·전체 payload를 사용한다.

```json
{
  "baseVersion": 8,
  "mutationId": "새 UUID",
  "project": {"title": "시연", "summary": "검증", "categoryTag": "", "targetDbms": "mariadb"},
  "payload": {"schemaVersion": 2, "ideas": [], "features": [], "nodes": [], "connections": [], "tables": []}
}
```

메타데이터의 DBMS 등 열거형은 실제 schema 계약을 따른다. 같은 mutationId·같은 본문 재시도는 최초 결과를 반환하고, 같은 키의 다른 본문은 거부한다. 오래된 baseVersion은 409 `VERSION_CONFLICT`, 잘못된 문서는 422 `DOCUMENT_INVALID`, 크기 초과는 413이다. 오류 응답은 `{"error":{"code":"...","message":"..."}}`다. 거부·롤백 시 기존 문서와 활동을 부분 변경하지 않는다.

## 협업·참조·내보내기

문서 저장 지연은 300ms, 조회는 1초 HTTP 폴링이며 동시 저장 요청은 직렬화한다. 409에서는 공통 조상·내 변경·최신 원격 문서를 3-way 병합해 새 기준 버전과 mutationId로 재시도한다. 같은 필드는 해당 클라이언트의 편집을 우선하고 삭제/수정 경합은 편집을 보존한다. 연속 충돌 3회 뒤 자동 저장을 멈추며 초안 백업과 재시도를 제공한다. WebSocket 전송은 현재 제품 계약이 아니다.

아이디어 하위 트리 삭제는 기능의 관련 아이디어 참조도 정리한다. 기능 삭제는 테이블·컬럼의 기능 연결을 해제한다. 노드 삭제는 연결선을, 테이블·컬럼 삭제는 모든 활성 FK 표시·참조를 정리하며 관련 없는 항목을 보존한다. 영향 확인을 취소하면 서버 저장본을 바꾸지 않는다.

내보내기는 서버에서 다시 읽은 한 저장 버전으로 Markdown·SQL을 생성한다. 생성 SQL을 앱 운영 DB에서 실행하지 않는다. API 명세 xlsx도 프로젝트 권한을 검사한다. 채팅은 HTTP 폴링과 `(since, afterId)` 커서를 사용하고 메시지 ID 재시도로 중복을 방지한다.

## W01·TC-OPS-W01 추적

W01의 문서 v2/CAS는 `document_schema.py`, `document_service.py`, `useProjectDocument.ts`와 원자 저장·멱등·실제 409 브라우저 검사에 연결한다. 인증·명시 연결은 auth/OAuth 서비스와 인증 검사, 권한·보관·초대는 project/invite 서비스와 TEAM01 검사, 참조 정리는 ERD/아키텍처 브라우저 및 단위 검사, 운영 구성은 배포 안내와 릴리스 smoke에 연결한다. TC-OPS-W01은 이 설명과 실제 코드·원본 설계·시작 안내·하네스의 일치 여부를 검토하는 문서 검사다. 이를 새로운 제품 기능 검사로 집계하지 않는다.

TC-SAFE-01은 `test_erd_workspace_browser.py`의 아이디어/노드 삭제, 기능 삭제 연결 정리, 컬럼 삭제 모든 참조 정리, 테이블 삭제 취소/확정 검사와 `ideaTree/erdLinks/collab/mergeDocument` 단위 검사를 매핑한다. 기존 증빙을 유지하며 최종 통합 코드의 실제 실행 결과를 추가한다.
