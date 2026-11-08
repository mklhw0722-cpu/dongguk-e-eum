# 동국e음 디자인 시스템

화면을 새로 만들거나 고칠 때 이 문서의 규칙과 `src/components/ui`의 공통 컴포넌트를 먼저 쓴다.
AI에게 화면 작업을 맡길 때도 "docs/design-system.md를 따라 줘"라고 같이 알려 주면 톤이 맞춰진다.

## 원칙

1. **오렌지는 행동과 브랜드에만.** 화면의 핵심 버튼 1개, 현재 위치(메뉴), 읽지 않은 수, 로고에만 쓴다. 필터 선택은 먹색, 분류는 옅은 색 배지로 쓴다.
2. **사람은 역할 색으로.** 재학생(오렌지)·졸업생(초록)·교수(파랑)·관리자(보라)는 아바타와 역할 배지에만 쓴다. 다른 의미에 이 색을 빌려 쓰지 않는다.
3. **데모 표기는 지우지 않고 조용하게.** "예시 데이터", "기준 미설정", 프로토타입 안내는 제품 원칙이다. 문구는 그대로 두고 `Badge tone="demo"`나 `Callout`으로 본문보다 한 단계 약하게 보여 준다.
4. **면은 한 겹.** 페이지는 `Panel` 한 겹으로 나누고, 그 안은 구분선(`divide-y divide-line`)이나 `bg-surface-2` 블록으로 나눈다. 카드 안에 카드를 또 넣지 않는다.
5. **12px 미만 글자는 쓰지 않는다.** 한글은 작아지면 획이 뭉개진다. `text-[10px]`, `text-[11px]` 금지.
6. **다크 모드는 토큰으로.** `bg-white`, `text-slate-900`, `dark:bg-slate-800` 대신 `bg-surface`, `text-ink`처럼 역할 토큰을 쓰면 다크 모드가 자동으로 맞는다.

## 색 토큰 (Tailwind 유틸리티 이름)

| 용도 | 클래스 | 메모 |
|---|---|---|
| 페이지 바탕 | `bg-canvas` | 앱 전체 배경 |
| 면(카드·패널) | `bg-surface` | 흰 면 / 다크에선 남색 면 |
| 들어간 면 | `bg-surface-2`, `bg-surface-3` | 입력칸 바탕, 카드 안 정보 블록, hover |
| 선 | `border-line`, `border-line-strong` | 기본 테두리 / hover·강조 테두리 |
| 글자 | `text-ink`, `text-ink-2`, `text-ink-3` | 제목·본문 / 보조 설명 / 날짜·메타 |
| 반전 글자 | `text-ink-inverse` | 진한 바탕 위 글자 |
| 브랜드 강조 | `text-accent`, `bg-accent-soft`, `border-accent-line` | 링크·현재 위치·옅은 강조 |
| 브랜드 채움 | `bg-brand-600` (+ `hover:bg-brand-700`) | 흰 글자와 대비 4.5:1 이상 |
| 상태 | `text-success` `bg-success-soft` / `warning` / `danger` / `info` | 승인·완료 / 주의·미설정 / 거절·삭제 / 안내 |
| 역할 | `text-role-student` `bg-role-student-soft` / `alumni` / `professor` / `admin` | 아바타·역할 배지 전용 |

`slate-*`, `orange-*`, `gray-*` 같은 Tailwind 기본 팔레트와 `dark:` 짝 맞추기는 새 코드에서 쓰지 않는다.

## 글자

- 서체: Pretendard Variable (`src/app/layout.tsx`에서 불러옴)
- 페이지 제목 `PageHeader` → `text-2xl sm:text-title font-bold`
- 섹션 제목 `SectionHeader` → `text-base sm:text-lg font-bold`
- 카드 제목 `text-base font-semibold` (목록이 촘촘하면 `text-[15px]`)
- 본문 `text-sm`~`text-body`(15px), 보조 `text-sm text-ink-2`, 메타(날짜·작성자) `text-xs text-ink-3`
- 숫자(시간·건수·학점)는 `tabular` 클래스로 자릿수를 맞춘다.

## 모양

