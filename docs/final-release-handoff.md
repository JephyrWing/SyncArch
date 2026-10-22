# 최종 릴리스·시연·운영 인계

작업자: PM 최진우. 이 문서는 최종 통합 작업 중 작성한 인계 절차다. 아래 절차 자체를 실행 성공으로 간주하지 않는다. 최종 SHA·CI·공개 점검·Google·복구 결과는 실행 후 원본 카드와 함께 확정한다.

공개 주소: https://port-0-syncarch-web-mvitjtbx0d2bcfd2.sel3.cloudtype.app

## 계정과 시연 준비

서로 다른 두 브라우저 context에서 정상 가입한 전용 OWNER/EDITOR 계정을 사용한다. 실제 비밀번호·Google 인증 코드·환경변수는 문서나 채팅에 남기지 않는다. 가입/로그인 후 OWNER가 자기 시연 프로젝트를 생성하고 코드로 EDITOR를 초대한다. 기존 사용자의 프로젝트를 시연 데이터로 수정하지 않는다.

1. 가입/비밀번호 로그인 → 자기 프로젝트 생성 → 초대 코드 확인·재발급 → 구코드 실패·새 코드 EDITOR 가입을 보여 준다. 재발급 뒤 기존 멤버 권한과 중복 가입 방지를 확인한다.
2. 아이디어 트리와 결정 사유 → 기능/API의 아이디어 연결·상태 → 아키텍처 노드·통신선 → ERD 테이블·컬럼·FK·기능 연결 순서로 편집한다.
3. 두 계정에서 같은 프로젝트를 열고 서로 다른 필드 반영, 저장됨 표시, 새로고침 복원을 확인한다. 같은 필드 동시 편집은 실제 409·최신 기준 재병합·후속 저장·재조회 증빙과 연결한다. 오류 시 초안 백업·재시도도 설명한다.
4. 삭제 영향 확인의 취소/확정과 참조 정리를 확인한다. 저장본 Markdown/SQL과 API 명세를 내보낸다. SQL은 앱 운영 DB에 실행하지 않는다.
5. OWNER의 보관 → 읽기 전용·초대 불가 → 복원 → 기존 코드/권한 유지와 로그아웃을 보여 준다.

360px, 768px, 1024~1440px와 데스크톱에서 헤더 단계 이동·초대·저장·내보내기·모달 조작을 확인한다. ERD 표의 내부 가로 스크롤은 허용하고 페이지 전체의 비의도적 넘침은 결함으로 구분한다.

## 릴리스와 운영

기능 PR은 develop에, 통합 develop은 main PR로 정상 병합한다. 필수 CI 네 개와 해당 변경의 Extended regression 성공을 확인한다. main push의 자동 배포가 기존 Cloudtype `gad03302/syncarch`, stage `main`의 web/api를 재배포한다. `refs/heads/main`·저장소 루트 context·Nginx/단일 Waitress·기존 MariaDB 디스크/Redis·환경 Secrets를 유지한다. 상세 절차는 [cloudtype-cicd.md](cloudtype-cicd.md)를 따른다.

공개 `/release.json`·`/api/release`를 main SHA와 대조한 뒤 DB health, 전용 계정 login/me, 자기 임시 프로젝트 생성→문서 저장→재조회/version 증가→ETag304→보관→CSRF 로그아웃과 이번 초대 정책을 확인한다. Git 소스 재빌드와 RELEASE_SHA 메타데이터는 Cloudtype 산출물 바이트가 CI와 동일함을 보장하지 않는다.

Google 운영 왕복은 기존 계정 비밀번호 로그인→재확인 후 최초 명시 연결→로그아웃→Google 로그인→동일 UUID·프로젝트 권한→새로고침 세션 복구→로그아웃을 별도로 기록한다. 사람의 계정 선택·2단계 인증이 필요한 단계는 인증 담당자에게 인계한다. 이메일 일치 자동 연결은 사용하지 않는다.

## 복구 훈련

직전 성공 배포의 이력 ID·SHA·설정과 최종 버전의 migration 호환성을 먼저 확인한다. 운영 DB 백업은 접근 제한된 위치에 보관하고 별도 격리 DB에만 복원한다. 문서·버전·참조·계정/identity·채팅 보존과 새 Flask의 읽기·인증을 확인한다. 기존 테스트 DB의 dump/restore 성공은 운영 DB 백업 복원 성공과 구분한다.

이전 배포 복원 시 운영 편집 세션·데이터 호환성과 최종 버전 복귀 경로를 확인한다. 안전하지 않으면 격리 환경에서 이전 버전→핵심 동작→최종 버전 복귀를 훈련하고, 운영 전환을 직접 실행했다고 기록하지 않는다. 운영 DB에 복원본 덮어쓰기·자동 downgrade/drop/seed는 하지 않는다.

## 원본 기록과 완료 판정

- [시작 안내](https://docs.google.com/document/d/1Sjji_rYH9IGK3B1my0bJkTuG00O4YIq-GgyRKKngpBQ/edit)
- [작업보드·테스트·실행 이력](https://docs.google.com/spreadsheets/d/1JnjU4kCS4aHQmJRLedZDBSlAlVH_vvFbuFb42zkBTh8/edit)
- [결정·변경 기록](https://docs.google.com/document/d/1GachILOZYokii5l6n3acJqWZtc3on4vcxssMFNwe5CI/edit)
- [W13 운영 배포 카드](https://docs.google.com/document/d/1y4g9Z9Rg26qhkHN2_rgWbhK3OO0v1-rDc4JX6WJz2H4/edit)

W04의 구현·검증 완료와 실제 병합/배포를 구분한다. W11/W15는 고유 PR 통합과 통합 검증, W12는 실제 CI, W13은 공개 배포·Google·복구의 실제 결과, W01은 문서 일치, W14는 시연·제출·인계 산출물을 기준으로 판정한다. 미검증 항목은 삭제하거나 형식상 완료로 바꾸지 않는다.
