import type {
  ApprovalStatus,
  StudentAcademicProfile,
  User,
  UserRole,
} from "../types/index.ts";

export type AdminUserRoleCategory = "all" | "student" | "alumni" | "professor" | "admin";
export type AdminUserApprovalFilter =
  | "all"
  | "approved"
  | "pending"
  | "needs_revision"
  | "rejected"
  | "suspended";

/**
 * 회원 객체에서 입학 학번(또는 입학연도)을 4자리 정규 연도 숫자(예: 2024, 2020, 1999)로 안전하게 추출합니다.
 * - "24학번" -> 2024
 * - "2026학년도(22학번)" -> 2022 (졸업연도가 아닌 괄호 안의 입학 학번 추출)
 * - "99학번 이전" -> 1999
 * - 10자리 학번(2023112345) -> 2023
 * - 학번이 없는 경우 null 반환
 */
export function extractEntranceHakbun(u: {
  studentIdOrYear?: string | null;
  bio?: string | null;
  academicProfile?: { studentId?: string; admissionYear?: number } | null;
} | null | undefined): number | null {
  if (!u) return null;

  // 1. academicProfile.admissionYear가 명시적으로 숫자로 존재하는 경우
  if (
    typeof u.academicProfile?.admissionYear === "number" &&
    u.academicProfile.admissionYear >= 1950 &&
    u.academicProfile.admissionYear <= 2035
  ) {
    return Math.floor(u.academicProfile.admissionYear);
  }

  // 2. studentIdOrYear와 bio 텍스트에서 추출
  const raw = `${u.studentIdOrYear || ""} ${u.bio || ""}`.trim();
  if (raw) {
    // 2-1) "22학번", "(22학번)", "99학번" 등 (\d{2})\s*학번 패턴 우선 매칭
    // 졸업생의 경우 "2026학년도(22학번)" 처럼 졸업연도가 앞에 적혀 있어도 괄호 안의 입학 학번을 정확하게 추출
    const matchHakbun = raw.match(/(\d{2})\s*학번/);
    if (matchHakbun) {
      const twoDigits = parseInt(matchHakbun[1], 10);
      // 00 ~ 35년은 2000년대(2000~2035), 36 ~ 99년은 1900년대(1936~1999)
      return twoDigits <= 35 ? 2000 + twoDigits : 1900 + twoDigits;
    }

    // 2-2) "99학번 이전"
    if (raw.includes("99학번 이전")) {
      return 1999;
    }

    // 2-3) "2024년", "2020" 등 4자리 연도 매칭
    const match4Digit = raw.match(/\b(19\d{2}|20\d{2})\b/);
    if (match4Digit) {
      const year = parseInt(match4Digit[1], 10);
      if (year >= 1950 && year <= 2035) {
        return year;
      }
    }

    // 2-4) 10자리 학번(2023110000) 매칭
    const match10Digit = raw.match(/\b(19\d{2}|20\d{2})\d{4,8}\b/);
    if (match10Digit) {
      return parseInt(match10Digit[1], 10);
    }
  }

  // 3. academicProfile.studentId 확인
  const studId = u.academicProfile?.studentId?.trim();
  if (studId) {
    const matchStudId = studId.match(/^(19\d{2}|20\d{2})/);
    if (matchStudId) {
      return parseInt(matchStudId[1], 10);
    }
  }

  return null;
}

/**
 * 보완 요청 항목 선택지 (관리자가 체크박스로 지정 가능)
 */
export const REVISION_FIELD_OPTIONS = [
  { key: "name", label: "이름 (실명)" },
  { key: "studentIdOrYear", label: "학번 / 입학연도" },
  { key: "roleAndTrack", label: "신청 구분 및 전공·교직 이수 트랙" },
  { key: "verificationNote", label: "소속 확인 메모 / 증빙 내용" },
] as const;

export const ALUMNI_HAKBUN_OPTIONS = [
  ...Array.from({ length: 25 }, (_, i) => {
    const hakbunNum = 24 - i; // 24학번부터 00학번까지
    const prefix = hakbunNum < 10 ? `0${hakbunNum}` : `${hakbunNum}`;
    return `${prefix}학번`;
  }),
  "99학번 이전",
];

export const ALUMNI_GRAD_YEAR_OPTIONS = [
  ...Array.from({ length: 27 }, (_, i) => {
    const yr = 2026 - i; // 2026년부터 2000년까지
    return `${yr}년`;
  }),
  "1999년 이전",
];