- 둥글기: 패널·카드 `rounded-2xl` → 안쪽 블록 `rounded-xl` → 버튼·입력 `rounded-lg` → 배지 `rounded-md`. 사람(아바타)은 원, 로고·방 아이콘은 둥근 사각형.
- 그림자: 기본은 테두리만. 클릭되는 카드의 hover에 `shadow-raise`, 떠 있는 것(모달·토스트)에 `shadow-pop`.
- 간격: 페이지 섹션 사이 `space-y-6`(넓으면 `space-y-8`), 패널 안 `p-4 sm:p-5`, 카드 그리드 `gap-4`.

## 공통 컴포넌트 (`import { ... } from "@/components/ui"`)

| 컴포넌트 | 쓰는 곳 |
|---|---|
| `PageHeader title description actions` | 모든 페이지 맨 위. h1은 페이지에 하나 |
| `SectionHeader title count action icon` | 패널·섹션 머리. 오른쪽 "전체보기"는 `<Link className={textLinkClass}>` |
| `Panel padding tone interactive` | 화면을 나누는 면 |
| `Button variant size icon block` | `primary`(핵심 1개) `dark` `secondary` `soft` `ghost` `success` `warning` `danger` / `sm` `md` `lg` |
| `buttonClass(variant, size)` | `Link`를 버튼 모양으로 |
| `IconButton label` | 아이콘만 있는 버튼 (label 필수) |
| `Badge tone variant dot icon` | 분류·상태 표시. 데모 표기는 `tone="demo"` |
| `CountBadge count` | 읽지 않은 수 |
| `Chip selected count` + `ChipGroup label scroll` | 필터. 모바일에서 한 줄 가로 스크롤은 `scroll` |
| `Tabs items value onChange variant label` | 페이지 안 화면 전환(`underline`) / 작은 보기 전환(`segmented`) |
| `Field label hint required` + `Input` `Textarea` `Select` `Checkbox` `SearchInput` | 폼. 입력이 여러 개 들어가는 묶음은 `Field as="div"` |
| `Modal open onClose title description footer size` | 모든 대화상자. Esc·바깥 클릭·포커스 처리 내장, 모바일은 아래에서 올라오는 시트 |
| `Callout tone title description` | 안내·주의 상자. 페이지당 1개 이하 |
| `EmptyState title description action compact` | 빈 목록 |
| `Avatar name initials role size` / `AvatarStack people` | 사람 표시 |
| `useToast()` | 보내기·저장 같은 행동 뒤 짧은 완료 알림 |

공지·동문·공유방·졸업요건 카드와 `RoleBadge`, `NOTICE_CATEGORY_TONE`, `DemoInfoBanner`는 `src/components/common/Cards.tsx`에 있다.

### 모달 쓰는 법

```tsx
<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="새 공지사항 등록"
  description="관리자 데모 UI"
  footer={
    <>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>취소</Button>
      <Button type="submit" form="notice-form">등록하기</Button>
    </>
  }
>
  <form id="notice-form" onSubmit={handleSubmit} className="space-y-4">...</form>
</Modal>
```

- 제출 버튼을 `footer`에 두면 `form="폼 id"`로 폼과 연결한다.
- `fixed inset-0`으로 직접 만든 오버레이는 쓰지 않는다.

## 문구

- 버튼은 무슨 일이 일어나는지 동사로: "등록하기", "멘토링 신청", "대화 시작".
- 같은 행동은 끝까지 같은 이름: 버튼이 "보내기"면 완료 알림도 "보냈어요".
- 빈 화면·오류는 다음에 할 일을 알려 준다: "다른 분류를 고르거나 검색어를 지워 보세요."

## 접근성 체크

- 클릭되는 것은 `button` 또는 `a`(Link). `div onClick` 금지.
- 아이콘만 있는 버튼은 `IconButton label` 또는 `aria-label`.
- 입력에는 보이는 라벨(`Field`)이나 `aria-label`.
- 상태를 색으로만 구분하지 않는다(글자나 아이콘을 같이).
- 탭·토글은 `aria-selected` / `aria-pressed`가 들어간 공통 컴포넌트를 쓴다.
