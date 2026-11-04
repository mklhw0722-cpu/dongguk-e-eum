// 동국e음 — 동국대학교 교육학과 졸업요건 관리 시스템(https://edu.dongguk.edu/page/619) 검증 테스트
// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  OFFICIAL_GRADUATION_CATALOG,
  OFFICIAL_GUIDE_URL,
  OFFICIAL_COURSE_PRESETS,
  EDU_MAJOR_REQUIRED_CODES,
  EDU_TEACHING_SUBSTITUTION_MAP,
  resolveCohortBand,
  resolveApplicableRequirements,
  migrateStudentProgress,
  sortCoursesBySemester,
  detectDuplicateCourses,
  evaluateSchoolPracticum,
  calculateGraduationAudit,
  createEmptyStudentProgress,
  getStudentGraduationCacheKey,
  shouldApplyCloudGraduationSnapshot,
} from "../src/lib/graduationCurriculum.ts";

test("1. [입학 연도별 졸업요건 적용] 2014~2026학년도 신입학 연도 구간별 공식 학점 및 성인지 교육 횟수(2회 vs 4회)가 정확히 적용된다", () => {
  assert.equal(resolveCohortBand(2014), "2014-2015");
  assert.equal(resolveCohortBand(2018), "2016-2020");
  assert.equal(resolveCohortBand(2022), "2021-2022");
  assert.equal(resolveCohortBand(2023), "2023");
  assert.equal(resolveCohortBand(2025), "2024-2025");
  assert.equal(resolveCohortBand(2026), "2026");

  // 2019학번(2020 이전 입학): 성인지 교육 2회 이상, 공통교양 29~31(확인 필요), 학문기초 외국어 6학점
  const req2019 = resolveApplicableRequirements({
    admissionYearNumber: 2019,
    admissionYearLabel: "2019학년도 신입학 (19학번)",
    majorPlanType: "single",
    hasDoubleMajor: false,
    doubleMajorDepartment: "",
    teachingTrackStatus: "educational_major",
    isEnglishTrack: false,
    updatedAt: "2026-10-28",
  });
  assert.equal(req2019.cohortRule.totalGraduationCredits, 130);
  assert.equal(req2019.genderSensitivityRequiredCount, 2);
  assert.equal(req2019.commonLiberalArtsStatus, "needs_admin_review");
  assert.equal(req2019.academicFoundationTargetCredits, 6);

  // 2022학번: 성인지 교육 4회 이상, 공통교양 29학점(확정)
  const req2022 = resolveApplicableRequirements({
    admissionYearNumber: 2022,
    admissionYearLabel: "2022학년도 신입학 (22학번)",
    majorPlanType: "single",
    hasDoubleMajor: false,
    doubleMajorDepartment: "",
    teachingTrackStatus: "educational_major",
    isEnglishTrack: false,
    updatedAt: "2026-10-28",
  });
  assert.equal(req2022.genderSensitivityRequiredCount, 4);
  assert.equal(req2022.commonLiberalArtsTargetCredits, 29);
  assert.equal(req2022.commonLiberalArtsStatus, "confirmed");

  // 2025학번: 공통교양 28학점(확정), 사범대 일반 단일전공 참조값 60학점 / 교육학과 별도 단일전공 66학점
  const req2025 = resolveApplicableRequirements({
    admissionYearNumber: 2025,
    admissionYearLabel: "2025학년도 신입학 (25학번)",
    majorPlanType: "single",
    hasDoubleMajor: false,
    doubleMajorDepartment: "",
    teachingTrackStatus: "educational_major",
    isEnglishTrack: false,
    updatedAt: "2026-10-28",
  });
  assert.equal(req2025.commonLiberalArtsTargetCredits, 28);
  assert.equal(req2025.generalMajorReferenceCredits, 60);
  assert.equal(req2025.eduMajorTargetCredits, 66);

  // 2014학번: 각주('2015학년도 입학생부터 대체이수 교직학점 12학점 추가 이수')에 따라 전공학점 확인 필요 표시
  const req2014 = resolveApplicableRequirements({
    admissionYearNumber: 2014,
    admissionYearLabel: "2014학년도 신입학 (14학번)",
    majorPlanType: "single",
    hasDoubleMajor: false,
    doubleMajorDepartment: "",
    teachingTrackStatus: "educational_major",
    isEnglishTrack: false,
    updatedAt: "2026-10-28",
  });
  assert.equal(req2014.eduMajorTargetStatus, "needs_admin_review");
});

test("2. [단일전공·복수전공 및 교직 트랙 분리] 전공 이수 형태와 교직 이수 상태가 중복 없이 독립적으로 조합·적용된다", () => {
  // 케이스 A: 단일전공 + 주전공 교직 이수 -> 교육학과 전공 66학점
  const singleEdu = resolveApplicableRequirements({
    admissionYearNumber: 2024,
    admissionYearLabel: "2024학년도 신입학 (24학번)",
    majorPlanType: "single",
    hasDoubleMajor: false,
    doubleMajorDepartment: "",
    teachingTrackStatus: "educational_major",
    isEnglishTrack: false,
    updatedAt: "2026-10-28",
  });
  assert.equal(singleEdu.eduMajorTargetCredits, 66);
  assert.equal(singleEdu.doubleMajorTargetCredits, null);
  assert.equal(singleEdu.teachingRequired, true);

  // 케이스 B: 사범대 타 학과 복수전공(국어교육과) + 복수전공 교직 병행 -> 교육학과 주전공 62학점 + 사범대 복수전공 50학점(확정)
  const doubleEdu = resolveApplicableRequirements({
    admissionYearNumber: 2024,
    admissionYearLabel: "2024학년도 신입학 (24학번)",
    majorPlanType: "double_edu",
    hasDoubleMajor: true,
    doubleMajorDepartment: "국어교육과",
    teachingTrackStatus: "double_teaching",
    isEnglishTrack: false,
    updatedAt: "2026-10-28",
  });
  assert.equal(doubleEdu.eduMajorTargetCredits, 62);
  assert.equal(doubleEdu.doubleMajorTargetCredits, 50);
  assert.equal(doubleEdu.doubleMajorTargetStatus, "confirmed");
  assert.equal(doubleEdu.teachingRequired, true);

  // 케이스 C: 비사범대 일반학과 복수전공(심리학과) + 주전공 교직 이수 -> 교육학과 주전공 62학점 + 타 학과 기준(확인 필요, null)
  const doubleGen = resolveApplicableRequirements({
    admissionYearNumber: 2024,
    admissionYearLabel: "2024학년도 신입학 (24학번)",
    majorPlanType: "double_general",
    hasDoubleMajor: true,
    doubleMajorDepartment: "심리학과",
    teachingTrackStatus: "educational_major",
    isEnglishTrack: false,
    updatedAt: "2026-10-28",
  });
  assert.equal(doubleGen.eduMajorTargetCredits, 62);
  assert.equal(doubleGen.doubleMajorTargetCredits, null);
  assert.equal(doubleGen.doubleMajorTargetStatus, "needs_admin_review");
  assert.equal(doubleGen.teachingRequired, true);
});