export const ALUMNI_GRADUATION_OPTIONS = ALUMNI_GRAD_YEAR_OPTIONS;

export type RevisionFieldKey = (typeof REVISION_FIELD_OPTIONS)[number]["key"];

/**
 * 보완 요청 상태인지 확인 (신규 표준값 needs_revision 및 기존 supplement_requested 모두 호환)
 */
export function isRevisionRequestedStatus(status?: string | null): boolean {
  return status === "needs_revision" || status === "supplement_requested";
}

/**
 * 사용자가 직접 가입 정보를 수정하고 재신청할 수 있는 상태인지 확인
 */
export function canEditAndResubmitRegistration(status?: string | null): boolean {
  return (
    status === "needs_revision" ||
    status === "supplement_requested" ||
    status === "rejected"
  );
}

/**
 * 가입 승인 관리 대상 판별 (pending, needs_revision, supplement_requested, rejected)
 * - 승인 대기, 보완 요청, 가입 반려 상태의 신청서만 해당
 * - 승인 완료(approved) 및 이용 정지(suspended)는 제외
 */
export function isRegistrationPendingStatus(status?: string | null): boolean {
  if (!status) return false;
  return (
    status === "pending" ||
    status === "needs_revision" ||
    status === "supplement_requested" ||
    status === "rejected"
  );
}

/**
 * 전체 회원 관리 대상(정회원) 판별 (approved, suspended)
 * - 가입 승인 완료 회원 및 승인 후 이용 정지 회원만 포함
 * - 승인 대기(pending), 보완 요청(needs_revision), 가입 반려(rejected)는 원천 제외
 */
export function isFullMemberStatus(status?: string | null): boolean {
  if (!status) return true; // 데모/레거시 기본 호환
  if (isRegistrationPendingStatus(status)) return false;
  return status === "approved" || status === "suspended";
}

/**
 * 승인 상태값 정규화 (외부 입력 또는 DB 값을 표준 상태로 판별)
 */
export function normalizeApprovalStatus(
  status?: string | null
): ApprovalStatus | "unknown" {
  if (
    status === "pending" ||
    status === "approved" ||
    status === "needs_revision" ||
    status === "supplement_requested" ||
    status === "rejected" ||
    status === "suspended"
  ) {
    return status;
  }
  return "unknown";
}

/**
 * 가입 정보 수정 및 재신청 입력값
 */
export interface RegistrationRevisionInput {
  name: string;
  role: UserRole;
  studentIdOrYear: string;
  doubleMajor?: string;
  academicProfile?: StudentAcademicProfile;
  verificationNote?: string;
}

/**
 * 가입 정보 수정 / 재신청 시 업데이트 페이로드 검증 및 생성
 * - 기존 UID와 email은 절대 변경하지 않음
 * - 일반 사용자가 role을 'admin'으로 변경하거나 approvalStatus를 'approved'로 변경하는 것을 원천 차단
 * - mode === 'draft' 이면 현재 상태(needs_revision / supplement_requested / rejected) 유지
 * - mode === 'resubmit' 이면 상태를 'pending'으로 전환하고 revisionCount 증가 및 resubmittedAt 기록
 */
