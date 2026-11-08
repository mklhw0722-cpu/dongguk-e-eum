---
version: alpha
name: Dongguk-e-eum-Design-System
description: "동국대학교 사범대학 교육학과 전용 학과 플랫폼 '동국e음(Dongguk e-eum)'의 공식 디자인 시스템 명세서입니다. Google Stitch 및 Awesome DESIGN.md 표준 형식을 따르며, 따뜻하고 신뢰감 있는 동국대 고유 오렌지(#ea580c)를 포인트로 하는 클린 라이트 모드(Clean Light Mode) 인터페이스입니다. AI 에이전트와 개발자가 일관되고 완성도 높은 UI/UX를 구축할 수 있도록 색상 토큰, 타이포그래피, 컴포넌트 사용 규칙 및 반응형 레이아웃 가이드를 정의합니다."

colors:
  primary: "#ea580c"
  primary-hover: "#c2410c"
  primary-soft: "#fff7ed"
  primary-border: "#fed7aa"
  on-primary: "#ffffff"
  
  canvas: "#f8fafc"
  surface: "#ffffff"
  surface-2: "#f1f5f9"
  surface-3: "#e2e8f0"
  
  line: "#e2e8f0"
  line-strong: "#cbd5e1"
  
  ink: "#0f172a"
  ink-2: "#334155"
  ink-3: "#64748b"
  ink-inverse: "#ffffff"
  
  # 학과 4대 사용자 역할(Role) 고유 색상
  role-student: "#ea580c"
  role-student-soft: "#fff7ed"
  role-alumni: "#16a34a"
  role-alumni-soft: "#f0fdf4"
  role-professor: "#0284c7"
  role-professor-soft: "#f0f9ff"
  role-admin: "#7c3aed"
  role-admin-soft: "#f5f3ff"
  
  # 상태(Semantic) 색상
  success: "#16a34a"
  success-soft: "#f0fdf4"
  warning: "#d97706"
  warning-soft: "#fffbeb"
  danger: "#e11d48"
  danger-soft: "#fff1f2"
  info: "#0284c7"
  info-soft: "#f0f9ff"

typography:
  fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif"
  fontMono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  
  display:
    fontSize: "24px"
    lineHeight: "1.3"
    fontWeight: "900"
    letterSpacing: "-0.03em"
  title-lg:
    fontSize: "20px"
    lineHeight: "1.35"
    fontWeight: "800"
    letterSpacing: "-0.02em"
  title-md:
    fontSize: "16px"
    lineHeight: "1.4"
    fontWeight: "700"
    letterSpacing: "-0.01em"
  title-sm:
    fontSize: "14px"
    lineHeight: "1.4"
    fontWeight: "700"
    letterSpacing: "0"
  body-md:
    fontSize: "14px"
    lineHeight: "1.6"
    fontWeight: "400"
  body-sm:
    fontSize: "13px"
    lineHeight: "1.5"
    fontWeight: "400"
  caption:
    fontSize: "12px"
    lineHeight: "1.4"
    fontWeight: "500"
    letterSpacing: "0"
  button:
    fontSize: "13px"
    lineHeight: "1"
    fontWeight: "700"
---

# 동국e음 공식 디자인 시스템 가이드 (DESIGN.md)

동국e음의 모든 화면을 생성하거나 수정할 때는 이 문서의 규칙과 `src/components/ui/` 공통 컴포넌트를 기반으로 작업합니다.  
AI에게 작업을 지시할 때 **"루트의 DESIGN.md를 준수해서 만들어 줘"**라고 전달하면 시각적 톤과 동작이 완벽하게 일치합니다.

---

## 1. 핵심 디자인 원칙 (Core Principles)

1. **오렌지는 브랜드와 핵심 행동(CTA)에만 절제하여 사용**
   - 동국대 상징 오렌지(`#ea580c` / `bg-brand-600`)는 화면당 1개의 가장 중요한 기본 버튼, 현재 탭/메뉴 활성 표시, 알림 카운트 뱃지에만 적용합니다.
   - 본문이나 일반 배경에는 오렌지를 남발하지 않고 따뜻한 캔버스(`bg-canvas`)와 깔끔한 화이트 카드(`bg-surface`)를 유지합니다.

2. **사용자 역할(Role) 색상 엄격 분리**
   - **재학생(Student)**: 오렌지 (`text-role-student`, `bg-role-student-soft`)
   - **졸업생(Alumni)**: 싱그러운 초록 (`text-role-alumni`, `bg-role-alumni-soft`)
   - **교수진(Professor)**: 지적인 블루 (`text-role-professor`, `bg-role-professor-soft`)
   - **관리자(Admin)**: 신뢰의 보라 (`text-role-admin`, `bg-role-admin-soft`)
   - 이 4가지 색상은 프로필 아바타와 역할 뱃지에만 사용하여 사용자가 글쓴이의 신분을 직관적으로 파악할 수 있도록 돕습니다.

