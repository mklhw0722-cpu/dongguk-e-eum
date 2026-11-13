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
  extractEntranceHakbun,
  compareAdminUsers,
  sortAdminUsers,
  filterAndSortAdminUsers,
  isRegistrationPendingStatus,
  isFullMemberStatus,
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

test("11. [학번 파싱 정규화 - extractEntranceHakbun] 2자리 학번, 4자리 입학연도, '2026학년도(22학번)', '99학번 이전', 10자리 학번을 정확하게 입학 학번 4자리 숫자로 파싱한다", () => {
  // 24학번 -> 2024
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "24학번" }), 2024);
  // 2022 -> 2022
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "2022" }), 2022);
  // 2026학년도(22학번) -> 졸업연도가 아닌 괄호 안 입학 학번 2022 추출
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "2026학년도(22학번)" }), 2022);
  // 99학번 이전 -> 1999
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "99학번 이전" }), 1999);
  // 10자리 학번 2023112345 -> 2023
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "2023112345" }), 2023);
  // 빈 값 / 미기재 -> null
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "" }), null);
  assert.equal(extractEntranceHakbun(null), null);
  assert.equal(extractEntranceHakbun(undefined), null);
});

test("12. [관리자 센터 재학생 정렬] 입학 학번 작은 순서(20 -> 21 -> 22...)로 정렬되고 동일 학번은 한국어 이름 가나다순, 미기재자는 맨 뒤에 위치한다", () => {
  const students = [
    { id: "s1", name: "홍길동", role: "student", studentIdOrYear: "24학번" },
    { id: "s2", name: "강감찬", role: "student", studentIdOrYear: "21학번" },
    { id: "s3", name: "김유신", role: "student", studentIdOrYear: "21학번" },
    { id: "s4", name: "이순신", role: "student", studentIdOrYear: "20학번" },
    { id: "s5", name: "나미정", role: "student", studentIdOrYear: "" },
    { id: "s6", name: "안중근", role: "student", studentIdOrYear: "26학번" },
  ];

  const sorted = sortAdminUsers(students, "student");
  // 20학번: 이순신 (s4)
  // 21학번: 강감찬 (s2) -> 김유신 (s3)
  // 24학번: 홍길동 (s1)
  // 26학번: 안중근 (s6)
  // 미기재: 나미정 (s5)
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["s4", "s2", "s3", "s1", "s6", "s5"]
  );
});

test("13. [관리자 센터 졸업생 정렬] 졸업 연도가 아닌 입학 학번 기준으로 작은 순서대로 정렬되며 동일 학번은 가나다순, 미기재자는 맨 뒤에 위치한다", () => {
  const alumni = [
    { id: "a1", name: "최선배", role: "alumni", studentIdOrYear: "2026학년도(22학번)" }, // 입학: 2022
    { id: "a2", name: "강선배", role: "alumni", studentIdOrYear: "2024학년도(18학번)" }, // 입학: 2018
    { id: "a3", name: "김선배", role: "alumni", studentIdOrYear: "2024학년도(18학번)" }, // 입학: 2018
    { id: "a4", name: "고선배", role: "alumni", studentIdOrYear: "99학번 이전" },        // 입학: 1999
    { id: "a5", name: "박선배", role: "alumni", studentIdOrYear: "20학번" },             // 입학: 2020
    { id: "a6", name: "무학번", role: "alumni", studentIdOrYear: "" },                   // 입학: 미기재
  ];

  const sorted = sortAdminUsers(alumni, "alumni");
  // 1999: 고선배 (a4)
  // 2018: 강선배 (a2) -> 김선배 (a3) (가나다순)
  // 2020: 박선배 (a5)
  // 2022: 최선배 (a1)
  // 미기재: 무학번 (a6)
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["a4", "a2", "a3", "a5", "a1", "a6"]
  );
});

test("14. [관리자 센터 교수진 정렬] 학번 기준이 적용되지 않고 교수 이름의 한국어 가나다순(ko-KR)으로 정렬된다", () => {
  const professors = [
    { id: "p1", name: "황교수", role: "professor", studentIdOrYear: "95학번" },
    { id: "p2", name: "강교수", role: "professor", studentIdOrYear: "00학번" },
    { id: "p3", name: "김교수", role: "professor", studentIdOrYear: "" },
    { id: "p4", name: "남궁교수", role: "professor", studentIdOrYear: "88학번" },
  ];

  const sorted = sortAdminUsers(professors, "professor");
  // 가나다순: 강교수 -> 김교수 -> 남궁교수 -> 황교수
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["p2", "p3", "p4", "p1"]
  );
});

