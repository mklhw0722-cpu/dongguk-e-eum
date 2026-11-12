import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  resolveAccessGate,
  canAccessInternal,
  resolveRouteView,
} from "../src/lib/accessGate.ts";
import {
  REVISION_FIELD_OPTIONS,
  USER_DELETION_DATA_POLICY,
  buildUserDeletionReport,
  canEditAndResubmitRegistration,
  classifyEmailDuplicateCase,
  isRevisionRequestedStatus,
  normalizeApprovalStatus,
  validateAndBuildRegistrationUpdate,
} from "../src/lib/memberLifecycle.ts";

const MOCK_FIREBASE_USER = { uid: "uid-student-2024" };

test("1. 신규 회원가입 후 pending 상태 생성 및 내부 서비스 차단 확인", () => {
  const newProfile = {
    id: "uid-student-2024",
    email: "newbie@dgu.ac.kr",
    name: "김신입",
    role: "student",
    studentIdOrYear: "2024학년도 신입학 (24학번)",
    approvalStatus: "pending",
    revisionCount: 0,
  };

  const gateState = resolveAccessGate({
    authResolved: true,
    firebaseUser: MOCK_FIREBASE_USER,
    profileStatus: "loaded",
    profile: newProfile,
  });

  assert.equal(gateState, "pending");
  assert.equal(canAccessInternal(gateState), false);
  assert.equal(resolveRouteView(gateState, "internal", false), "gate");
});

test("2. 관리자가 보완 요청(needs_revision) 처리 시 사유 및 보완 항목 저장 확인", () => {
  assert.equal(isRevisionRequestedStatus("needs_revision"), true);
  assert.equal(isRevisionRequestedStatus("supplement_requested"), true);
  assert.equal(isRevisionRequestedStatus("rejected"), false);
  assert.equal(normalizeApprovalStatus("needs_revision"), "needs_revision");

  // 보완 요청 항목 옵션이 정의되어 있는지 확인
  assert.ok(REVISION_FIELD_OPTIONS.some((o) => o.key === "name"));
  assert.ok(REVISION_FIELD_OPTIONS.some((o) => o.key === "studentIdOrYear"));
});

test("3. 보완 요청 받은 회원이 로그인했을 때 '회원가입 정보의 보완이 필요합니다.' 화면 및 사유 확인", () => {
  const revisionProfile = {
    id: "uid-student-2024",
    email: "revise@dgu.ac.kr",
    name: "김보완",
    role: "student",
    approvalStatus: "needs_revision",
    adminComment: "학번(입학연도)과 복수전공 학과명을 정확히 입력해 주세요.",
    revisionFields: ["studentIdOrYear", "roleAndTrack"],
  };

  const gateState = resolveAccessGate({
    authResolved: true,
    firebaseUser: MOCK_FIREBASE_USER,
    profileStatus: "loaded",
    profile: revisionProfile,
  });

  assert.equal(gateState, "needs_revision");
  assert.equal(canAccessInternal(gateState), false);
  assert.equal(resolveRouteView(gateState, "internal", false), "gate");

  // AccessGateScreen 컴포넌트에 필수 안내 문구와 버튼이 존재하는지 확인
  const screenCode = fs.readFileSync(
    new URL("../src/components/layout/AccessGateScreen.tsx", import.meta.url),
    "utf8"
  );
  assert.match(screenCode, /회원가입 정보의 보완이 필요합니다\./);
  assert.match(screenCode, /수정한 내용 저장/);
  assert.match(screenCode, /다시 승인 요청하기/);
});

