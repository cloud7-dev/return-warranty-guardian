# GitHub 저장소 통합 검토

검토일: 2026-06-02

대상 GitHub 저장소:

- [cloud7-dev/return-warranty-guardian](https://github.com/cloud7-dev/return-warranty-guardian)
- [cloud7-dev/return-guardian](https://github.com/cloud7-dev/return-guardian)
- [cloud7-dev/home-memory-ledger](https://github.com/cloud7-dev/home-memory-ledger)

## 결론

`return-guardian`과 `return-warranty-guardian`은 사실상 같은 제품입니다. 둘 다 로컬 우선 구매 메모리, 영수증, 반품기한, 환불기한, 보증기간을 다루며 서버 업로드가 없다는 메시지도 같습니다.

`home-memory-ledger`는 같은 제품은 아니지만 V2 확장 축으로 흡수할 수 있습니다. 특히 가전/설비의 방/위치, 모델/시리얼, 매뉴얼, 수리 이력, 시공/수리 연락처, 홈 히스토리 리포트는 보증 클레임과 직접 연결됩니다.

따라서 통합 기준 저장소는 `return-warranty-guardian`으로 두고, 나머지 두 저장소의 기능을 이 제품의 V2 기능군으로 흡수하는 것이 맞습니다.

## 저장소별 중복/차이

### Return & Warranty Guardian

현재 기준 저장소입니다.

- 반품, 환불, 보증 기한 계산
- 영수증 텍스트 파서
- IndexedDB 저장 및 localStorage fallback
- JSON, ICS, Markdown 증빙팩 내보내기
- PWA manifest/service worker
- 다국어 UI

### Return Guardian

동일 제품의 짧은 이름 구현입니다.

- 구매 등록
- 반품/환불/보증 마감 대시보드
- 영수증 이미지/PDF 첨부 방향
- CSV/JSON export
- IndexedDB local-first 저장

흡수할 기능:

- CSV export
- 첨부/문서 메타데이터
- 오늘/이번 주/보증 임박처럼 더 명확한 마감 그룹

### Home Memory Ledger

가정 이력 장부 제품입니다.

- 가전/설비/마감재 자산 기록
- 방/위치, 브랜드, 모델, 시리얼, 설치일, 보증일
- 수리/서비스 이벤트
- 영수증, 매뉴얼, 인보이스, 공사 사진 문서 기록
- 시공/수리 연락처
- 홈 히스토리 리포트

흡수할 기능:

- 구매 항목에 방/위치, 카테고리, 지원/수리 연락처 추가
- 문서명/매뉴얼/보증서 메타데이터 추가
- 수리/서비스 이력 메모 추가
- 향후 Home History / Claim Packet 리포트로 확장

## 이번 통합 반영

`return-warranty-guardian`에 다음을 반영했습니다.

- 언어 선택지: 한국어, 영어, 일본어, 중국어, 독일어, 프랑스어, 이탈리아어, 힌디어
- CSV 내보내기
- 카테고리
- 방/위치
- 고객센터 또는 수리/시공 연락처
- 영수증, 매뉴얼, 보증서 등 문서명
- 수리 또는 서비스 이력
- 증빙팩에 문서/서비스/홈 맥락 포함

## 통합 후 제품 포지셔닝

Return & Warranty Guardian은 단순 반품 알림 앱이 아니라, 구매 후 생애주기를 로컬에서 기억하는 개인 증빙 데스크입니다. MVP는 반품/환불/보증 마감에 집중하고, V2는 가전/설비/서비스 이력과 문서 보관을 흡수해 보증 클레임과 홈 히스토리 리포트까지 확장합니다.

## 권장 저장소 정리

1. `return-warranty-guardian`을 메인 저장소로 유지합니다.
2. `return-guardian` README에는 `return-warranty-guardian`으로 이동했다는 안내를 남기거나 archive합니다.
3. `home-memory-ledger`는 별도 실험 저장소로 남기되, 핵심 기능은 V2 backlog로 흡수합니다.
4. GitHub topics는 `warranty-tracker`, `receipt-tracker`, `home-inventory`, `home-maintenance`, `local-first`, `privacy-tools`, `offline-first`, `pwa`, `i18n`, `multilingual` 중심으로 맞춥니다.
