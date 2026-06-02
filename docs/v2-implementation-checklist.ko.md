# V2 구현 체크리스트

상태 기준:

- **통합 반영 완료**: 제품 방향, 데이터 필드, README, 백로그, 검증 문서에 반영됨
- **구현 완료**: 사용자가 앱에서 실제로 기능을 사용할 수 있음
- **남은 구현**: V2에서 아직 만들어야 할 기능

## 이번 통합에서 구현까지 완료된 것

- 8개 언어 선택: 한국어 기본, 영어, 일본어, 중국어, 독일어, 프랑스어, 이탈리아어, 힌디어
- CSV 내보내기
- 구매 항목의 홈/서비스 맥락 필드
  - 카테고리
  - 방 또는 위치
  - 고객센터/수리/시공 연락처
  - 영수증, 매뉴얼, 보증서 등 문서명
  - 수리 또는 서비스 이력 메모
- 증빙팩에 문서명, 서비스 이력, 홈/서비스 맥락 포함
- 로컬 영수증/PDF/매뉴얼 첨부 파일 저장, 5MB 초과 제외 상태 표시, 상세 화면 다운로드
- CSV 구매내역 미리보기, built-in/user preset/수동 컬럼 매핑, 중복 감지, 오류 행 제외 후 가져오기
- 한국 카드명세서, 한국 쇼핑몰 주문내역, Amazon-style 주문내역 CSV 프리셋
- CSV import review checklist, 정상 행별 포함/제외 선택, import report JSON, CSV preset bundle JSON 호환성 검증/내보내기/가져오기
- 로컬 텍스트/CSV/HTML 이메일 영수증/기본 PDF text operator/압축 또는 스캔 PDF fallback/스캔 PDF용 로컬 OCR sidecar 붙여넣기와 `.txt` 파일 첨부/지원 브라우저의 이미지 OCR 추출 후 영수증 파서 연결
- 사용자 확인형 정책 템플릿: 표준 30일 반품, 60일 확장 반품, 보증 전용, final sale/no return, 한국 온라인 구매 검토
- 정책 템플릿의 증빙 요구사항, source/version/last reviewed metadata, 국가/관할권 면책 노트
- CSV/HTML 영수증/PDF text operator/정책 템플릿 synthetic fixture corpus
- private sample을 fixture로 만들기 전 로컬에서 치환하는 익명화 도구
- fixture validation script: 개인정보 패턴, CSV fixture importability, 정책 source/license metadata 검증
- 사전 알림 일수 저장, `.ics` `VALARM` 내보내기, 앱이 열려 있을 때의 브라우저 로컬 알림
- 앱이 열려 있을 때의 알림 큐와 3시간/내일까지/7일 스누즈
- ntfy/Gotify/Apprise용 self-hosted 알림 설정 로컬 저장, payload 초안 JSON, dry-run report 내보내기
- self-hosted notification runner dry-run CLI: payload JSON 검증, 명령 미리보기, endpoint-only check 계획, 토큰 미저장
- self-hosted notification runner opt-in send guard: `--send --yes`와 `RWG_NOTIFY_SEND=1` 요구, Gotify token 환경변수 전용
- 출력용 클레임 HTML 생성, 로컬 첨부 링크/이미지 미리보기/PDF 저장 가이드/첨부 매니페스트 포함, 브라우저 인쇄 대화상자를 통한 PDF 저장 흐름
- 클레임 제출 템플릿: 판매처 반품 요청, 보증 지원 요청, chargeback 증빙 요약, 수리 접수 메모
- 클레임 번들 JSON/ZIP: 구매 레코드, 마감 계산, Markdown 증빙팩, claim HTML, 제출 템플릿, 로컬 첨부 data URL 및 첨부 파일 포함
- `return-guardian`과 `home-memory-ledger`의 통합 방향 문서화

## V2 마일스톤별 남은 구현

### v0.2: 로컬 데이터 내구성과 가져오기

1. **실제 첨부 파일 저장**
   - 현재 구현: 영수증 이미지/PDF/매뉴얼 파일을 브라우저 로컬 구매 레코드에 저장하고 상세 화면에서 다운로드 가능
   - 현재 구현: 파일 크기 제한 안내, 5MB 초과 파일 제외 상태 표시, 상세 화면 첨부 체크리스트, claim HTML 이미지 미리보기, claim ZIP 첨부 파일과 첨부 매니페스트 포함
   - 현재 구현: 지원 브라우저에서는 OPFS Blob 분리 저장을 사용하고, 미지원 브라우저에서는 data URL 저장으로 폴백하며, 다운로드/claim export 직전에 OPFS 첨부를 data URL로 hydration
   - 남은 구현: 첨부 전용 복구/마이그레이션 UX, encrypted export bundle과 연동한 장기 복구 흐름

