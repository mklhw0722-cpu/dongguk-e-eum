import type {
  ApprovalStatus,
  StudentAcademicProfile,
  User,
  UserRole,
} from "../types/index.ts";

/**
 * 보완 요청 항목 선택지 (관리자가 체크박스로 지정 가능)
 */
export const REVISION_FIELD_OPTIONS = [
  { key: "name", label: "이름 (실명)" },
  { key: "studentIdOrYear", label: "학번 / 입학연도" },
  { key: "roleAndTrack", label: "신청 구분 및 전공·교직 이수 트랙" },
  { key: "verificationNote", label: "소속 확인 메모 / 증빙 내용" },
] as const;

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