test("15. [관리자 센터 관리자 정렬] 관리자 이름의 한국어 가나다순(ko-KR)으로 정렬된다", () => {
  const admins = [
    { id: "adm3", name: "홍관리자", role: "admin" },
    { id: "adm1", name: "강관리자", role: "admin" },
    { id: "adm2", name: "이관리자", role: "admin" },
  ];

  const sorted = sortAdminUsers(admins, "admin");
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["adm1", "adm2", "adm3"]
  );
});

test("16. [관리자 센터 전체 회원 정렬] 전체 탭 선택 시 재학생 -> 졸업생 -> 교수진 -> 관리자 순으로 구분 및 각 카테고리 내부 정렬된다", () => {
  const mixed = [
    { id: "adm1", name: "관리자", role: "admin" },
    { id: "prof1", name: "강교수", role: "professor" },
    { id: "alm1", name: "김졸업", role: "alumni", studentIdOrYear: "20학번" },
    { id: "stu2", name: "홍길동", role: "student", studentIdOrYear: "24학번" },
    { id: "stu1", name: "이순신", role: "student", studentIdOrYear: "22학번" },
  ];

  const sorted = sortAdminUsers(mixed, "all");
  // 재학생: stu1(22학번) -> stu2(24학번)
  // 졸업생: alm1
  // 교수진: prof1
  // 관리자: adm1
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["stu1", "stu2", "alm1", "prof1", "adm1"]
  );
});

test("17. [동일 학번·이름 안정적 정렬] 학번과 이름이 완전히 같아도 UID 기준 일관된 순서를 보장한다", () => {
  const users = [
    { id: "user-b", name: "이동국", role: "student", studentIdOrYear: "23학번" },
    { id: "user-a", name: "이동국", role: "student", studentIdOrYear: "23학번" },
  ];

  const sorted = sortAdminUsers(users, "student");
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["user-a", "user-b"]
  );
});

test("18. [검색 및 승인 상태 필터링 연동 - filterAndSortAdminUsers] 역할, 승인 상태, 검색어 필터가 모두 정상 적용되고 정렬된다", () => {
  const users = [
    { id: "u1", name: "이순신", role: "student", studentIdOrYear: "22학번", approvalStatus: "approved", email: "lee@dgu.ac.kr" },
    { id: "u2", name: "강감찬", role: "student", studentIdOrYear: "21학번", approvalStatus: "pending", email: "kang@dgu.ac.kr" },
    { id: "u3", name: "김유신", role: "student", studentIdOrYear: "23학번", approvalStatus: "needs_revision", email: "kim@dgu.ac.kr" },
    { id: "u4", name: "홍길동", role: "student", studentIdOrYear: "20학번", approvalStatus: "approved", email: "hong@dgu.ac.kr" },
    { id: "u5", name: "최선배", role: "alumni", studentIdOrYear: "19학번", approvalStatus: "approved", email: "choi@dgu.ac.kr" },
  ];

  // 1) 승인 상태 필터: approved만 조회 -> u4(20학번) -> u1(22학번)
  const approvedStudents = filterAndSortAdminUsers(users, {
    roleFilter: "student",
    statusFilter: "approved",
  });
  assert.deepEqual(
    approvedStudents.map((u) => u.id),
    ["u4", "u1"]
  );

  // 2) 승인 상태 필터: pending만 조회 -> u2
  const pendingStudents = filterAndSortAdminUsers(users, {
    roleFilter: "student",
    statusFilter: "pending",
  });
  assert.deepEqual(
    pendingStudents.map((u) => u.id),
    ["u2"]
  );

  // 3) 검색어 필터: "이순신" -> u1
  const searchName = filterAndSortAdminUsers(users, {
    searchQuery: "이순신",
  });
  assert.deepEqual(
    searchName.map((u) => u.id),
    ["u1"]
  );

  // 4) 검색어 필터: "21학번" -> u2
  const searchHakbun = filterAndSortAdminUsers(users, {
    searchQuery: "21학번",
  });
  assert.deepEqual(
    searchHakbun.map((u) => u.id),
    ["u2"]
  );
});