2. **CSV import**
   - 현재 구현: CSV 파일을 import preview에서 확인하고, 자동 감지/built-in preset/user preset/수동 컬럼 매핑으로 정상/중복/오류 행을 분리한 뒤 정상 행만 추가
   - 현재 구현: import report JSON으로 매핑/정상/중복/오류 결과 내보내기
   - 현재 구현: 현재 매핑을 사용자 preset으로 localStorage에 저장/삭제
   - 현재 구현: 한국 카드명세서, 한국 쇼핑몰 주문내역, Amazon-style 주문내역 프리셋과 한국어/영어 주요 헤더 alias
   - 현재 구현: 개인정보 없는 synthetic CSV fixture corpus로 한국 카드 명세서, 한국 쇼핑 주문, Amazon-style order, Shopify-style order, Stripe-style receipt 프리셋 회귀 테스트
   - 현재 구현: private sample을 테스트 fixture 후보로 바꾸기 위한 로컬 익명화 스크립트, anonymization report, intake entry draft 생성, 단일/복수 incoming sample 후보를 manifest 병합 전 검증하는 `npm run fixture:review` / `npm run fixture:review-batch` CLI
   - 현재 구현: sample intake manifest로 익명화 여부, parser 검토 여부, fixture path, source shape coverage target, provenance, 재사용 허가, 원본 샘플 미보관, 비민감 contributor handle을 검증
   - 현재 구현: `npm run fixture:validate`로 개인정보 패턴, CSV fixture importability, 정책 source/license metadata 검증
   - 현재 구현: `npm run fixture:coverage`로 fixture type/source/provenance별 현황과 synthetic-only 상태, 실제 커뮤니티/public-open-license 샘플 부재 여부를 Markdown으로 표시
   - 현재 구현: `npm run fixture:request-pack`으로 실제 샘플 기여자에게 전달할 개인정보 보호형 요청 패키지, intake entry 템플릿, maintainer gate 명령을 Markdown으로 생성
   - 현재 구현: import review checklist로 필수 매핑/중복/오류/증빙 누락을 확인하고, 정상 행을 포함/제외 선택한 뒤 확정 import
   - 현재 구현: CSV preset bundle JSON 내보내기/가져오기와 schema/version/field 호환성 검증
   - 현재 구현: preset bundle trust model/source/reviewedAt/fixtureCoverage metadata, SHA-256 fingerprint-ready signing payload, ECDSA P-256 detached signature 검증 helper, review manifest, trusted public key registry fixture, key rotation/revocation governance fixture, signed preset bundle fixture, 대량 row query/proof review filter helper
   - 남은 구현: 익명화된 실제 사용자 샘플 기반의 카드사/판매처별 fixture 확대, 실제 maintainer/community key rotation 운영과 registry governance

### v0.3: 입력 자동화와 정책 보조

3. **로컬 OCR과 영수증/정책 추출**
   - 현재 구현: 텍스트/CSV/HTML 이메일 영수증/기본 PDF text operator를 브라우저에서 읽고, 브라우저가 로컬 `TextDetector`를 제공할 때 이미지 OCR 결과를 영수증 파서로 연결
   - 현재 구현: 압축/스캔 PDF처럼 text operator가 없는 파일은 cloud OCR 대신 로컬 fallback 안내를 표시하고, 사용자가 로컬 OCR 도구에서 얻은 sidecar 텍스트를 붙여넣거나 `.txt` 파일로 첨부하거나 PDF와 같은 이름의 `.ocr.txt`를 함께 선택하면 영수증 파서로 연결
   - 현재 구현: 브라우저가 이미지 OCR을 지원하지 않을 때 cloud OCR 대신 붙여넣기 fallback을 안내
   - 현재 구현: 사용자가 확인해서 적용하는 정책 템플릿으로 반품/환불/보증 기본값, 증빙 요구사항, source/version/last reviewed, 국가/관할권 면책 메모를 채움
   - 현재 구현: HTML 이메일 영수증, PDF text operator, 압축/스캔 PDF fallback 진단, local OCR text result, 정책 템플릿 source URL/license metadata fixture corpus로 회귀 테스트
   - 현재 구현: local OCR engine plan adapter: bundled SVG fixture worker, browser TextDetector, manual fallback을 no-cloud 기준으로 판정
   - 현재 구현: OCR engine manifest로 지원 MIME type, license, no-network/no-storage, fixture coverage를 검증
   - 현재 구현: synthetic SVG OCR fixture로 bundled worker 이미지 경로와 영수증 파서 연결을 회귀 테스트
   - 현재 구현: scanned PDF fixture와 local OCR text sidecar manifest를 연결해 no-cloud 스캔 PDF 파서 회귀 테스트, 브라우저 QA에서 스캔 PDF fallback, sidecar 붙여넣기, sidecar 파일 첨부, PDF + matching `.ocr.txt` 자동 페어링 파싱 흐름 검증
   - 남은 구현: 실제 범용 번들형 이미지 OCR 엔진 탑재, 실제 스캔 PDF OCR 자동화, 실제 판매처 정책 fixture 확대, 실제 출처 URL/라이선스 검토