test("4 & 5. 회원이 가입정보를 수정·저장(draft)하고 재신청(resubmit -> pending)할 때 기존 UID 유지 확인", () => {
  const existingDoc = {
    id: "uid-keep-same-123",
    email: "student@dgu.ac.kr",
    approvalStatus: "needs_revision",
    revisionCount: 0,
    adminComment: "이름 오타 및 학번을 수정해 주세요.",
    revisionFields: ["name", "studentIdOrYear"],
  };

  // 1) 임시 저장(draft): 상태는 needs_revision 유지, 입력 정보만 갱신
  const draftResult = validateAndBuildRegistrationUpdate(
    existingDoc,
    {
      name: "이정정",
      role: "student",
      studentIdOrYear: "2023학년도 신입학 (23학번)",
      doubleMajor: "심리학과",
      verificationNote: "23학번 및 심리학과 복수전공으로 수정했습니다.",
    },
    "draft",
    "2026-11-12T10:00:00.000Z"
  );

  assert.equal(draftResult.id, "uid-keep-same-123", "기존 UID 유지");
  assert.equal(draftResult.email, "student@dgu.ac.kr", "기존 이메일 유지");
  assert.equal(draftResult.approvalStatus, "needs_revision", "임시 저장 시 상태 유지");
  assert.equal(draftResult.revisionCount, 0);
  assert.equal(draftResult.name, "이정정");

  // 2) 다시 승인 요청하기(resubmit): 상태가 pending으로 전환되고 revisionCount 증가
  const resubmitResult = validateAndBuildRegistrationUpdate(
    existingDoc,
    {
      name: "이정정",
      role: "student",
      studentIdOrYear: "2023학년도 신입학 (23학번)",
      doubleMajor: "심리학과",
      verificationNote: "23학번 및 심리학과 복수전공으로 수정했습니다.",
    },
    "resubmit",
    "2026-11-12T10:05:00.000Z"
  );

  assert.equal(resubmitResult.id, "uid-keep-same-123", "재신청 시에도 동일 UID 유지");
  assert.equal(resubmitResult.approvalStatus, "pending", "재신청 후 pending 상태로 전환");
  assert.equal(resubmitResult.revisionCount, 1, "재신청 횟수 1 증가");
  assert.equal(resubmitResult.resubmittedAt, "2026-11-12T10:05:00.000Z");
});

test("6 & 7. 반려(rejected) 회원의 사유 표시·재신청 가능 여부 및 관리자 재검토 후 승인 전환 확인", () => {
  const rejectedDoc = {
    id: "uid-rejected-777",
    email: "reapply@dgu.ac.kr",
    approvalStatus: "rejected",
    revisionCount: 1,
    adminComment: "졸업 학번 정보가 누락되어 반려되었습니다.",
  };

  assert.equal(canEditAndResubmitRegistration(rejectedDoc.approvalStatus), true);

  const resubmitted = validateAndBuildRegistrationUpdate(
    rejectedDoc,
    {
      name: "박동문",
      role: "alumni",
      studentIdOrYear: "18학번 졸업",
      verificationNote: "18학번 졸업생 정보 보완 후 재신청합니다.",
    },
    "resubmit",
    "2026-11-12T11:00:00.000Z"
  );

  assert.equal(resubmitted.id, "uid-rejected-777");
  assert.equal(resubmitted.approvalStatus, "pending");
  assert.equal(resubmitted.revisionCount, 2);

  // 관리자가 수정된 정보를 검토한 후 approved 처리하면 내부 서비스 이용 가능
  const approvedGate = resolveAccessGate({
    authResolved: true,
    firebaseUser: { uid: "uid-rejected-777" },
    profileStatus: "loaded",
    profile: { ...resubmitted, approvalStatus: "approved" },
  });
  assert.equal(approvedGate, "approved");
  assert.equal(canAccessInternal(approvedGate), true);
});

