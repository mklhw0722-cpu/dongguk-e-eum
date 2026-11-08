# 동국e음 디자인 참고서 (Awesome DESIGN.md 모음)

이 폴더는 글로벌 유수 서비스들의 실제 디자인 시스템 분석 명세서(`DESIGN.md`)를 보관하는 참고용 서재입니다.  
출처: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)

새로운 기능을 기획하거나 UI/UX를 고도화할 때, 각 서비스의 디자인 패턴을 벤치마킹하여 동국e음 디자인 시스템(`DESIGN.md` 및 `docs/design-system.md`)에 녹여낼 수 있습니다.

---

## 📚 보관된 벤치마크 레퍼런스

| 파일명 | 서비스 | 벤치마크 추천 영역 | 핵심 디자인 특징 |
|---|---|---|---|
| [cal.md](./cal.md) | **Cal.com** | 학사 캘린더, 지도교수 상담 예약 UI | 여백 중심의 모던 SaaS, 12px 둥근 카드, 직관적인 시간 선택 |
| [linear.md](./linear.md) | **Linear** | 게시판 목록, 공지 필터, 상태 뱃지 | 미세한 헤어라인 테두리, 초정밀 목록 간격, 단축키 및 정렬 |
| [notion.md](./notion.md) | **Notion** | 졸업요건 자가진단, 진로 가이드 문서 | 가독성 높은 텍스트 계층, 깔끔한 구분선, 문서 중심 미니멀리즘 |
| [stripe.md](./stripe.md) | **Stripe** | 관리자 센터 통계, 학점 표기, 인증 카드 | 명확한 대비, 고밀도 데이터 카드, 정갈한 표(Table) 레이아웃 |
| [airbnb.md](./airbnb.md) | **Airbnb** | 졸업생 동문 네트워크, 프로필 탐색 카드 | 부드러운 호버 반응, 큼직한 태그/뱃지, 시각적 카드 그리드 |
| [claude.md](./claude.md) | **Claude** | 학과 전용 대화창(메신저), 멘토링 질의응답 | 따뜻한 톤앤매너, 눈이 편안한 말풍선과 읽기 쉬운 본문 서체 |

---

## 💡 활용 방법

1. **AI 에이전트에게 지시할 때**:
   - 예: *"동국e음의 캘린더 일정을 수정할 때 `docs/design-references/cal.md`의 모던 카드 배치 스타일을 참고해서 만들어 줘."*
   - 예: *"게시판 필터 칩을 `docs/design-references/linear.md`처럼 깔끔하게 다듬어 줘."*

2. **우리 프로젝트의 공식 디자인 규칙**:
   - 벤치마크는 참고용이며, 프로젝트의 실제 코드는 루트에 있는 **[DESIGN.md](../../DESIGN.md)**와 **[docs/design-system.md](../design-system.md)**의 색상 토큰과 원칙을 엄격하게 준수합니다.