4. **서버 없는 알림 경험 고도화**
   - 현재 구현: 구매별 사전 알림 일수 저장, `.ics` 캘린더 내보내기, `.ics` 반복 `VALARM` 사전 알림, 앱이 열려 있을 때의 브라우저 로컬 알림 버튼
   - 현재 구현: 앱 안의 캘린더 가져오기 가이드로 모바일/PC 캘린더 경로 안내
   - 현재 구현: 앱이 열려 있을 때의 알림 큐와 3시간/내일까지/7일 스누즈, 스누즈 전체 해제
   - 현재 구현: ntfy/Gotify/Apprise에 사용자가 직접 적용할 수 있는 opt-in self-hosted 알림 설정을 로컬 저장하고 payload/curl 초안에 반영
   - 현재 구현: provider/endpoint/topic 설정, 토큰 미저장, 외부 runner 필요 여부를 dry-run report로 검증
   - 현재 구현: `npm run notify:dry-run` CLI로 payload JSON을 읽고 provider별 명령 미리보기와 endpoint-only check 계획을 생성
   - 현재 구현: CLI opt-in send mode는 `--send --yes`와 `RWG_NOTIFY_SEND=1`을 요구하고, Gotify token은 환경변수로만 받음
   - 현재 구현: ntfy/Gotify/Apprise provider별 synthetic payload fixture, endpoint-only dry-run plan 검증, send mode 운영 문서, macOS/Linux/Windows scheduler recipe 생성, ntfy/Gotify loopback endpoint smoke test, opt-in public endpoint smoke mode, raw endpoint를 출력하지 않는 public smoke readiness report, scheduled/manual GitHub Actions smoke workflow, sanitized smoke result record, smoke freshness/coverage policy, 여러 sanitized smoke record의 freshness/provider coverage를 점검하는 audit CLI, sanitized smoke record를 Markdown 운영 리포트로 요약하는 `notify:ops-report`, GitHub Actions sanitized smoke artifact와 ops report 검증/업로드, 모바일/PC fallback guide
   - 남은 구현: 실제 public/self-hosted endpoint smoke 설정과 기록을 유지관리자가 별도 환경에서 지속 관리

### v0.4: 클레임/홈 히스토리 출력

5. **클레임 패킷 HTML/PDF**
   - 현재 구현: 출력용 HTML 클레임 패킷 생성, 브라우저 인쇄 대화상자를 통한 PDF 저장, 브라우저별 PDF 저장 가이드, 클레임 프로필/관할권 힌트, 문서명/첨부 링크/이미지 미리보기/첨부 매니페스트/첨부 export review/시리얼/수리 이력/제출 전 확인 메모 포함, claim bundle JSON/ZIP으로 증빙 데이터 묶음 내보내기
   - 현재 구현: 판매처 반품 요청, 보증 지원 요청, chargeback 증빙 요약, 수리 접수 메모 템플릿을 HTML/JSON/ZIP에 포함
   - 남은 구현: 판매처/국가별 템플릿 커스터마이즈 심화, 템플릿 문구 현지화

6. **홈 설비/수리 이력 모델 확장**
   - 현재 구현: 구매 항목 안의 서비스 이력 메모
   - 남은 구현: asset, repair event, contractor, document를 별도 구조로 분리하고 Home History/Claim Report 생성

### v1.0: 릴리스 준비 수준

7. **클라우드 없는 크로스디바이스 연속성**
   - 현재 구현: JSON export/import
   - 남은 구현: 암호화 백업, 로컬 네트워크 동기화, self-hosted sync 옵션

8. **가격보호/리콜/안전 노트**
   - 현재 구현: 없음
   - 남은 구현: 가격 조정 기간 추적, 제품 리콜 참고 링크, 국가별 출처/면책 문구

9. **Polished PWA release**
   - 현재 구현: manifest와 service worker 기본 구조
   - 현재 구현: `npm run release:readiness`로 OSS 릴리스 준비 상태와 2/3/4 잔여 항목을 Markdown으로 요약
   - 남은 구현: install QA, offline fallback UX, release screenshots, accessibility pass

## 결론

V2의 미해결 불편사항은 제품/문서/데이터 방향에 반영되었고, 1번 실제 첨부 파일 저장은 OPFS Blob 분리 저장/폴백/hydration까지 보강되었으며, 5번 클레임 패킷 HTML/PDF는 브라우저별 PDF 저장 가이드/클레임 프로필/첨부 export review까지 보강되었습니다. 남은 2,3,4는 익명화된 실제 사용자/커뮤니티 샘플 기반 import fixture 확대, 실제 범용 번들형 크로스브라우저 OCR과 실제 스캔 PDF OCR 자동화, 유지관리자 별도 환경의 recurring public/self-hosted endpoint smoke 운영입니다.