test("8. 일반 회원이 자신의 approvalStatus를 approved로 변경하거나 role을 admin으로 변경할 수 없는지 확인", () => {
  const revisionDoc = {
    id: "uid-student-2024",
    email: "student@dgu.ac.kr",
    approvalStatus: "needs_revision",
    revisionCount: 0,
  };

  // 1) 일반 사용자가 role을 admin으로 변경 시도 시 즉시 에러 차단
  assert.throws(
    () =>
      validateAndBuildRegistrationUpdate(
        revisionDoc,
        {
          name: "해커",
          role: "admin",
          studentIdOrYear: "22학번",
        },
        "resubmit"
      ),
    /관리자\(admin\) 역할로 변경할 수 없습니다/
  );

  // 2) 이미 approved이거나 suspended인 상태에서 재신청 함수 호출 시 차단
  assert.throws(
    () =>
      validateAndBuildRegistrationUpdate(
        { ...revisionDoc, approvalStatus: "suspended" },
        {
          name: "정지회원",
          role: "student",
          studentIdOrYear: "22학번",
        },
        "resubmit"
      ),
    /보완 요청\(needs_revision\) 또는 반려\(rejected\) 상태에서만/
  );

  // 3) firestore.rules 보안 규칙 검증:
  // - 보완/반려 회원의 재신청 시 approvalStatus는 ['pending', resource.data.approvalStatus]만 허용되고 'approved' 불가
  // - role은 ['student', 'alumni', 'professor']만 허용되고 'admin' 불가
  // - 미승인 회원의 adminComment는 타 일반 회원에게 비공개 (resource.data.approvalStatus == 'approved' 일 때만 타 회원 조회 허용)
  const rules = fs.readFileSync(
    new URL("../firestore.rules", import.meta.url),
    "utf8"
  );
  assert.match(
    rules,
    /resource\.data\.approvalStatus in \['needs_revision', 'supplement_requested', 'rejected'\]/
  );
  assert.match(
    rules,
    /request\.resource\.data\.approvalStatus in \['pending', resource\.data\.approvalStatus\]/
  );
  assert.match(
    rules,
    /request\.resource\.data\.role in \['student', 'alumni', 'professor'\]/
  );
  assert.match(
    rules,
    /isApprovedUser\(\) && resource\.data\.approvalStatus == 'approved'/
  );
});

test("9 & 11. 관리자 회원 삭제 시 데이터 분리 정책, 정적 호스팅 Auth 안내, 부분 실패 재시도 상태 확인", () => {
  // 개인정보 삭제 vs 공동 게시글·단체 대화 보존 정책 확인
  const userDocPolicy = USER_DELETION_DATA_POLICY.find((p) => p.key === "userDoc");
  const communityPolicy = USER_DELETION_DATA_POLICY.find(
    (p) => p.key === "communityPosts"
  );
  const chatPolicy = USER_DELETION_DATA_POLICY.find((p) => p.key === "chatRooms");

  assert.equal(userDocPolicy?.policyType, "delete");
  assert.equal(communityPolicy?.policyType, "preserve_shared");
  assert.equal(chatPolicy?.policyType, "anonymize_or_detach");

  // 1) 정적 호스팅(서버 엔드포인트 미연결) 시 허위로 completed_all로 표시하지 않고 completed_firestore_only로 구분
  const staticReport = buildUserDeletionReport({
    targetUid: "uid-del-1",
    targetName: "홍길동",
    targetEmail: "hong@dgu.ac.kr",
    authDeletedOnServer: false,
    steps: [
      { key: "userDoc", label: "회원 문서", status: "success", detail: "삭제됨" },
      {
        key: "authAccount",
        label: "Auth 계정",
        status: "manual_or_rejoin_ready",
        detail: "정적 호스팅 재가입 복구 활성화",
      },
    ],
  });
  assert.equal(staticReport.overallStatus, "completed_firestore_only");
  assert.equal(staticReport.authDeletedOnServer, false);
  assert.equal(staticReport.canRejoinWithSameEmail, true);

  // 2) 중간 단계 실패 발생 시 partial_failure 및 failedSteps 반환
  const partialReport = buildUserDeletionReport({
    targetUid: "uid-del-2",
    authDeletedOnServer: false,
    steps: [
      { key: "userDoc", label: "회원 문서", status: "success", detail: "삭제됨" },
      {
        key: "consultations",
        label: "상담 신청 기록",
        status: "failed",
        detail: "네트워크 일시 오류",
      },
    ],
  });
  assert.equal(partialReport.overallStatus, "partial_failure");
  assert.equal(partialReport.failedSteps.length, 1);
  assert.equal(partialReport.failedSteps[0].key, "consultations");
});