export function validateAndBuildRegistrationUpdate(
  currentDoc: Pick<
    User,
    | "id"
    | "email"
    | "approvalStatus"
    | "revisionCount"
    | "adminComment"
    | "revisionFields"
  >,
  input: RegistrationRevisionInput,
  mode: "draft" | "resubmit",
  nowIso: string = new Date().toISOString()
): {
  id: string;
  email: string;
  name: string;
  role: Exclude<UserRole, "admin">;
  studentIdOrYear: string;
  doubleMajor?: string;
  academicProfile?: StudentAcademicProfile;
  verificationNote?: string;
  bio: string;
  avatarInitials: string;
  approvalStatus: ApprovalStatus;
  revisionCount: number;
  lastModifiedAt: string;
  updatedAt: string;
  resubmittedAt?: string;
} {
  if (!canEditAndResubmitRegistration(currentDoc.approvalStatus)) {
    throw new Error(
      "가입 정보 보완 요청(needs_revision) 또는 반려(rejected) 상태에서만 가입 정보를 수정하고 재신청할 수 있습니다."
    );
  }

  const trimmedName = (input.name || "").trim();
  if (!trimmedName) {
    throw new Error("이름(실명)을 입력해 주세요.");
  }

  if (input.role === "admin") {
    throw new Error("일반 회원은 관리자(admin) 역할로 변경할 수 없습니다.");
  }

  const allowedRole: Exclude<UserRole, "admin"> =
    input.role === "alumni" || input.role === "professor" ? input.role : "student";

  const trimmedYear = (input.studentIdOrYear || "").trim();
  if (!trimmedYear) {
    throw new Error("학번 또는 입학연도(교수진의 경우 소속 표기)를 입력해 주세요.");
  }

  const hakbunMatch = trimmedYear.match(/(\d{2})\s*학번/);
  const cleanHakbun = hakbunMatch ? `${hakbunMatch[1]}학번` : trimmedYear;
  const bio =
    allowedRole === "professor"
      ? `교육학과 전임교원 ${trimmedName}님의 프로필입니다.`
      : `${cleanHakbun} ${trimmedName}님의 프로필입니다.`;

  const avatarInitials = trimmedName.slice(0, 2).toUpperCase();
  const nextStatus: ApprovalStatus =
    mode === "resubmit" ? "pending" : currentDoc.approvalStatus;
  const currentCount =
    typeof currentDoc.revisionCount === "number" ? currentDoc.revisionCount : 0;
  const nextCount = mode === "resubmit" ? currentCount + 1 : currentCount;

  const trimmedDoubleMajor = input.doubleMajor?.trim();
  const trimmedNote = input.verificationNote?.trim();

  return {
    id: currentDoc.id,
    email: currentDoc.email,
    name: trimmedName,
    role: allowedRole,
    studentIdOrYear: trimmedYear,
    ...(trimmedDoubleMajor ? { doubleMajor: trimmedDoubleMajor } : {}),
    ...(input.academicProfile
      ? {
          academicProfile: {
            ...input.academicProfile,
            adminVerifiedSpecialCondition: false,
          },
        }
      : {}),
    ...(trimmedNote ? { verificationNote: trimmedNote } : {}),
    bio,
    avatarInitials,
    approvalStatus: nextStatus,
    revisionCount: nextCount,
    lastModifiedAt: nowIso,
    updatedAt: nowIso,
    ...(mode === "resubmit" ? { resubmittedAt: nowIso } : {}),
  };
}

/**
 * 이메일 중복 및 계정 상태 5대 분류
 */
export type EmailAccountCaseType =
  | "auth_and_firestore_active"
  | "revision_or_rejected"
  | "auth_only_deleted_or_incomplete"
  | "firestore_only_orphan"
  | "completely_deleted"
  | "password_mismatch_or_unverified";

export interface EmailAccountClassification {
  caseType: EmailAccountCaseType;
  canProceedNewAuthSignup: boolean;
  canRecreateFirestoreProfile: boolean;
  shouldRedirectToGateEdit: boolean;
  shouldGuideToLogin: boolean;
  userSafeTitle: string;
  userSafeMessage: string;
}

/**
 * 기존 이메일로 회원가입 시도 시 계정 상태별 처리 기준 분류
 * - 타인의 개인정보나 승인 사유는 절대 노출하지 않음
 */