3. **한글 가독성 최우선 (12px 미만 마이크로 텍스트 금지)**
   - 한글 폰트는 크기가 11px 이하로 작아지면 획(모음·자음)이 뭉개져 가독성이 심각하게 저하됩니다.
   - 특수한 배지나 카운터를 제외하고는 **최소 12px(`text-xs`) 이상**을 유지합니다.

4. **단일 층위(Single Layer) 카드 구조**
   - 카드는 `Panel` 한 겹으로 구성하며, 카드 안에 또 다른 카드를 중첩해서 넣지 않습니다.
   - 내부 영역 구분은 미세한 헤어라인 선(`border-line`)이나 연한 바탕(`bg-surface-2`) 블록으로 정돈합니다.

5. **다크 모드 배제 & 쾌적한 라이트 모드 통일**
   - 본 프로젝트는 시인성과 학사 서비스의 안정성을 위해 다크 모드를 배제하고 일관된 라이트 모드로 운영합니다.
   - 임의의 `dark:...` 유틸리티 클래스를 추가하지 않고 정의된 색상 토큰을 사용합니다.

---

## 2. 반응형 및 모바일 최적화 규칙 (Mobile Experience)

- **2단 레이아웃 뷰 전환(View Switching)**:
  - 메신저나 관리자 화면처럼 좌우 2단 구조의 화면은 스마트폰 환경에서 상하로 쌓여 화면을 가리지 않도록 모바일 뷰 전환 상태(`mobileView: "list" | "thread"`)를 둡니다.
  - 모바일에서는 목록을 보다가 항목을 누르면 상세 화면으로 전환되며, 상단에 **`< 목록` 뒤로가기 버튼**을 제공합니다.
  - 데스크톱(`lg:`) 이상에서는 항상 2단이 나란히 표시됩니다.

- **터치 영역 보장**:
  - 모바일 환경에서의 모든 버튼과 클릭 영역은 최소 `36px` 이상의 높이를 보장합니다.

---

## 3. 공통 컴포넌트 라이브러리 (`src/components/ui/`)

| 컴포넌트 | 경로 | 용도 및 특징 |
|---|---|---|
| `Panel` | `src/components/ui/Panel.tsx` | 둥근 모서리(rounded-3xl), 헤어라인 테두리, 그림자(shadow-xs)가 적용된 기본 화이트 카드 |
| `PageHeader` | `src/components/ui/Panel.tsx` | 페이지 최상단 대제목, 설명 문구, 우측 핵심 액션 버튼 영역 |
| `Button` | `src/components/ui/Button.tsx` | `primary`(오렌지), `secondary`(선형), `dark`(먹색), `soft`(연한 배경), `danger`(빨강) |
| `Badge` | `src/components/ui/Badge.tsx` | `student`, `alumni`, `professor`, `admin`, `success`, `demo` 역할 및 상태 뱃지 |
| `CountBadge` | `src/components/ui/Badge.tsx` | 안읽은 메시지 수나 미확인 요청을 나타내는 원형 숫자 뱃지 |
| `Avatar`, `AvatarStack` | `src/components/ui/Avatar.tsx` | 구성원 이름 이니셜과 역할 링 테두리가 포함된 원형 프로필 |
| `Input`, `SearchInput` | `src/components/ui/Field.tsx` | 헤어라인 테두리와 연한 바탕이 적용된 표준 입력창 및 검색창 |
| `Modal` | `src/components/ui/Modal.tsx` | 배경 블러, ESC 키 닫기, 반응형 너비를 지원하는 공통 팝업 대화상자 |

---

## 4. 참고 레퍼런스 안내 (`docs/design-references/`)

더 구체적인 인터랙션이나 특수 레이아웃을 구현할 때는 `docs/design-references/`에 보관된 글로벌 서비스들의 `DESIGN.md`를 참고할 수 있습니다.

- **캘린더 & 일정 UI**: `docs/design-references/cal.md` (Cal.com)
- **게시판 & 필터 태그**: `docs/design-references/linear.md` (Linear)
- **문서 & 졸업 자가진단**: `docs/design-references/notion.md` (Notion)
- **통계 & 관리자 카드**: `docs/design-references/stripe.md` (Stripe)
- **프로필 탐색 & 동문 카드**: `docs/design-references/airbnb.md` (Airbnb)
- **대화창 & 멘토링 인터페이스**: `docs/design-references/claude.md` (Claude)