test("3 & 6. [교육학과 교직이론 대체인정 및 동일 강좌 학점 이중 계산 방지] 전공 대체과목 6개(18학점) 이수 시 총 졸업학점과 전공학점에는 18학점만 합산되고 교직이론 6과목(12학점 요건)이 동시에 충족된다", () => {
  assert.equal(EDU_TEACHING_SUBSTITUTION_MAP.length, 8);

  // 교육학과 전공 대체과목 6개(각 3학점 = 총 18학점)만 등록한 학생
  const sixSubstitutedCourses = EDU_TEACHING_SUBSTITUTION_MAP.slice(0, 6).map((item, idx) => ({
    id: `c-sub-${idx + 1}`,
    courseCode: item.eduCourseCode,
    courseTitle: item.eduCourseTitle,
    credits: 3,
    yearTaken: 2023 + Math.floor(idx / 2),
    semesterTaken: idx % 2 === 0 ? "1학기" : "2학기",
    category: "전공필수/선택 (교육학과)",
    isCompleted: true,
    recognitionStatus: "confirmed",
    createdAt: "2026-10-28",
  }));

  const progress = migrateStudentProgress({
    userId: "u-test-1",
    academicProfile: {
      admissionYearNumber: 2023,
      admissionYearLabel: "2023학년도 신입학 (23학번)",
      majorPlanType: "single",
      hasDoubleMajor: false,
      doubleMajorDepartment: "",
      teachingTrackStatus: "educational_major",
      isEnglishTrack: false,
      updatedAt: "2026-10-28",
    },
    courses: sixSubstitutedCourses,
    credits: {},
    volunteeringRecords: [],
    checklist: [],
  });

  const audit = calculateGraduationAudit(progress, OFFICIAL_GRADUATION_CATALOG);

  // 1) 총 졸업학점(130)에는 6과목 * 3학점 = 18학점만 정확히 1회 합산되어야 함 (교직이론 12학점이 이중으로 더해져 30학점이 되면 안 됨!)
  assert.equal(audit.totalEarnedCredits, 18);
  // 2) 교육학과 전공학점(66학점 기준)에도 18학점 반영
  assert.equal(audit.eduMajorEarnedCredits, 18);
  // 3) 교직이론 대체인정 과목 수 6과목(12학점 상당) 충족!
  assert.equal(audit.teachingTheoryAudit.recognizedSubjectCount, 6);
  assert.equal(audit.teachingTheoryAudit.recognizedEquivalentCredits, 12);
  assert.equal(audit.teachingTheoryAudit.isFulfilled, true);
});

test("4 & 5. [강좌 정렬 및 중복 강좌 등록 감지] 학기별 정렬이 정확하며, 동일 학수번호·강좌명 등록 시 자동 삭제 대신 중복 경고를 반환한다", () => {
  const unsorted = [
    {
      id: "c2",
      courseCode: "EDU2015",
      courseTitle: "교육심리",
      credits: 3,
      yearTaken: 2024,
      semesterTaken: "2학기",
      category: "전공필수/선택 (교육학과)",
      isCompleted: true,
      createdAt: "2026-10-28",
    },
    {
      id: "c1",
      courseCode: "EDU2013",
      courseTitle: "교육학개론",
      credits: 3,
      yearTaken: 2023,
      semesterTaken: "1학기",
      category: "전공필수/선택 (교육학과)",
      isCompleted: true,
      createdAt: "2026-10-28",
    },
    {
      id: "c3",
      courseCode: "EDU2002",
      courseTitle: "교육철학",
      credits: 3,
      yearTaken: 2024,
      semesterTaken: "1학기",
      category: "전공필수/선택 (교육학과)",
      isCompleted: true,
      createdAt: "2026-10-28",
    },
  ];

  const sorted = sortCoursesBySemester(unsorted);
  assert.deepEqual(
    sorted.map((c) => c.id),
    ["c1", "c3", "c2"]
  );

  // 동일 학수번호 중복 감지
  const dupByCode = detectDuplicateCourses(
    { courseCode: "edu2013", courseTitle: "교육학개론(재)" },
    sorted
  );
  assert.equal(dupByCode.hasExactDuplicate, true);
  assert.ok(dupByCode.warningMessage.includes("EDU2013"));

  // 동일 과목명 중복 감지
  const dupByTitle = detectDuplicateCourses(
    { courseCode: "", courseTitle: "교육 심리" },
    sorted
  );
  assert.equal(dupByTitle.hasExactDuplicate, true);

  // 수정 시 자기 자신(id 동일)은 중복으로 오판하지 않음
  const selfEdit = detectDuplicateCourses(
    { id: "c1", courseCode: "EDU2013", courseTitle: "교육학개론" },
    sorted
  );
  assert.equal(selfEdit.hasExactDuplicate, false);
});