export function classifyEmailDuplicateCase(params: {
  hasAuthAccount: boolean;
  hasFirestoreDoc: boolean;
  firestoreApprovalStatus?: ApprovalStatus | null;
  passwordVerifiedForExistingAuth?: boolean;
}): EmailAccountClassification {
  const {
    hasAuthAccount,
    hasFirestoreDoc,
    firestoreApprovalStatus,
    passwordVerifiedForExistingAuth = false,
  } = params;

  // 1. 완전히 삭제되었거나 최초 가입인 경우
  if (!hasAuthAccount && !hasFirestoreDoc) {
    return {
      caseType: "completely_deleted",
      canProceedNewAuthSignup: true,
      canRecreateFirestoreProfile: false,
      shouldRedirectToGateEdit: false,
      shouldGuideToLogin: false,
      userSafeTitle: "신규 회원가입 가능",
      userSafeMessage: "기존 가입 이력이 없는 이메일입니다. 신규 가입을 진행합니다.",
    };
  }

  // 2. Firestore 회원 문서만 남아있고 Auth 계정이 없는 경우 (고아 문서)
  if (!hasAuthAccount && hasFirestoreDoc) {
    return {
      caseType: "firestore_only_orphan",
      canProceedNewAuthSignup: true,
      canRecreateFirestoreProfile: true,
      shouldRedirectToGateEdit: false,
      shouldGuideToLogin: false,
      userSafeTitle: "인증 계정 신규 생성 및 프로필 갱신",
      userSafeMessage:
        "새 인증 계정을 생성하고 가입 신청 프로필을 새 UID 기준으로 연결합니다.",
    };
  }

  // Auth 계정이 존재하는데 비밀번호가 일치하지 않아 본인 확인이 안 된 경우 (개인정보 보호)
  if (hasAuthAccount && !passwordVerifiedForExistingAuth) {
    return {
      caseType: "password_mismatch_or_unverified",
      canProceedNewAuthSignup: false,
      canRecreateFirestoreProfile: false,
      shouldRedirectToGateEdit: false,
      shouldGuideToLogin: true,
      userSafeTitle: "이미 등록된 이메일 주소입니다",
      userSafeMessage:
        "이미 가입 신청 이력이 있는 이메일입니다. 보완 요청·반려 대상이거나 기존 회원이라면 [로그인] 후 정보를 확인·수정해 주시고, 이전에 삭제된 계정으로 재가입하려면 기존 비밀번호로 로그인하거나 [비밀번호 재설정] 후 다시 시도해 주세요.",
    };
  }

  // 3. Auth 계정은 존재하지만 Firestore 회원 문서가 없는 경우 (관리자 삭제 후 재가입 또는 가입 중단)
  if (hasAuthAccount && !hasFirestoreDoc) {
    return {
      caseType: "auth_only_deleted_or_incomplete",
      canProceedNewAuthSignup: false,
      canRecreateFirestoreProfile: true,
      shouldRedirectToGateEdit: false,
      shouldGuideToLogin: false,
      userSafeTitle: "이전 계정 인증 확인 및 재가입 신청 완료",
      userSafeMessage:
        "이전에 삭제되었거나 가입이 중단된 인증 계정이 확인되어, 입력하신 새 정보로 가입 신청서(승인 대기)를 정상 등록했습니다.",
    };
  }

  // 4. 가입 반려 또는 보완 요청 상태인 경우 (본인 비밀번호 확인 완료)
  if (
    hasAuthAccount &&
    hasFirestoreDoc &&
    canEditAndResubmitRegistration(firestoreApprovalStatus)
  ) {
    return {
      caseType: "revision_or_rejected",
      canProceedNewAuthSignup: false,
      canRecreateFirestoreProfile: false,
      shouldRedirectToGateEdit: true,
      shouldGuideToLogin: true,
      userSafeTitle:
        firestoreApprovalStatus === "rejected"
          ? "기존 가입 신청이 반려된 계정입니다"
          : "가입 정보 보완 요청이 있는 계정입니다",
      userSafeMessage:
        "새로운 계정을 중복 생성할 필요 없이, 기존 계정으로 로그인하여 가입 정보를 수정하고 다시 승인 요청할 수 있도록 안내 화면으로 이동합니다.",
    };
  }

  // 5. Auth 계정과 Firestore 회원정보가 모두 존재하는 일반/대기/정지 회원
  return {
    caseType: "auth_and_firestore_active",
    canProceedNewAuthSignup: false,
    canRecreateFirestoreProfile: false,
    shouldRedirectToGateEdit: false,
    shouldGuideToLogin: true,
    userSafeTitle: "이미 가입된 회원입니다",
    userSafeMessage:
      "이미 가입되어 있는 계정입니다. 중복 가입 대신 로그인 화면에서 기존 계정으로 로그인해 주세요.",
  };
}

/**
 * 회원 삭제 시 관련 데이터 항목별 처리 정책 정의
 */
export interface DataHandlingPolicyItem {
  key: UserDeletionStepKey;
  label: string;
  collectionName: string;
  policyType: "delete" | "anonymize_or_detach" | "preserve_shared" | "server_or_rejoin";
  summary: string;
}

export type UserDeletionStepKey =
  | "userDoc"
  | "publicProfile"
  | "graduationRecord"
  | "alumniProfile"
  | "advisorLinks"
  | "calendarEvents"
  | "consultations"
  | "chatRooms"
  | "communityPosts"
  | "authAccount";