test("19. [관리자 센터 UI 소스코드 검증] 4대 카테고리 탭, 검색창, 승인상태 필터, 정렬 배지, 역할 변경 및 삭제 기능이 유지된다", () => {
  const adminSrc = fs.readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");

  // 1) 4대 카테고리 탭 (재학생, 졸업생, 교수진, 관리자, 전체)
  assert.match(adminSrc, /key:\s*"student"[\s\S]*?label:\s*"재학생"/);
  assert.match(adminSrc, /key:\s*"alumni"[\s\S]*?label:\s*"졸업생"/);
  assert.match(adminSrc, /key:\s*"professor"[\s\S]*?label:\s*"교수진"/);
  assert.match(adminSrc, /key:\s*"admin"[\s\S]*?label:\s*"관리자"/);

  // 2) 검색창
  assert.match(adminSrc, /userSearchQuery/);
  assert.match(adminSrc, /회원 이름, 학번, 이메일, UID, 복수전공 검색/);

  // 3) 승인 상태별 필터 드롭다운
  assert.match(adminSrc, /userStatusFilter/);
  assert.match(adminSrc, /전체 승인 상태/);

  // 4) filterAndSortAdminUsers 연동
  assert.match(adminSrc, /filterAndSortAdminUsers\(targetList/);

  // 5) 역할 변경 버튼 및 회원 삭제 버튼 유지
  assert.match(adminSrc, /handleUpdateRole/);
  assert.match(adminSrc, /handleDeleteUser/);
});

test("20. [단체 채팅방 및 타 시스템 영향 없음 검증] 단체 채팅방 개설 모달과 회원 분류가 온전히 유지된다", () => {
  const chatSrc = fs.readFileSync(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");

  assert.match(chatSrc, /GroupChatCategoryTab/);
  assert.match(chatSrc, /sortChatUsersForGroupCreation/);
  assert.match(chatSrc, /label:\s*"재학생"/);
  assert.match(chatSrc, /label:\s*"졸업생"/);
  assert.match(chatSrc, /label:\s*"교수진"/);
});

test("21. [가입 승인 대상과 전체 회원 관리 정회원 목록의 엄격한 분리 검증] pending/needs_revision/rejected는 가입 승인에만, approved/suspended는 전체 회원 관리에만 분류된다", () => {
  // 1) 상태 판별 유틸리티 검증
  assert.equal(isRegistrationPendingStatus("pending"), true);
  assert.equal(isRegistrationPendingStatus("needs_revision"), true);
  assert.equal(isRegistrationPendingStatus("supplement_requested"), true);
  assert.equal(isRegistrationPendingStatus("rejected"), true);
  assert.equal(isRegistrationPendingStatus("approved"), false);
  assert.equal(isRegistrationPendingStatus("suspended"), false);

  assert.equal(isFullMemberStatus("approved"), true);
  assert.equal(isFullMemberStatus("suspended"), true);
  assert.equal(isFullMemberStatus("pending"), false);
  assert.equal(isFullMemberStatus("needs_revision"), false);
  assert.equal(isFullMemberStatus("supplement_requested"), false);
  assert.equal(isFullMemberStatus("rejected"), false);

  // 2) 혼합 회원 목록 분리 검증
  const mixedUsers = [
    { id: "u-pen", name: "김대기", role: "student", approvalStatus: "pending" },
    { id: "u-rev", name: "이보완", role: "student", approvalStatus: "needs_revision" },
    { id: "u-rej", name: "박반려", role: "student", approvalStatus: "rejected" },
    { id: "u-app1", name: "최승인", role: "student", approvalStatus: "approved" },
    { id: "u-app2", name: "정교수", role: "professor", approvalStatus: "approved" },
    { id: "u-sus", name: "강정지", role: "alumni", approvalStatus: "suspended" },
  ];

  const pendingList = mixedUsers.filter((u) => isRegistrationPendingStatus(u.approvalStatus));
  const fullMemberList = mixedUsers.filter((u) => isFullMemberStatus(u.approvalStatus));

  // 가입 승인 관리 대상: pending, needs_revision, rejected (총 3명)
  assert.deepEqual(
    pendingList.map((u) => u.id),
    ["u-pen", "u-rev", "u-rej"]
  );

  // 전체 회원 관리 대상: approved, suspended (총 3명)
  assert.deepEqual(
    fullMemberList.map((u) => u.id),
    ["u-app1", "u-app2", "u-sus"]
  );

  // 두 목록 간에 중복(교집합)이 완전히 0건이어야 함
  const intersection = pendingList.filter((p) => fullMemberList.some((f) => f.id === p.id));
  assert.equal(intersection.length, 0);
});

test("22. [관리자 승인 처리 후 정회원 목록 실시간 이동 및 카운트 갱신 시뮬레이션] 승인 시 대기 목록에서 제외되고 정회원 목록에 즉시 추가된다", () => {
  let userList = [
    { id: "stu-1", name: "신입생", role: "student", studentIdOrYear: "24학번", approvalStatus: "pending" },
    { id: "stu-2", name: "재학생", role: "student", studentIdOrYear: "22학번", approvalStatus: "approved" },
  ];

  // 승인 전 상태
  let pending = userList.filter((u) => isRegistrationPendingStatus(u.approvalStatus));
  let full = userList.filter((u) => isFullMemberStatus(u.approvalStatus));
  assert.equal(pending.length, 1);
  assert.equal(full.length, 1);
  assert.equal(full[0].id, "stu-2");

  // 관리자가 stu-1을 'approved'로 승인 처리
  userList = userList.map((u) => (u.id === "stu-1" ? { ...u, approvalStatus: "approved" } : u));

  // 승인 후 실시간 반영 상태
  pending = userList.filter((u) => isRegistrationPendingStatus(u.approvalStatus));
  full = userList.filter((u) => isFullMemberStatus(u.approvalStatus));
  assert.equal(pending.length, 0, "대기 목록에서 자동 제외");
  assert.equal(full.length, 2, "정회원 목록에 자동 추가");

  // 정렬 검증: 22학번(stu-2) -> 24학번(stu-1)
  const sortedFull = sortAdminUsers(full, "student");
  assert.deepEqual(
    sortedFull.map((u) => u.id),
    ["stu-2", "stu-1"]
  );
});

test("23. [이용 정지 회원의 정회원 목록 보존 및 필터링 검증] suspended 회원이 전체 회원 목록에서 누락되지 않고 필터로 조회 가능하다", () => {
  const users = [
    { id: "u-active", name: "정상회원", role: "student", approvalStatus: "approved" },
    { id: "u-suspended", name: "정지회원", role: "student", approvalStatus: "suspended" },
  ];

  // 전체 상태(all): 둘 다 노출
  const allFull = filterAndSortAdminUsers(users, {
    onlyFullMembers: true,
    statusFilter: "all",
  });
  assert.equal(allFull.length, 2);

  // 승인 완료(approved) 필터: 정상 회원만
  const approvedOnly = filterAndSortAdminUsers(users, {
    onlyFullMembers: true,
    statusFilter: "approved",
  });
  assert.deepEqual(approvedOnly.map((u) => u.id), ["u-active"]);

  // 이용 정지(suspended) 필터: 정지 회원만
  const suspendedOnly = filterAndSortAdminUsers(users, {
    onlyFullMembers: true,
    statusFilter: "suspended",
  });
  assert.deepEqual(suspendedOnly.map((u) => u.id), ["u-suspended"]);
});

test("24. [관리자 센터 UI 소스코드 검증: 승인 대상 및 정회원 분리 구조] pendingRealUsers와 fullMembersList가 정확히 분리되어 사용된다", () => {
  const adminSrc = fs.readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");

  // 1) pendingRealUsers가 isRegistrationPendingStatus로 필터링되는지 확인
  assert.match(adminSrc, /realUsersForAdmin\.filter\(\(u\)\s*=>\s*isRegistrationPendingStatus\(u\.approvalStatus\)\)/);

  // 2) fullMembersList가 isFullMemberStatus로 필터링되는지 확인
  assert.match(adminSrc, /rawList\.filter\(\(u\)\s*=>\s*isFullMemberStatus\(u\.approvalStatus\)\)/);

  // 3) 상단 메인 탭 '전체 회원 관리'에 fullMembersList.length가 표시되는지 확인
  assert.match(adminSrc, /전체 회원 관리 \(\s*\{fullMembersList\.length\}\)/);

  // 4) 역할별 카테고리 탭 카운트에 fullMembersList가 사용되는지 확인
  assert.match(adminSrc, /fullMembersList\.filter\(\s*\(u\)\s*=>\s*tab\.key === "all" \|\| u\.role === tab\.key/);

  // 5) 전체 회원 관리 목록 렌더링에 fullMembersList가 타겟으로 전달되는지 확인
  assert.match(adminSrc, /filterAndSortAdminUsers\(targetList,\s*\{[\s\S]*?onlyFullMembers:\s*true/);
});