test("7 & 8. [교육봉사·학교현장실습 조합·교직 체크리스트 검증] 실습 Ⅰ+Ⅱ, Ⅲ, Ⅰ+Ⅱ+Ⅲ 조합과 Ⅰ 미이수 시 Ⅱ 불가 규칙, 봉사 60시간, 성인지·인성·심폐소생·평점이 정확히 판별된다", () => {
  const baseChecklist = {
    personalityTestPassCount: 2,
    cprCompletedCount: 2,
    cprExternalCount: 1,
    genderSensitivityCount: 4,
    majorGpa: 3.5,
    teachingGpa: 3.9,
    graduationThesisCompleted: true,
    disqualificationGuidanceAcknowledged: true,
  };

  // 오류 케이스: 실습Ⅰ을 이수하지 않고 실습Ⅱ만 체크한 경우 -> 순서 오류(INVALID_2_WITHOUT_1)
  const invalidSeq = evaluateSchoolPracticum(
    {
      practicum1Completed: false,
      practicum1Semester: "",
      practicum2Completed: true,
      practicum2Semester: "2025-1",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
    },
    baseChecklist
  );
  assert.equal(invalidSeq.isCombinationValid, false);
  assert.equal(invalidSeq.hasSequenceError, true);
  assert.equal(invalidSeq.combinationCode, "INVALID_2_WITHOUT_1");

  // 조합 ①: Ⅰ + Ⅱ (2학점) + 필수 선이수 3과목 미충족 상태 -> 조합은 유효하나 실습 사전요건 미충족
  const combo12MissingPrereq = evaluateSchoolPracticum(
    {
      practicum1Completed: true,
      practicum1Semester: "2024-1",
      practicum2Completed: true,
      practicum2Semester: "2025-1",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
      thoughtAndExpressionCompleted: false,
      teachingMaterialsAndMethodsCompleted: true,
      educationTheoryCompleted: true,
    },
    baseChecklist
  );
  assert.equal(combo12MissingPrereq.isCombinationValid, true);
  assert.equal(combo12MissingPrereq.prerequisites.prerequisiteCoursesAllMet, false, "사고와 표현 미이수로 선이수 요건 미충족");
  assert.equal(combo12MissingPrereq.prerequisites.allPrerequisitesMet, false);

  // 조합 ①: Ⅰ + Ⅱ (2학점) + 선이수 3과목(사고와 표현, 교재연구및지도법, 교육학교육론) 모두 충족
  const combo12 = evaluateSchoolPracticum(
    {
      practicum1Completed: true,
      practicum1Semester: "2024-1",
      practicum2Completed: true,
      practicum2Semester: "2025-1",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
      thoughtAndExpressionCompleted: true,
      teachingMaterialsAndMethodsCompleted: true,
      educationTheoryCompleted: true,
    },
    baseChecklist
  );
  assert.equal(combo12.isCombinationValid, true);
  assert.equal(combo12.earnedPracticumCredits, 2);
  assert.equal(combo12.combinationCode, "COMBO_1_2");
  assert.equal(combo12.prerequisites.prerequisiteCoursesAllMet, true);
  assert.equal(combo12.prerequisites.allPrerequisitesMet, true);

  // 이수 강좌(enrolledCourses)를 통한 자동 감지 검증
  const comboWithCourses = evaluateSchoolPracticum(
    {
      practicum1Completed: true,
      practicum1Semester: "2024-1",
      practicum2Completed: true,
      practicum2Semester: "2025-1",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
    },
    baseChecklist,
    [
      { courseCode: "EDU2012", courseTitle: "사고와표현", credits: 3, category: "전공필수 (교육학과)", completedSemester: "2024-2" },
      { courseCode: "EDU4030", courseTitle: "교육학교재연구및지도법", credits: 3, category: "전공필수 (교육학과)", completedSemester: "2025-1" },
      { courseCode: "EDU4029", courseTitle: "교육학교육론", credits: 3, category: "전공필수 (교육학과)", completedSemester: "2025-2" },
    ]
  );
  assert.equal(comboWithCourses.prerequisites.thoughtAndExpressionCompleted, true);
  assert.equal(comboWithCourses.prerequisites.teachingMaterialsAndMethodsCompleted, true);
  assert.equal(comboWithCourses.prerequisites.educationTheoryCompleted, true);
  assert.equal(comboWithCourses.prerequisites.prerequisiteCoursesAllMet, true);
  assert.equal(comboWithCourses.prerequisites.allPrerequisitesMet, true);

  // 조합 ②: Ⅲ 단독 (2학점) -> 유효
  const combo3 = evaluateSchoolPracticum(
    {
      practicum1Completed: false,
      practicum1Semester: "",
      practicum2Completed: false,
      practicum2Semester: "",
      practicum3Completed: true,
      practicum3Semester: "2026-1",
      humanRightsEducationCompleted: true,
    },
    baseChecklist
  );
  assert.equal(combo3.isCombinationValid, true);
  assert.equal(combo3.earnedPracticumCredits, 2);
  assert.equal(combo3.combinationCode, "COMBO_3");

  // 조합 ③: Ⅰ + Ⅱ + Ⅲ (4학점) -> 유효
  const combo123 = evaluateSchoolPracticum(
    {
      practicum1Completed: true,
      practicum1Semester: "2024-1",
      practicum2Completed: true,
      practicum2Semester: "2025-1",
      practicum3Completed: true,
      practicum3Semester: "2026-1",
      humanRightsEducationCompleted: true,
    },
    baseChecklist
  );
  assert.equal(combo123.isCombinationValid, true);
  assert.equal(combo123.earnedPracticumCredits, 4);
  assert.equal(combo123.combinationCode, "COMBO_1_2_3");
});