export const USER_DELETION_DATA_POLICY: DataHandlingPolicyItem[] = [
  {
    key: "userDoc",
    label: "회원 기본 정보 및 개인정보",
    collectionName: "users/{uid}",
    policyType: "delete",
    summary: "이름, 이메일, 학번, 승인/보완 사유 등 개인 회원 문서를 즉시 삭제합니다.",
  },
  {
    key: "publicProfile",
    label: "공개 프로필",
    collectionName: "publicProfiles/{uid}",
    policyType: "delete",
    summary: "학과 디렉토리 및 검색에 노출되는 공개 프로필 문서를 즉시 삭제합니다.",
  },
  {
    key: "graduationRecord",
    label: "졸업요건 개인 기록",
    collectionName: "graduationRecords/{uid}",
    policyType: "delete",
    summary: "개인이 입력한 수강 과목 및 졸업요건 자가점검 데이터를 즉시 삭제합니다.",
  },
  {
    key: "alumniProfile",
    label: "졸업생 멘토링 프로필",
    collectionName: "alumniProfiles/{uid}",
    policyType: "delete",
    summary: "졸업생 네트워크에 등록된 개인 멘토 프로필을 즉시 삭제합니다.",
  },
  {
    key: "calendarEvents",
    label: "개인 캘린더 일정",
    collectionName: "users/{uid}/calendarEvents, calendarEvents",
    policyType: "delete",
    summary: "해당 회원의 개인 일정 데이터를 모두 삭제합니다.",
  },
  {
    key: "consultations",
    label: "상담 신청 기록",
    collectionName: "consultations",
    policyType: "delete",
    summary: "해당 회원(학생 또는 교수)과 연결된 상담 신청 및 일정 기록을 삭제합니다.",
  },
  {
    key: "advisorLinks",
    label: "지도교수-학생 연결 참조",
    collectionName: "users (advisorProfessorId)",
    policyType: "anonymize_or_detach",
    summary:
      "삭제 대상이 교수님인 경우, 배정된 학생들의 지도교수 참조값만 안전하게 비우고 학생 계정은 그대로 보호합니다.",
  },
  {
    key: "chatRooms",
    label: "채팅방 참여자 정보 및 대화 기록",
    collectionName: "chats",
    policyType: "anonymize_or_detach",
    summary:
      "참여자 목록(participants)에서 삭제된 회원 UID를 제거하되, 상대방 학우·교수님의 기존 대화방과 메시지 기록은 사라지지 않도록 보존합니다.",
  },
  {
    key: "communityPosts",
    label: "진로·복수전공 게시글 및 댓글",
    collectionName: "communityPosts",
    policyType: "preserve_shared",
    summary:
      "공동 게시판의 정보 공유 맥락과 다른 회원의 댓글이 깨지지 않도록 게시글·댓글은 무조건 삭제하지 않고 보존합니다.",
  },
  {
    key: "authAccount",
    label: "Firebase Authentication 로그인 계정",
    collectionName: "Firebase Auth",
    policyType: "server_or_rejoin",
    summary:
      "보안 서버(Cloud Functions) 연결 시 즉시 삭제되며, 정적 웹(GitHub Pages 무료 요금제) 환경에서는 동일 이메일 재가입 시 새 신청서로 자동 복구되거나 본인이 직접 계정을 완전 삭제할 수 있습니다.",
  },
];

export type DeletionStepStatus =
  | "success"
  | "failed"
  | "skipped"
  | "manual_or_rejoin_ready";

export interface UserDeletionStepResult {
  key: UserDeletionStepKey;
  label: string;
  status: DeletionStepStatus;
  detail: string;
  affectedCount?: number;
}

export interface UserDeletionReport {
  targetUid: string;
  targetName?: string;
  targetEmail?: string;
  overallStatus:
    | "completed_all"
    | "completed_firestore_only"
    | "partial_failure";
  authDeletedOnServer: boolean;
  canRejoinWithSameEmail: boolean;
  steps: UserDeletionStepResult[];
  failedSteps: UserDeletionStepResult[];
  summaryMessage: string;
  completedAt: string;
}

/**
 * 단계별 삭제 결과를 종합하여 최종 리포트를 생성
 * - 서버에서 Auth 계정까지 삭제된 경우에만 completed_all 반환
 * - 정적 호스팅 환경(서버 엔드포인트 미설정)에서 Firestore만 삭제된 경우 completed_firestore_only 반환 (허위로 Auth 삭제 완료라고 표시하지 않음)
 * - 중간 단계 실패가 하나라도 있으면 partial_failure 반환하여 재시도 가능하도록 지원
 */
