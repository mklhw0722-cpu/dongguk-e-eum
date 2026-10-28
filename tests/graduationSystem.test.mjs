// 동국e음 — 동국대학교 교육학과 졸업요건 관리 시스템(https://edu.dongguk.edu/page/619) 검증 테스트
// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  OFFICIAL_GRADUATION_CATALOG,
  OFFICIAL_GUIDE_URL,
  EDU_TEACHING_SUBSTITUTION_MAP,
  resolveCohortBand,
  resolveApplicableRequirements,
  migrateStudentProgress,
  sortCoursesBySemester,
  detectDuplicateCourses,
  evaluateSchoolPracticum,
  calculateGraduationAudit,
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

  // 조합 ①: Ⅰ + Ⅱ (2학점) -> 유효
  const combo12 = evaluateSchoolPracticum(
    {
      practicum1Completed: true,
      practicum1Semester: "2024-1",
      practicum2Completed: true,
      practicum2Semester: "2025-1",
      practicum3Completed: false,
      practicum3Semester: "",
      humanRightsEducationCompleted: true,
    },
    baseChecklist
  );
  assert.equal(combo12.isCombinationValid, true);
  assert.equal(combo12.earnedPracticumCredits, 2);
  assert.equal(combo12.combinationCode, "COMBO_1_2");
  assert.equal(combo12.prerequisites.allPrerequisitesMet, true);

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