test("9. [기존 회원 데이터 보존 및 자동 마이그레이션] 기존 StudentProgress 데이터(majorType, doubleMajorName, credits, volunteeringRecords)가 손실 없이 새 구조로 변환된다", () => {
  const legacyProgress = {
    userId: "u-legacy-student",
    admissionYear: "2021학년도 입학 (21학번)",
    majorType: "복수전공 이수",
    doubleMajorName: "국어교육과",
    isTeacherTrack: true,
    credits: {
      "졸업 이수 학점": { completedValue: 105, userCustomTarget: null, lastUpdated: "2026-10-01" },
      "전공 이수 학점": { completedValue: 51, userCustomTarget: null, lastUpdated: "2026-10-01" },
    },
    volunteeringRecords: [
      { id: "v1", institutionName: "동국중", activityDate: "2025-05", hours: 30, verifiedBySelf: true, note: "" },
    ],
    checklist: [],
  };

  const migrated = migrateStudentProgress(legacyProgress);
  assert.equal(migrated.academicProfile.admissionYearNumber, 2021);
  // '국어교육과' 키워드를 인식해 사범대 복수전공(double_edu) 및 교직 복수전공(double_teaching)으로 자동 매핑
  assert.equal(migrated.academicProfile.majorPlanType, "double_edu");
  assert.equal(migrated.academicProfile.doubleMajorDepartment, "국어교육과");
  assert.equal(migrated.academicProfile.teachingTrackStatus, "double_teaching");
  // 기존 누적 학점 및 봉사 기록 100% 보존
  assert.equal(migrated.credits["졸업 이수 학점"].completedValue, 105);
  assert.equal(migrated.volunteeringRecords.length, 1);
  assert.equal(migrated.volunteeringState.eduVolunteering1Completed, true);
});

test("10, 11, 12. [Firestore 보안 규칙 검증] 타 학생 학사정보 접근 차단, 일반 학생의 공통 졸업요건 수정 차단, 미승인 사용자 접근 차단이 강제된다", () => {
  const rulesText = fs.readFileSync(
    new URL("../firestore.rules", import.meta.url),
    "utf8"
  );

  // 1) 공통 졸업요건 카탈로그(graduationRulesCatalog) 규칙 존재 및 관리자 전용 쓰기, 교수/졸업생 차단 검증
  assert.ok(
    rulesText.includes("match /graduationRulesCatalog/{docId}"),
    "graduationRulesCatalog 보안 규칙이 존재해야 합니다"
  );
  assert.ok(
    rulesText.includes("allow write: if isApprovedAdmin();") &&
      rulesText.includes("role == 'student'"),
    "공통 졸업요건은 승인된 재학생과 관리자만 읽을 수 있고 관리자만 수정할 수 있어야 합니다"
  );

  // 2) 개인별 졸업요건 기록(graduationRecords/{userId}) 본인(재학생) 또는 관리자만 접근 가능 & 공식 인정 위변조 방지 & 교수/졸업생 차단 검증
  assert.ok(
    rulesText.includes("match /graduationRecords/{userId}"),
    "graduationRecords 보안 규칙이 존재해야 합니다"
  );
  assert.ok(
    rulesText.includes("request.auth.uid == userId") &&
      rulesText.includes("role == 'student'") &&
      rulesText.includes("officialAdminVerified"),
    "타 학생 및 교수·졸업생의 접근을 차단하고 학생이 officialAdminVerified를 임의로 true로 바꾸지 못해야 합니다"
  );

  // 3) 보안 규칙 시뮬레이션 검증 (미승인 사용자 / 일반 학생 / 타 학생 / 관리자 / 교수 / 졸업생)
  const simulateAccess = ({
    isApproved,
    isAdmin,
    role = "student",
    authUid,
    collection,
    docId,
    action,
    payloadOfficialVerified,
  }) => {
    if (!isApproved) return false; // 12. 미승인 사용자 전면 차단
    if (collection === "graduationRulesCatalog") {
      if (action === "read") {
        return Boolean(isAdmin) || role === "student"; // 교수·졸업생 차단
      }
      return Boolean(isAdmin); // 11. 일반 학생의 공통 졸업요건 수정 차단
    }
    if (collection === "graduationRecords") {
      if (action === "read") {
        if (isAdmin) return true;
        if (role !== "student") return false; // 교수·졸업생 차단
        return authUid === docId; // 10. 다른 학생의 학사정보 조회 차단
      }
      if (action === "write") {
        if (isAdmin) return true;
        if (role !== "student") return false; // 교수·졸업생 차단
        if (authUid !== docId) return false; // 10. 다른 학생의 학사정보 수정 차단
        if (payloadOfficialVerified === true) return false; // 학생의 공식 인정 상태 사칭 차단
        return true;
      }
    }
    return false;
  };

  // 미승인 사용자 차단 확인
  assert.equal(
    simulateAccess({
      isApproved: false,
      isAdmin: false,
      authUid: "studentA",
      collection: "graduationRulesCatalog",
      docId: "current",
      action: "read",
    }),
    false
  );
  assert.equal(
    simulateAccess({
      isApproved: false,
      isAdmin: false,
      authUid: "studentA",
      collection: "graduationRecords",
      docId: "studentA",
      action: "read",
    }),
    false
  );

  // 일반 학생이 공통 졸업요건 카탈로그 수정 시도 -> 차단(false)
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      authUid: "studentA",
      collection: "graduationRulesCatalog",
      docId: "current",
      action: "write",
    }),
    false
  );

  // 학생 A가 학생 B의 졸업요건 기록 조회/수정 시도 -> 차단(false)
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      authUid: "studentA",
      collection: "graduationRecords",
      docId: "studentB",
      action: "read",
    }),
    false
  );
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      authUid: "studentA",
      collection: "graduationRecords",
      docId: "studentB",
      action: "write",
    }),
    false
  );

  // 학생 A가 본인 기록을 저장하되 officialAdminVerified: true 사칭 시도 -> 차단(false)
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      authUid: "studentA",
      collection: "graduationRecords",
      docId: "studentA",
      action: "write",
      payloadOfficialVerified: true,
    }),
    false
  );

  // 학생 A가 본인 자가점검 기록 정상 저장 -> 허용(true)
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      role: "student",
      authUid: "studentA",
      collection: "graduationRecords",
      docId: "studentA",
      action: "write",
      payloadOfficialVerified: false,
    }),
    true
  );

  // 교수진(professor) 및 졸업생(alumni) 접근 시도 -> 전면 차단(false) 검증
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      role: "professor",
      authUid: "prof1",
      collection: "graduationRulesCatalog",
      docId: "current",
      action: "read",
    }),
    false,
    "교수는 공통 졸업요건 카탈로그 조회 불가"
  );
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      role: "professor",
      authUid: "prof1",
      collection: "graduationRecords",
      docId: "prof1",
      action: "read",
    }),
    false,
    "교수는 개인별 졸업요건 기록 조회 불가"
  );
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      role: "alumni",
      authUid: "alumni1",
      collection: "graduationRulesCatalog",
      docId: "current",
      action: "read",
    }),
    false,
    "졸업생은 공통 졸업요건 카탈로그 조회 불가"
  );
  assert.equal(
    simulateAccess({
      isApproved: true,
      isAdmin: false,
      role: "alumni",
      authUid: "alumni1",
      collection: "graduationRecords",
      docId: "alumni1",
      action: "read",
    }),
    false,
    "졸업생은 개인별 졸업요건 기록 조회 불가"
  );

  // 공식 출처 URL 확인
  assert.equal(OFFICIAL_GUIDE_URL, "https://edu.dongguk.edu/page/619");
});