export function buildUserDeletionReport(params: {
  targetUid: string;
  targetName?: string;
  targetEmail?: string;
  steps: UserDeletionStepResult[];
  authDeletedOnServer: boolean;
  nowIso?: string;
}): UserDeletionReport {
  const {
    targetUid,
    targetName,
    targetEmail,
    steps,
    authDeletedOnServer,
    nowIso = new Date().toISOString(),
  } = params;

  const failedSteps = steps.filter((s) => s.status === "failed");
  const userDocStep = steps.find((s) => s.key === "userDoc");
  const userDocDeleted = userDocStep?.status === "success";

  let overallStatus: UserDeletionReport["overallStatus"];
  let summaryMessage: string;

  if (failedSteps.length > 0) {
    overallStatus = "partial_failure";
    const failedLabels = failedSteps.map((s) => s.label).join(", ");
    summaryMessage = `일부 단계(${failedLabels}) 처리 중 오류가 발생했습니다. [실패 단계 다시 시도] 버튼을 눌러 복구할 수 있습니다.`;
  } else if (authDeletedOnServer) {
    overallStatus = "completed_all";
    summaryMessage =
      "Firestore 회원 데이터와 Firebase Authentication 계정이 모두 완전히 삭제되었습니다. 동일 이메일로 즉시 신규 가입이 가능합니다.";
  } else {
    overallStatus = "completed_firestore_only";
    summaryMessage =
      "Firestore 회원 문서 및 개인 데이터 삭제가 완료되었습니다. (현재 정적 웹 호스팅 환경에서는 브라우에서 Admin SDK를 실행하지 않으므로 Firebase Auth 계정은 유지되지만, 해당 이메일 사용자가 다시 회원가입하거나 로그인하면 '이미 가입된 회원'으로 막히지 않고 새 가입 신청서를 즉시 재제출할 수 있습니다.)";
  }

  return {
    targetUid,
    targetName,
    targetEmail,
    overallStatus,
    authDeletedOnServer,
    // userDoc이 삭제되었으면 동일 이메일로 재가입 시 자동 복구(recreate) 또는 신규 가입 가능
    canRejoinWithSameEmail: Boolean(userDocDeleted),
    steps,
    failedSteps,
    summaryMessage,
    completedAt: nowIso,
  };
}

/**
 * 관리자 센터 회원 목록 정렬 비교 함수
 *
 * [정렬 규칙]
 * 1. category가 'all'이거나 지정되지 않은 경우:
 *    - 4대 카테고리 순서: 재학생(student) -> 졸업생(alumni) -> 교수진(professor) -> 관리자(admin)
 * 2. 재학생(student):
 *    - 입학 학번 작은 순서대로 정렬 (오름차순: 20학번 -> 21학번 -> ... -> 26학번)
 *    - 동일 학번인 경우 한국어 이름 가나다순 ('ko-KR')
 *    - 학번이 없는 회원은 해당 카테고리의 마지막에 표시
 * 3. 졸업생(alumni):
 *    - 졸업 연도가 아닌 입학 학번이 작은 순서대로 정렬 (예: 2026학년도(22학번)은 22학번 기준)
 *    - 동일 학번인 경우 한국어 이름 가나다순 ('ko-KR')
 *    - 학번이 없는 회원은 해당 카테고리의 마지막에 표시
 * 4. 교수진(professor):
 *    - 교수 이름의 한국어 가나다순 ('ko-KR', 학번 미적용)
 * 5. 관리자(admin):
 *    - 관리자 이름의 한국어 가나다순 ('ko-KR', 학번 미적용)
 * 6. 안정적인 정렬:
 *    - 학번과 이름이 완전히 같을 경우 고유 ID(id)로 일관된 보조 정렬 보장
 */
export function compareAdminUsers<
  T extends {
    id?: string;
    name?: string;
    role?: string;
    studentIdOrYear?: string | null;
    bio?: string | null;
    academicProfile?: any;
  }
