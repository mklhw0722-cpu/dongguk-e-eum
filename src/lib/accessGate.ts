/**
 * 동국e음 접근 제어 판정 로직 (순수 함수)
 *
 * 상태 확인 순서
 * 1. Firebase Authentication 초기화 및 로그인 여부 확인 (확인 중이면 auth_loading)
 * 2. 로그인한 사용자가 없으면 signed_out
 * 3. 로그인한 사용자가 있으면 Firestore users/{uid} 회원 문서 확인 (확인 중이면 profile_loading)
 * 4. 회원 문서의 approvalStatus 에 따라 pending / approved / rejected / suspended 등으로 분기
 * 5. 회원 문서가 없거나 조회에 실패하면 자동 승인하지 않고 profile_missing / profile_error 로 차단
 *
 * React 나 Firebase 에 의존하지 않으므로 단위 테스트로 직접 검증할 수 있습니다.
 */

export type ProfileFetchStatus = "idle" | "loading" | "loaded" | "missing" | "error";

export type AccessGateState =
  | "auth_loading"
  | "signed_out"
  | "profile_loading"
  | "profile_missing"
  | "profile_error"
  | "pending"
  | "supplement_requested"
  | "rejected"
  | "suspended"
  | "unknown_status"
  | "approved";

export interface AccessGateInput {
  /** onAuthStateChanged 가 최소 1회 응답했는지 여부 */
  authResolved: boolean;
  /** 현재 로그인한 Firebase 사용자 (없으면 null) */
  firebaseUser: { uid: string } | null;
  /** Firestore 회원 문서 조회 상태 */
  profileStatus: ProfileFetchStatus;
  /** Firestore 회원 문서 (loaded 일 때만 의미 있음) */
  profile: { approvalStatus?: unknown; role?: unknown } | null;
}

export function resolveAccessGate(input: AccessGateInput): AccessGateState {
  // 1~2. 로그인 여부를 가장 먼저 확인 (승인 상태보다 항상 먼저)
  if (!input.authResolved) return "auth_loading";
  if (!input.firebaseUser) return "signed_out";

  // 3. 회원 문서 조회 상태 확인
  switch (input.profileStatus) {
    case "idle":
    case "loading":
      return "profile_loading";
    case "missing":
      return "profile_missing";
    case "error":
      return "profile_error";
    case "loaded":
      break;
    default:
      return "profile_error";
  }

  if (!input.profile) return "profile_missing";

  // 4. 승인 상태 분기 (알 수 없는 값은 절대 승인으로 취급하지 않음)
  switch (input.profile.approvalStatus) {
    case "approved":
      return "approved";
    case "pending":
      return "pending";
    case "supplement_requested":
      return "supplement_requested";
    case "rejected":
      return "rejected";
    case "suspended":
      return "suspended";
    default:
      return "unknown_status";
  }
}

/** 내부 서비스(홈, 공지, 채팅, 공유방, 졸업생, 졸업요건) 이용 가능 여부 */
export function canAccessInternal(state: AccessGateState): boolean {
  return state === "approved";
}

/** 관리자 기능 이용 가능 여부: 승인 완료 + role === "admin" 일 때만 */
export function canAccessAdmin(
  state: AccessGateState,
  profile: { role?: unknown } | null
): boolean {
  return state === "approved" && profile?.role === "admin";
}

export function isGateLoading(state: AccessGateState): boolean {
  return state === "auth_loading" || state === "profile_loading";
}

export type RouteKind = "auth" | "admin" | "internal";

/**
 * 현재 주소(경로)와 사용자 상태를 보고 무엇을 보여줄지 결정합니다.
 * - loading: 로딩 화면 (내부 콘텐츠 절대 노출 안 함)
 * - redirect_auth: 로그인 화면(/auth)으로 이동
 * - redirect_home: 홈(/)으로 이동
 * - show_auth_page: 로그인·회원가입 화면 표시
 * - gate: 상태별 안내 화면(승인 대기·거절·정지·오류) 표시
 * - forbidden: 관리자 전용 구역 차단 화면
 * - content: 요청한 페이지 정상 표시
 */
export type RouteView =
  | "loading"
  | "redirect_auth"
  | "redirect_home"
  | "show_auth_page"
  | "gate"
  | "forbidden"
  | "content";

export function resolveRouteView(
  state: AccessGateState,
  route: RouteKind,
  isAdmin: boolean
): RouteView {
  if (isGateLoading(state)) return "loading";

  if (state === "signed_out") {
    return route === "auth" ? "show_auth_page" : "redirect_auth";
  }

  if (state !== "approved") {
    // 로그인했지만 승인되지 않은 모든 상태: 어떤 주소로 들어와도 상태 안내 화면만 표시
    return "gate";
  }

  // 승인 완료 사용자
  if (route === "auth") return "redirect_home";
  if (route === "admin" && !isAdmin) return "forbidden";
  return "content";
}

/** GitHub Pages basePath(/dongguk-e-eum)와 끝 슬래시를 정리한 경로로 라우트 종류 판정 */
export function classifyRoute(pathname: string | null | undefined): RouteKind {
  const normalized =
    (pathname || "").replace(/^\/dongguk-e-eum(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  if (normalized === "/auth" || normalized.startsWith("/auth/")) return "auth";
  if (normalized === "/admin" || normalized.startsWith("/admin/")) return "admin";
  return "internal";
}