test("13. [교육학과 개편 요건 검증] 전공필수 36학점, 교직 10학점(소양 6 + 실습 4[교생2+봉사2]), 졸업시험 합격 기준이 정확히 반영된다", () => {
  const cohortRule = OFFICIAL_GRADUATION_CATALOG.cohorts["2023"];
  assert.equal(cohortRule.majorRequiredCredits, 36, "전공필수 36학점 기준 확인");
  assert.equal(cohortRule.teachingTotalCredits, 10, "교직 총 10학점 기준 확인");
  assert.equal(cohortRule.teachingLiteracyCredits, 6, "교직소양 6학점 확인");
  assert.equal(cohortRule.teachingPracticumMinCredits, 4, "교육실습 4학점 확인");
  assert.equal(cohortRule.volunteeringCredits, 2, "교육봉사 2학점 확인");
  assert.equal(cohortRule.volunteeringHours, 60, "교육봉사 60시간 확인");
  assert.equal(cohortRule.schoolPracticumMinCredits, 2, "학교현장실습(교생실습) 2학점 확인");
  assert.equal(cohortRule.graduationExamRequired, true, "교육학과 졸업시험 필수 확인");

  const progress = migrateStudentProgress({
    userId: "u-test-exam",
    academicProfile: {
      admissionYearNumber: 2023,
      admissionYearLabel: "2023학년도 신입학 (23학번)",
      majorPlanType: "single",
      hasDoubleMajor: false,
      doubleMajorDepartment: "",
      teachingTrackStatus: "educational_major",
      isEnglishTrack: false,
      updatedAt: "2026-10-28",
    },
    teachingChecklist: {
      personalityTestPassCount: 2,
      cprCompletedCount: 2,
      genderSensitivityCount: 4,
      majorGpa: 3.8,
      teachingGpa: 4.0,
      graduationExamCompleted: true,
      disqualificationGuidanceAcknowledged: true,
    },
    courses: [],
    credits: {},
    volunteeringRecords: [],
    checklist: [],
  });

  const audit = calculateGraduationAudit(progress, OFFICIAL_GRADUATION_CATALOG);
  assert.equal(audit.teachingChecklistAudit.examCompleted, true, "졸업시험 합격 확인");
});

test("14. [학생별 데이터 완전 분리 및 신규 회원 초기화] 학생 A의 기록이나 데모 데이터가 학생 B 또는 신규 회원에게 절대 섞이지 않는다", () => {
  // 1) UID별 로컬 캐시 키 분리 확인
  const keyA = getStudentGraduationCacheKey("uid-student-a");
  const keyB = getStudentGraduationCacheKey("uid-student-b");
  assert.notEqual(keyA, keyB);
  assert.equal(keyA, "dongguk_e_eum_grad_record_v2_uid-student-a");
  assert.equal(keyB, "dongguk_e_eum_grad_record_v2_uid-student-b");

  // 2) 신규 학생 B 초기 상태: 데모 강좌·봉사·체크리스트 없이 깨끗한 빈 배열로 시작
  const emptyB = createEmptyStudentProgress("uid-student-b", {
    id: "uid-student-b",
    name: "박신입",
    studentIdOrYear: "2025학년도 신입학 (25학번)",
    doubleMajor: "단일전공(교육학)",
  });
  assert.equal(emptyB.userId, "uid-student-b");
  assert.equal(emptyB.academicProfile.admissionYearNumber, 2025);
  assert.equal(emptyB.courses.length, 0, "신규 회원은 데모 강좌가 없어야 함");
  assert.equal(emptyB.volunteeringRecords.length, 0, "신규 회원은 데모 봉사 기록이 없어야 함");
  assert.equal(emptyB.checklist.length, 0, "신규 회원은 데모 체크리스트가 없어야 함");
  assert.equal(emptyB.teachingChecklist.graduationExamCompleted, false);

  const auditB = calculateGraduationAudit(emptyB, OFFICIAL_GRADUATION_CATALOG);
  assert.equal(auditB.totalEarnedCredits, 0);
  assert.equal(auditB.eduMajorEarnedCredits, 0);
  assert.equal(auditB.volunteeringAudit.effectiveHours, 0);
});