>(a: T, b: T, category?: AdminUserRoleCategory): number {
  const roleA = a.role;
  const roleB = b.role;

  // 전체('all') 탭인 경우 역할 카테고리 우선 순서 (재학생 -> 졸업생 -> 교수진 -> 관리자)
  if (!category || category === "all") {
    const roleOrder: Record<string, number> = {
      student: 1,
      alumni: 2,
      professor: 3,
      admin: 4,
    };
    const orderA = roleOrder[roleA || ""] || 99;
    const orderB = roleOrder[roleB || ""] || 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
  }

  const effectiveCategory =
    category && category !== "all" ? category : (roleA as AdminUserRoleCategory);

  // 1) 재학생 및 졸업생: 입학 학번 오름차순 -> 가나다순 -> 학번 누락자 맨 뒤
  if (effectiveCategory === "student" || effectiveCategory === "alumni") {
    const hakbunA = extractEntranceHakbun(a);
    const hakbunB = extractEntranceHakbun(b);

    if (hakbunA !== null && hakbunB !== null) {
      if (hakbunA !== hakbunB) {
        return hakbunA - hakbunB;
      }
    } else if (hakbunA !== null && hakbunB === null) {
      return -1; // 학번 보유자가 앞
    } else if (hakbunA === null && hakbunB !== null) {
      return 1; // 학번 누락자가 뒤
    }

    const nameDiff = (a.name || "").localeCompare(b.name || "", "ko-KR");
    if (nameDiff !== 0) return nameDiff;

    return (a.id || "").localeCompare(b.id || "");
  }

  // 2) 교수진 및 관리자: 한국어 이름 가나다순 ('ko-KR', 학번 미적용)
  const nameDiff = (a.name || "").localeCompare(b.name || "", "ko-KR");
  if (nameDiff !== 0) return nameDiff;

  return (a.id || "").localeCompare(b.id || "");
}

/**
 * 관리자 센터 회원 목록 정렬 함수
 */
export function sortAdminUsers<
  T extends {
    id?: string;
    name?: string;
    role?: string;
    studentIdOrYear?: string | null;
    bio?: string | null;
    academicProfile?: any;
  }
>(users: T[], category?: AdminUserRoleCategory): T[] {
  if (!Array.isArray(users)) return [];
  return [...users].sort((a, b) => compareAdminUsers(a, b, category));
}

/**
 * 관리자 센터 회원 필터링 (역할 + 승인 상태 + 검색어) 및 정렬 함수
 */
export function filterAndSortAdminUsers<
  T extends {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    studentIdOrYear?: string | null;
    approvalStatus?: ApprovalStatus | string;
    doubleMajor?: string | null;
    careerTrack?: string | null;
    verificationNote?: string | null;
    bio?: string | null;
    academicProfile?: any;
  }
>(
  users: T[],
  options: {
    roleFilter?: AdminUserRoleCategory;
    statusFilter?: AdminUserApprovalFilter;
    searchQuery?: string;
    onlyFullMembers?: boolean;
  }
): T[] {
  if (!Array.isArray(users)) return [];
  const { roleFilter = "all", statusFilter = "all", searchQuery = "", onlyFullMembers = false } = options;

  let result = users;

  // 0. 정회원 전용 필터링 (가입 대기, 보완 요청, 반려 회원 제외)
  if (onlyFullMembers) {
    result = result.filter((u) => isFullMemberStatus(u.approvalStatus));
  }

  // 1. 역할 필터
  if (roleFilter !== "all") {
    result = result.filter((u) => u.role === roleFilter);
  }

  // 2. 승인 상태 필터
  if (statusFilter !== "all") {
    result = result.filter((u) => {
      const st = u.approvalStatus || "pending";
      if (statusFilter === "needs_revision") {
        return isRevisionRequestedStatus(st);
      }
      return st === statusFilter;
    });
  }

  // 3. 검색어 필터 (이름, 이메일, 학번, UID, 복수전공/트랙, 메모)
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const id = (u.id || "").toLowerCase();
      const studId = (u.studentIdOrYear || "").toLowerCase();
      const track = (u.careerTrack || "").toLowerCase();
      const doubleMaj = (u.doubleMajor || "").toLowerCase();
      const note = (u.verificationNote || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        id.includes(q) ||
        studId.includes(q) ||
        track.includes(q) ||
        doubleMaj.includes(q) ||
        note.includes(q)
      );
    });
  }

  // 4. 카테고리별 정렬 적용
  return sortAdminUsers(result, roleFilter);
}