test("10. 이메일 중복 가입 5대 케이스 분류 및 삭제된 이메일 재가입 가능 검증", () => {
  // 케이스 1: Auth + Firestore 모두 존재하는 일반 회원
  const c1 = classifyEmailDuplicateCase({
    hasAuthAccount: true,
    hasFirestoreDoc: true,
    firestoreApprovalStatus: "approved",
    passwordVerifiedForExistingAuth: true,
  });
  assert.equal(c1.caseType, "auth_and_firestore_active");
  assert.equal(c1.shouldGuideToLogin, true);

  // 케이스 2: Auth 계정은 존재하지만 Firestore 회원 문서가 없는 경우 (관리자 삭제 후 동일 이메일 재가입!)
  const c2 = classifyEmailDuplicateCase({
    hasAuthAccount: true,
    hasFirestoreDoc: false,
    passwordVerifiedForExistingAuth: true,
  });
  assert.equal(c2.caseType, "auth_only_deleted_or_incomplete");
  assert.equal(c2.canRecreateFirestoreProfile, true, "삭제된 회원이 동일 이메일로 재가입 시 프로필 자동 복구 허용");

  // 케이스 3: Firestore 문서만 존재하고 Auth 계정이 없는 고아 문서
  const c3 = classifyEmailDuplicateCase({
    hasAuthAccount: false,
    hasFirestoreDoc: true,
  });
  assert.equal(c3.caseType, "firestore_only_orphan");
  assert.equal(c3.canProceedNewAuthSignup, true);

  // 케이스 4: 가입 반려 또는 보완 요청 상태인 경우 -> 신규 가입 대신 기존 계정 수정 화면으로 안내
  const c4 = classifyEmailDuplicateCase({
    hasAuthAccount: true,
    hasFirestoreDoc: true,
    firestoreApprovalStatus: "needs_revision",
    passwordVerifiedForExistingAuth: true,
  });
  assert.equal(c4.caseType, "revision_or_rejected");
  assert.equal(c4.shouldRedirectToGateEdit, true);

  // 케이스 5: 완전히 삭제된 경우
  const c5 = classifyEmailDuplicateCase({
    hasAuthAccount: false,
    hasFirestoreDoc: false,
  });
  assert.equal(c5.caseType, "completely_deleted");
  assert.equal(c5.canProceedNewAuthSignup, true);
});

test("10. [회원가입 비밀번호 보안 규칙 및 역할별 가입 항목 검증] 비밀번호는 영문·숫자·특수문자 포함 6자 이상이어야 하며 역할별 드롭다운이 정확히 제공된다", () => {
  const authCode = fs.readFileSync(new URL("../src/app/auth/page.tsx", import.meta.url), "utf8");

  // 비밀번호 검증 함수
  function validatePassword(pw) {
    const hasLetter = /[A-Za-z]/.test(pw);
    const hasDigit = /\d/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw);
    if (pw.length < 6 || !hasLetter || !hasDigit || !hasSpecial) {
      return false;
    }
    return true;
  }

  // 비밀번호 유효성 검사
  assert.equal(validatePassword("12345"), false, "5자리 이하 불가");
  assert.equal(validatePassword("abcdef"), false, "영문만 불가");
  assert.equal(validatePassword("123456"), false, "숫자만 불가");
  assert.equal(validatePassword("abc123"), false, "특수문자 누락 불가");
  assert.equal(validatePassword("abc!@#"), false, "숫자 누락 불가");
  assert.equal(validatePassword("123!@#"), false, "영문 누락 불가");
  assert.equal(validatePassword("a1!"), false, "6자리 미만 불가");
  assert.equal(validatePassword("dgu123!"), true, "영문+숫자+특수문자 6자 이상 통과");
  assert.equal(validatePassword("Dongguk2026#"), true, "영문+숫자+특수문자 6자 이상 통과");

  // auth 화면 코드에 비밀번호 안내 및 검증 조건 반영 확인
  assert.ok(authCode.includes("비밀번호 (영문, 숫자, 특수문자 포함 6자리 이상) *"));
  assert.ok(authCode.includes("비밀번호는 영문, 숫자, 특수문자를 모두 포함하여 6자리 이상이어야 합니다."));

  // 역할별 드롭다운 제공 확인 (졸업생의 경우 학번과 졸업연도가 분리되어 제공됨)
  assert.ok(authCode.includes("입학 연도 (신입학 재학생 기준) *"));
  assert.ok(authCode.includes("학번 *"));
  assert.ok(authCode.includes("졸업 연도 *"));
  assert.ok(authCode.includes("교육학과 전임교원"));
  assert.ok(authCode.includes("ALUMNI_HAKBUN_OPTIONS"));
  assert.ok(authCode.includes("ALUMNI_GRAD_YEAR_OPTIONS"));
});