test("15. [자동 저장 시나리오 1~9 & 12 검증] 학사정보·강좌·교육봉사·교직체크리스트·졸업시험 수정 후 저장·복원 및 빠른 연속 수정 시 최신 버전(clientRevision)이 보존된다", () => {
  // 학생 A 초기 생성
  let studentA = createEmptyStudentProgress("uid-student-a", {
    id: "uid-student-a",
    name: "김교육",
    studentIdOrYear: "2023학년도 신입학 (23학번)",
  });

  // 시나리오 1: 학사정보 수정 (2023학번, 복수전공 심리학과, 주전공 교직 이수)
  studentA = migrateStudentProgress({
    ...studentA,
    academicProfile: {
      admissionYearNumber: 2023,
      admissionYearLabel: "2023학년도 신입학 (23학번)",
      majorPlanType: "double_general",
      hasDoubleMajor: true,
      doubleMajorDepartment: "심리학과",
      teachingTrackStatus: "educational_major",
      isEnglishTrack: false,
      specialConditionMemo: "2025-1 진입",
      updatedAt: "2026-11-02",
    },
    isProfileComplete: true,
    clientRevision: 1,
  });
  assert.equal(studentA.academicProfile.doubleMajorDepartment, "심리학과");
  assert.equal(studentA.clientRevision, 1);

  // 시나리오 2: 강좌 추가·수정·삭제
  studentA = migrateStudentProgress({
    ...studentA,
    courses: [
      {
        id: "c-1",
        courseCode: "EDU2013",
        courseTitle: "교육학개론",
        credits: 3,
        yearTaken: 2023,
        semesterTaken: "1학기",
        category: "전공필수/선택 (교육학과)",
        isCompleted: true,
        createdAt: "2026-11-02",
      },
      {
        id: "c-2",
        courseCode: "PRI5001",
        courseTitle: "영어강독",
        credits: 3,
        yearTaken: 2023,
        semesterTaken: "1학기",
        category: "학문기초(외국어영역)",
        isCompleted: true,
        createdAt: "2026-11-02",
      },
    ],
    clientRevision: 2,
  });
  // 강좌 수정 (영어강독 3학점 -> 6학점) 및 강좌 삭제 시뮬레이션
  studentA = migrateStudentProgress({
    ...studentA,
    courses: studentA.courses.map((c) => (c.id === "c-2" ? { ...c, credits: 6 } : c)),
    clientRevision: 3,
  });
  assert.equal(studentA.courses.find((c) => c.id === "c-2").credits, 6);

  // 시나리오 3: 교육봉사 시간 및 과목 상태 변경
  studentA = migrateStudentProgress({
    ...studentA,
    volunteeringState: {
      eduVolunteering1Completed: true,
      eduVolunteering1Semester: "2024-1학기",
      eduVolunteering2Completed: true,
      eduVolunteering2Semester: "2024-2학기",
      confirmationSubmitted: true,
    },
    volunteeringRecords: [
      {
        id: "v-a1",
        institutionName: "장충중학교",
        activityDate: "2024-03 ~ 2024-12",
        hours: 60,
        verifiedBySelf: true,
        note: "교육봉사 60시간 완료",
      },
    ],
    clientRevision: 4,
  });

  // 시나리오 4 & 5: 교직 체크리스트 및 졸업시험 합격 상태 변경
  studentA = migrateStudentProgress({
    ...studentA,
    teachingChecklist: {
      personalityTestPassCount: 2,
      cprCompletedCount: 2,
      cprExternalCount: 0,
      genderSensitivityCount: 4,
      majorGpa: 3.95,
      teachingGpa: 4.15,
      graduationThesisCompleted: true,
      graduationExamCompleted: true,
      disqualificationGuidanceAcknowledged: true,
      officialVerificationConfirmedByAdmin: false,
    },
    checklist: [
      {
        id: "chk-a1",
        label: "졸업시험 합격 확인",
        category: "기타 졸업요건",
        completed: true,
        memo: "2026-2학기 통과",
      },
    ],
    clientRevision: 5,
  });

  // 시나리오 6, 7, 8: Firestore 직렬화 저장 후 새로고침 / 재로그인 / 다른 브라우저에서 다시 불러오기 시뮬레이션
  const serializedInFirestore = JSON.parse(JSON.stringify(studentA));
  const reloadedStudentA = migrateStudentProgress(serializedInFirestore, {
    id: "uid-student-a",
  });

  assert.equal(reloadedStudentA.userId, "uid-student-a");
  assert.equal(reloadedStudentA.academicProfile.doubleMajorDepartment, "심리학과");
  assert.equal(reloadedStudentA.courses.length, 2);
  assert.equal(reloadedStudentA.volunteeringRecords[0].hours, 60);
  assert.equal(reloadedStudentA.teachingChecklist.graduationExamCompleted, true);
  assert.equal(reloadedStudentA.teachingChecklist.majorGpa, 3.95);
  assert.equal(reloadedStudentA.checklist.length, 1);
  assert.equal(reloadedStudentA.clientRevision, 5);

  // 시나리오 9: 다른 학생 B가 스냅샷을 받을 때 학생 A의 스냅샷은 거부되어야 함
  assert.equal(
    shouldApplyCloudGraduationSnapshot({
      cloudRecord: reloadedStudentA,
      currentUid: "uid-student-b",
      localProgress: createEmptyStudentProgress("uid-student-b"),
      hasPendingWrites: false,
    }),
    false,
    "타 학생(uid-student-a)의 스냅샷은 uid-student-b 화면에 절대 반영되면 안 됨"
  );

  // 시나리오 12: 빠른 연속 수정 중(hasPendingWrites=true, localRevision=5) 이전 저장 요청의 응답(clientRevision=3)이 뒤늦게 도착하면 무시되어야 함
  assert.equal(
    shouldApplyCloudGraduationSnapshot({
      cloudRecord: { ...reloadedStudentA, clientRevision: 3 },
      currentUid: "uid-student-a",
      localProgress: reloadedStudentA, // clientRevision: 5
      hasPendingWrites: true,
    }),
    false,
    "이전(stale) 저장 응답(rev 3)이 최신 로컬 상태(rev 5)를 덮어쓰면 안 됨"
  );

  // 최신 저장 응답(clientRevision=5)이 도착하면 정상 반영 허용
  assert.equal(
    shouldApplyCloudGraduationSnapshot({
      cloudRecord: { ...reloadedStudentA, clientRevision: 5 },
      currentUid: "uid-student-a",
      localProgress: reloadedStudentA,
      hasPendingWrites: true,
    }),
    true
  );
});

test("16. [보안 규칙 추가 검증] 사용자가 문서 내부 userId를 타인의 UID로 위조해 저장하는 행위가 차단된다", () => {
  const rulesText = fs.readFileSync(
    new URL("../firestore.rules", import.meta.url),
    "utf8"
  );
  assert.ok(
    rulesText.includes("request.resource.data.userId == request.auth.uid"),
    "graduationRecords 저장 시 문서 내부 userId 필드도 request.auth.uid와 일치해야 합니다"
  );
});

test("17. [전공필수 12과목·전공선택 18과목 프리셋 및 교직이론 선택 제거 검증] 공식 교육과정표의 전공필수(36학점)와 전공선택 항목이 반영되고 교직이론은 선택지에서 제거된다", () => {
  const requiredPresets = OFFICIAL_COURSE_PRESETS.filter(
    (p) => p.category === "전공필수 (교육학과)"
  );
  const electivePresets = OFFICIAL_COURSE_PRESETS.filter(
    (p) => p.category === "전공선택 (교육학과)"
  );
  const theoryPresets = OFFICIAL_COURSE_PRESETS.filter(
    (p) => p.category === "교직이론"
  );

  assert.equal(EDU_MAJOR_REQUIRED_CODES.size, 12, "전공필수 12과목 코드 확인");
  assert.equal(requiredPresets.length, 12, "전공필수 프리셋 12과목(36학점) 확인");
  assert.equal(
    requiredPresets.reduce((sum, p) => sum + p.credits, 0),
    36,
    "전공필수 총 36학점 확인"
  );
  assert.equal(electivePresets.length, 18, "전공선택 프리셋 18과목 확인");
  assert.equal(theoryPresets.length, 0, "교직이론 프리셋은 선택 항목에서 완전히 제거됨");
});

test("18. [학문기초 이수 학점 수동 보정 및 공통교양·학문기초 카드 연동] 학문기초 이수 학점 입력 시 공통교양 및 학문기초 카드와 미충족 검증에 실시간 반영된다", () => {
  const student = createEmptyStudentProgress("student-foundation-test", {
    id: "student-foundation-test",
    name: "박학문",
    studentIdOrYear: "2023학년도 신입학 (23학번)",
  });

  // 1) 학문기초 입력 전: 교양 29학점만 있는 경우 (2023학번 기준 공통교양 29학점 + 학문기초 6학점 = 총 35학점)
  student.credits["교양 이수 학점"] = {
    completedValue: 29,
    userCustomTarget: null,
    lastUpdated: new Date().toISOString(),
  };

  const auditBefore = calculateGraduationAudit(student, OFFICIAL_GRADUATION_CATALOG);
  const liberalCardBefore = auditBefore.categoryCards.find((c) => c.id === "card-liberal");
  assert.ok(liberalCardBefore);
  // 공통교양 29학점은 충족되었으나 학문기초(6학점)는 0학점이므로 아직 in_progress
  assert.equal(liberalCardBefore.earnedValue, 29);
  assert.equal(liberalCardBefore.status, "in_progress");

  // 2) 학문기초 6학점 직접 보정 입력
  student.credits["학문기초 이수 학점"] = {
    completedValue: 6,
    userCustomTarget: null,
    lastUpdated: new Date().toISOString(),
  };

  const auditAfter = calculateGraduationAudit(student, OFFICIAL_GRADUATION_CATALOG);
  const liberalCardAfter = auditAfter.categoryCards.find((c) => c.id === "card-liberal");
  assert.ok(liberalCardAfter);
  // 29(공통교양) + 6(학문기초) = 35학점으로 합산 반영되어 fulfilled 달성
  assert.equal(liberalCardAfter.earnedValue, 35);
  assert.equal(liberalCardAfter.status, "fulfilled");
  assert.match(liberalCardAfter.helperText, /학문기초 6\/6학점/);
});

test("19. [교직이론 미충족 항목 제외 및 7-2 현재 충족 졸업·교직 요건 생성 검증] 교직이론 부족 조건은 미충족에서 제외되고 충족된 항목은 fulfilledItems에 정확히 집계된다", () => {
  const student = createEmptyStudentProgress("student-fulfilled-test", {
    id: "student-fulfilled-test",
    name: "김충족",
    studentIdOrYear: "2023학년도 신입학 (23학번)",
  });

  // 1) 초기 상태: 교직이론 미충족 항목이 unmetItems에 없어야 함
  const initialAudit = calculateGraduationAudit(student, OFFICIAL_GRADUATION_CATALOG);
  const theoryUnmet = initialAudit.unmetItems.find((u) => u.id === "unmet-teaching-theory");
  assert.equal(theoryUnmet, undefined, "교직이론 부족 조건은 교육학과 특성에 맞춰 미충족 항목에서 제외되어야 함");

  // 2) 교양 학점(35) 충족 + 봉사 60시간 충족 + 졸업시험 합격 설정
  student.credits["교양 이수 학점"] = {
    completedValue: 35,
    userCustomTarget: null,
    lastUpdated: new Date().toISOString(),
  };
  student.volunteeringState = {
    eduVolunteering1Completed: true,
    eduVolunteering2Completed: true,
    confirmationSubmitted: true,
  };
  student.teachingChecklist.graduationExamCompleted = true;

  const audit = calculateGraduationAudit(student, OFFICIAL_GRADUATION_CATALOG);
  
  // fulfilledItems 확인
  const fulfilledIds = audit.fulfilledItems.map((f) => f.id);
  assert.ok(fulfilledIds.includes("fulfilled-common-liberal"), "공통교양 및 학문기초 학점 충족 포함");
  assert.ok(fulfilledIds.includes("fulfilled-volunteering"), "교육봉사활동 요건 충족 포함");
  assert.ok(fulfilledIds.includes("fulfilled-thesis"), "교육학과 졸업시험 합격 완료 포함");

  // unmetItems에서 해당 항목들은 빠져 있어야 함
  const unmetIds = audit.unmetItems.map((u) => u.id);
  assert.ok(!unmetIds.includes("unmet-common-liberal"), "충족된 공통교양은 미충족 목록에 없어야 함");
  assert.ok(!unmetIds.includes("unmet-volunteering"), "충족된 봉사활동은 미충족 목록에 없어야 함");
  assert.ok(!unmetIds.includes("unmet-thesis"), "합격한 졸업시험은 미충족 목록에 없어야 함");
});

test("20. [직접 입력 영역별 학점 합산 및 총 졸업 이수 학점 반영] 전공, 교양, 학문기초, 복수전공, 교직, 일반교양 및 자선 입력값들의 합계가 총 졸업 이수 학점에 반영된다", () => {
  const student = createEmptyStudentProgress("student-manual-sum-test", {
    id: "student-manual-sum-test",
    name: "최합산",
    studentIdOrYear: "2023학년도 신입학 (23학번)",
  });

  // 직접 입력한 영역별 학점들
  student.credits["전공 이수 학점"] = { completedValue: 57, userCustomTarget: null, lastUpdated: "2026-11-02" };
  student.credits["교양 이수 학점"] = { completedValue: 29, userCustomTarget: null, lastUpdated: "2026-11-02" };
  student.credits["학문기초 이수 학점"] = { completedValue: 6, userCustomTarget: null, lastUpdated: "2026-11-02" };
  student.credits["복수전공 이수 학점"] = { completedValue: 0, userCustomTarget: null, lastUpdated: "2026-11-02" };
  student.credits["교직 이수 학점"] = { completedValue: 8, userCustomTarget: null, lastUpdated: "2026-11-02" };
  student.credits["일반교양 및 자선 이수 학점"] = { completedValue: 12, userCustomTarget: null, lastUpdated: "2026-11-02" };

  const audit = calculateGraduationAudit(student, OFFICIAL_GRADUATION_CATALOG);
  const totalCard = audit.categoryCards.find((c) => c.id === "card-total");

  assert.ok(totalCard);
  // 합계: 57 + 29 + 6 + 0 + 8 + 12 = 112학점
  assert.equal(audit.totalEarnedCredits, 112, "총 취득 학점 112학점 계산 확인");
  assert.equal(totalCard.earnedValue, 112, "총 졸업 이수 학점 카드에 합산값 112학점 반영 확인");
  assert.equal(audit.generalElectiveEarnedCredits, 12, "일반교양 및 자선 취득 학점 12학점 반영 확인");
});

test("21. [학교현장실습 선이수 3과목 요건 검증] 사고와 표현, 교육학교재연구및지도법, 교육학교육론 3과목을 모두 이수해야만 학교현장실습 사전요건이 충족된다", () => {
  const baseChecklist = {
    personalityTestPassCount: 1,
    cprCompletedCount: 1,
    genderSensitivityCount: 1,
  };

  // 1) 3과목 중 일부만 이수한 경우 (예: 사고와 표현만 이수) -> 미충족
  const partialResult = evaluateSchoolPracticum(
    {
      practicum1Completed: false,
      practicum1Semester: "",
      practicum2Completed: false,
      practicum2Semester: "",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
      thoughtAndExpressionCompleted: true,
      teachingMaterialsAndMethodsCompleted: false,
      educationTheoryCompleted: false,
    },
    baseChecklist
  );
  assert.equal(partialResult.prerequisites.thoughtAndExpressionCompleted, true);
  assert.equal(partialResult.prerequisites.teachingMaterialsAndMethodsCompleted, false);
  assert.equal(partialResult.prerequisites.educationTheoryCompleted, false);
  assert.equal(partialResult.prerequisites.prerequisiteCoursesAllMet, false);
  assert.equal(partialResult.prerequisites.allPrerequisitesMet, false);

  // 2) 3과목 모두 직접 체크한 경우 -> 충족
  const fullCheckedResult = evaluateSchoolPracticum(
    {
      practicum1Completed: false,
      practicum1Semester: "",
      practicum2Completed: false,
      practicum2Semester: "",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
      thoughtAndExpressionCompleted: true,
      teachingMaterialsAndMethodsCompleted: true,
      educationTheoryCompleted: true,
    },
    baseChecklist
  );
  assert.equal(fullCheckedResult.prerequisites.prerequisiteCoursesAllMet, true);
  assert.equal(fullCheckedResult.prerequisites.allPrerequisitesMet, true);

  // 3) 수강 강좌(enrolledCourses)로 3과목이 등록된 경우 -> 자동 감지 및 충족
  const coursesResult = evaluateSchoolPracticum(
    {
      practicum1Completed: false,
      practicum1Semester: "",
      practicum2Completed: false,
      practicum2Semester: "",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
    },
    baseChecklist,
    [
      { courseCode: "EDU2012", courseTitle: "사고와표현", credits: 3, category: "전공필수 (교육학과)", completedSemester: "2024-2" },
      { courseCode: "EDU4030", courseTitle: "교육학교재연구및지도법", credits: 3, category: "전공필수 (교육학과)", completedSemester: "2025-1" },
      { courseCode: "EDU4029", courseTitle: "교육학교육론", credits: 3, category: "전공필수 (교육학과)", completedSemester: "2025-2" },
    ]
  );
  assert.equal(coursesResult.prerequisites.thoughtAndExpressionCompleted, true);
  assert.equal(coursesResult.prerequisites.teachingMaterialsAndMethodsCompleted, true);
  assert.equal(coursesResult.prerequisites.educationTheoryCompleted, true);
  assert.equal(coursesResult.prerequisites.prerequisiteCoursesAllMet, true);
  assert.equal(coursesResult.prerequisites.allPrerequisitesMet, true);
});

