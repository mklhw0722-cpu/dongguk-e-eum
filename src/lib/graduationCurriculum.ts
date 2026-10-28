import type {
  CohortBandId,
  CourseCategory,
  CourseSemester,
  EnrolledCourse,
  GraduationRequirement,
  MajorPlanType,
  OfficialCohortRuleSet,
  OfficialGraduationCatalog,
  RequirementCategory,
  RuleReviewStatus,
  SchoolPracticumState,
  StudentAcademicProfile,
  StudentProgress,
  TeachingChecklistState,
  TeachingTrackStatus,
  User,
  VolunteeringCourseState,
} from "../types/index.ts";

export const OFFICIAL_GUIDE_URL = "https://edu.dongguk.edu/page/619";
export const OFFICIAL_GUIDE_VERIFIED_DATE = "2026-10-28";
export const OFFICIAL_CATALOG_VERSION = "2026.10-edu-page619-v1";

export interface TeachingTheorySubstitutionItem {
  eduCourseCode: string;
  eduCourseTitle: string;
  eduCredits: number;
  substitutedTheoryKey: string;
  substitutedTheoryTitle: string;
  ercCourseCodes: string[];
  ercCredits: number;
}

/**
 * 동국대학교 교육학과 공식 교직이론 대체인정과목 매핑표
 * 출처: https://edu.dongguk.edu/page/619 (3-가. 교직이론 - 교육학과 대체인정과목)
 *
 * ※ 교육학과의 경우 전공과목(3학점)으로 교직이론과목(2학점)을 대체이수하며,
 *    2015학년도 입학생부터 대체이수한 교직학점(12학점)만큼 전공학점을 추가 이수하여야 함
 *    (단일전공 54+12=66학점, 복수전공 주전공 50+12=62학점).
 * ※ 중요: 동일 과목(3학점)은 총 졸업학점(130학점)에 3학점으로 1회만 합산하며(이중 계산 금지),
 *    교육학과 전공학점과 교직이론 이수 요건(6과목 / 12학점 상당) 충족 여부를 각각 동시에 인정함.
 */
export const EDU_TEACHING_SUBSTITUTION_MAP: TeachingTheorySubstitutionItem[] = [
  {
    eduCourseCode: "EDU2013",
    eduCourseTitle: "교육학개론",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_INTRO",
    substitutedTheoryTitle: "교육학개론",
    ercCourseCodes: ["ERC0001"],
    ercCredits: 2,
  },
  {
    eduCourseCode: "EDU2015",
    eduCourseTitle: "교육심리",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_PSYCH",
    substitutedTheoryTitle: "교육심리",
    ercCourseCodes: ["ERC0002"],
    ercCredits: 2,
  },
  {
    eduCourseCode: "EDU2002",
    eduCourseTitle: "교육철학",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_PHIL",
    substitutedTheoryTitle: "교육철학 및 교육사",
    ercCourseCodes: ["ERC0003"],
    ercCredits: 2,
  },
  {
    eduCourseCode: "EDU2010",
    eduCourseTitle: "교육사회학",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_SOC",
    substitutedTheoryTitle: "교육사회",
    ercCourseCodes: ["ERC0005", "ERC0011"],
    ercCredits: 2,
  },
  {
    eduCourseCode: "EDU4003",
    eduCourseTitle: "교육공학",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_TECH",
    substitutedTheoryTitle: "교육방법 및 교육공학",
    ercCourseCodes: ["ERC0006", "ERC0012"],
    ercCredits: 2,
  },
  {
    eduCourseCode: "EDU2016",
    eduCourseTitle: "교육행정",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_ADMIN",
    substitutedTheoryTitle: "교육행정 및 교육경영",
    ercCourseCodes: ["ERC0007", "ERC0005"],
    ercCredits: 2,
  },
  {
    eduCourseCode: "EDU2014",
    eduCourseTitle: "교육과정",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_CURR",
    substitutedTheoryTitle: "교육과정",
    ercCourseCodes: ["ERC0011", "ERC0007"],
    ercCredits: 2,
  },
  {
    eduCourseCode: "EDU4035",
    eduCourseTitle: "교육평가",
    eduCredits: 3,
    substitutedTheoryKey: "THEORY_EVAL",
    substitutedTheoryTitle: "교육평가",
    ercCourseCodes: ["ERC0012", "ERC0018"],
    ercCredits: 2,
  },
];

export interface OfficialCoursePreset {
  courseCode: string;
  courseTitle: string;
  credits: number;
  category: CourseCategory;
  substitutedTeachingSubjectCode?: string;
  isSubjectEducationCourse?: boolean;
  description: string;
}

/**
 * 공식 학업이수 가이드(https://edu.dongguk.edu/page/619)에서 확인된 대표 강좌 프리셋
 */
export const OFFICIAL_COURSE_PRESETS: OfficialCoursePreset[] = [
  // 교육학과 전공 (교직이론 대체인정 8과목)
  {
    courseCode: "EDU2013",
    courseTitle: "교육학개론",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0001",
    description: "교육학과 전공 (교직이론 '교육학개론' 대체인정)",
  },
  {
    courseCode: "EDU2015",
    courseTitle: "교육심리",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0002",
    description: "교육학과 전공 (교직이론 '교육심리' 대체인정)",
  },
  {
    courseCode: "EDU2002",
    courseTitle: "교육철학",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0003",
    description: "교육학과 전공 (교직이론 '교육철학 및 교육사' 대체인정)",
  },
  {
    courseCode: "EDU2010",
    courseTitle: "교육사회학",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0005",
    description: "교육학과 전공 (교직이론 '교육사회' 대체인정)",
  },
  {
    courseCode: "EDU4003",
    courseTitle: "교육공학",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0006",
    description: "교육학과 전공 (교직이론 '교육방법 및 교육공학' 대체인정)",
  },
  {
    courseCode: "EDU2016",
    courseTitle: "교육행정",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0007",
    description: "교육학과 전공 (교직이론 '교육행정 및 교육경영' 대체인정)",
  },
  {
    courseCode: "EDU2014",
    courseTitle: "교육과정",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0011",
    description: "교육학과 전공 (교직이론 '교육과정' 대체인정)",
  },
  {
    courseCode: "EDU4035",
    courseTitle: "교육평가",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    substitutedTeachingSubjectCode: "ERC0012",
    description: "교육학과 전공 (교직이론 '교육평가' 대체인정)",
  },
  // 교과교육영역 (전공 9학점 필수 영역)
  {
    courseCode: "EDU_SUBJ1",
    courseTitle: "교육학교과교육론",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    isSubjectEducationCourse: true,
    description: "교과교육영역 (2009학년도 이후 입학자 전공 필수영역 3과목 중 1)",
  },
  {
    courseCode: "EDU_SUBJ2",
    courseTitle: "교육학교재연구및지도법",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    isSubjectEducationCourse: true,
    description: "교과교육영역 (2009학년도 이후 입학자 전공 필수영역 3과목 중 1)",
  },
  {
    courseCode: "EDU_SUBJ3",
    courseTitle: "교육학논리및논술",
    credits: 3,
    category: "전공필수/선택 (교육학과)",
    isSubjectEducationCourse: true,
    description: "교과교육영역 (2009학년도 이후 입학자 전공 필수영역 3과목 중 1)",
  },
  // 교직소양 (직필, 4과목 6학점)
  {
    courseCode: "ERC0013",
    courseTitle: "교직실무",
    credits: 1,
    category: "교직소양",
    description: "교직소양 필수 (1학점)",
  },
  {
    courseCode: "ERC3012",
    courseTitle: "디지털교육",
    credits: 1,
    category: "교직소양",
    description: "교직소양 필수 (1학점)",
  },
  {
    courseCode: "ERC0019",
    courseTitle: "특수교육학개론",
    credits: 2,
    category: "교직소양",
    description: "교직소양 필수 (2학점)",
  },
  {
    courseCode: "ERC0020",
    courseTitle: "학교폭력예방및학생의이해",
    credits: 2,
    category: "교직소양",
    description: "교직소양 필수 (2학점)",
  },
  // 교직이론 (직선 2학점 과목 - 직접 수강 시)
  {
    courseCode: "ERC0018",
    courseTitle: "생활지도및상담",
    credits: 2,
    category: "교직이론",
    description: "교직이론 선택 (2학점, 교육학과 전공 대체과목 없음)",
  },
  {
    courseCode: "ERC3009",
    courseTitle: "에듀테크와미래교육",
    credits: 2,
    category: "교직이론",
    description: "교직이론 선택 (2학점)",
  },
  {
    courseCode: "ERC3010",
    courseTitle: "메이커교육의이론과실천",
    credits: 2,
    category: "교직이론",
    description: "교직이론 선택 (2학점)",
  },
  {
    courseCode: "ERC3011",
    courseTitle: "교육현장의이해",
    credits: 2,
    category: "교직이론",
    description: "교직이론 선택 (2학점)",
  },
  {
    courseCode: "ERC3013",
    courseTitle: "학교안전의이론과실제",
    credits: 2,
    category: "교직이론",
    description: "교직이론 선택 (2학점)",
  },
  // 교육실습 (학교현장실습 및 교육봉사활동)
  {
    courseCode: "ERC0024",
    courseTitle: "학교현장실습Ⅰ(참관실습)",
    credits: 1,
    category: "교육실습(학교현장실습)",
    description: "학교현장실습Ⅰ (1학점, 2주, 3학기 개설)",
  },
  {
    courseCode: "ERC0025",
    courseTitle: "학교현장실습Ⅱ(수업실습)",
    credits: 1,
    category: "교육실습(학교현장실습)",
    description: "학교현장실습Ⅱ (1학점, 2주, 5학기 개설 - Ⅰ 선이수 필수)",
  },
  {
    courseCode: "ERC0026",
    courseTitle: "학교현장실습Ⅲ(종합실습)",
    credits: 2,
    category: "교육실습(학교현장실습)",
    description: "학교현장실습Ⅲ (2학점, 4주, 7학기 이상 개설)",
  },
  {
    courseCode: "ERC0022",
    courseTitle: "교육봉사활동1",
    credits: 1,
    category: "교육봉사활동",
    description: "교육봉사활동1 (1학점, 30시간)",
  },
  {
    courseCode: "ERC0023",
    courseTitle: "교육봉사활동2",
    credits: 1,
    category: "교육봉사활동",
    description: "교육봉사활동2 (1학점, 30시간)",
  },
];

/**
 * 공식 학업이수 가이드(https://edu.dongguk.edu/page/619) 기반 공통요건 카탈로그 초기값
 */
export const OFFICIAL_GRADUATION_CATALOG: OfficialGraduationCatalog = {
  version: OFFICIAL_CATALOG_VERSION,
  sourceUrl: OFFICIAL_GUIDE_URL,
  sourceTitle: "동국대학교 사범대학·교육학과 학업이수 가이드",
  lastVerifiedAt: OFFICIAL_GUIDE_VERIFIED_DATE,
  updatedByAdminName: "시스템 초기 공식 기준 (page/619)",
  cohorts: {
    "2014-2015": {
      cohortId: "2014-2015",
      cohortLabel: "2014~2015학년도 신입학생",
      admissionYears: [2014, 2015],
      curriculumYearLabel: "2014~2015학년도 교육과정",
      totalGraduationCredits: 130,
      commonLiberalArtsCredits: null,
      commonLiberalArtsRangeLabel: "25~29학점",
      commonLiberalArtsMinCredits: 25,
      commonLiberalArtsStatus: "needs_admin_review",
      academicFoundationCredits: 6,
      academicFoundationStatus: "confirmed",
      generalSingleMajorCredits: 54,
      generalDoublePrimaryCredits: 50,
      eduSingleMajorCredits: 66,
      eduDoublePrimaryCredits: 62,
      eduMajorRuleStatus: "confirmed",
      eduDoublePartnerCredits: 50,
      generalDoublePartnerCredits: null,
      subjectEducationCredits: 9,
      teachingTotalCredits: 22,
      teachingTheoryCredits: 12,
      teachingTheoryMinSubjects: 6,
      teachingLiteracyCredits: 6,
      teachingPracticumMinCredits: 4,
      teachingPracticumMaxCredits: 6,
      volunteeringCredits: 2,
      volunteeringHours: 60,
      schoolPracticumMinCredits: 2,
      personalityTestMinCount: 2,
      cprMinCount: 2,
      genderSensitivityMinCount: 2,
      majorGpaMin: 2.31,
      teachingGpaMin: 2.75,
      graduationThesisRequired: true,
      englishLectureExempt: true,
      sourceUrl: OFFICIAL_GUIDE_URL,
      lastVerifiedAt: OFFICIAL_GUIDE_VERIFIED_DATE,
      reviewStatus: "confirmed",
      version: OFFICIAL_CATALOG_VERSION,
      adminMemo:
        "2014~2015학년도 공통교양은 세부 구성을 요람에서 확인 필요(25~29학점). 교육학과 교직이론 대체이수에 따른 +12학점(66/62학점)은 2015학년도 입학생부터 의무 적용.",
    },
    "2016-2020": {
      cohortId: "2016-2020",
      cohortLabel: "2016~2020학년도 신입학생",
      admissionYears: [2016, 2017, 2018, 2019, 2020],
      curriculumYearLabel: "2016~2020학년도 교육과정",
      totalGraduationCredits: 130,
      commonLiberalArtsCredits: null,
      commonLiberalArtsRangeLabel: "29~31학점",
      commonLiberalArtsMinCredits: 29,
      commonLiberalArtsStatus: "needs_admin_review",
      academicFoundationCredits: 6,
      academicFoundationStatus: "confirmed",
      generalSingleMajorCredits: 54,
      generalDoublePrimaryCredits: 50,
      eduSingleMajorCredits: 66,
      eduDoublePrimaryCredits: 62,
      eduMajorRuleStatus: "confirmed",
      eduDoublePartnerCredits: 50,
      generalDoublePartnerCredits: null,
      subjectEducationCredits: 9,
      teachingTotalCredits: 22,
      teachingTheoryCredits: 12,
      teachingTheoryMinSubjects: 6,
      teachingLiteracyCredits: 6,
      teachingPracticumMinCredits: 4,
      teachingPracticumMaxCredits: 6,
      volunteeringCredits: 2,
      volunteeringHours: 60,
      schoolPracticumMinCredits: 2,
      personalityTestMinCount: 2,
      cprMinCount: 2,
      genderSensitivityMinCount: 2,
      majorGpaMin: 2.31,
      teachingGpaMin: 2.75,
      graduationThesisRequired: true,
      englishLectureExempt: true,
      sourceUrl: OFFICIAL_GUIDE_URL,
      lastVerifiedAt: OFFICIAL_GUIDE_VERIFIED_DATE,
      reviewStatus: "confirmed",
      version: OFFICIAL_CATALOG_VERSION,
      adminMemo:
        "2016~2020학년도 공통교양은 입학연도별 세부 구성을 요람에서 확인 필요(29~31학점). 2020학년도 이전 입학자(2022.8 이후 졸업) 성인지 교육 2회 이상.",
    },
    "2021-2022": {
      cohortId: "2021-2022",
      cohortLabel: "2021~2022학년도 신입학생",
      admissionYears: [2021, 2022],
      curriculumYearLabel: "2021~2022학년도 교육과정",
      totalGraduationCredits: 130,
      commonLiberalArtsCredits: 29,
      commonLiberalArtsRangeLabel: "29학점",
      commonLiberalArtsMinCredits: 29,
      commonLiberalArtsStatus: "confirmed",
      academicFoundationCredits: 6,
      academicFoundationStatus: "confirmed",
      generalSingleMajorCredits: 54,
      generalDoublePrimaryCredits: 50,
      eduSingleMajorCredits: 66,
      eduDoublePrimaryCredits: 62,
      eduMajorRuleStatus: "confirmed",
      eduDoublePartnerCredits: 50,
      generalDoublePartnerCredits: null,
      subjectEducationCredits: 9,
      teachingTotalCredits: 22,
      teachingTheoryCredits: 12,
      teachingTheoryMinSubjects: 6,
      teachingLiteracyCredits: 6,
      teachingPracticumMinCredits: 4,
      teachingPracticumMaxCredits: 6,
      volunteeringCredits: 2,
      volunteeringHours: 60,
      schoolPracticumMinCredits: 2,
      personalityTestMinCount: 2,
      cprMinCount: 2,
      genderSensitivityMinCount: 4,
      majorGpaMin: 2.31,
      teachingGpaMin: 2.75,
      graduationThesisRequired: true,
      englishLectureExempt: true,
      sourceUrl: OFFICIAL_GUIDE_URL,
      lastVerifiedAt: OFFICIAL_GUIDE_VERIFIED_DATE,
      reviewStatus: "confirmed",
      version: OFFICIAL_CATALOG_VERSION,
      adminMemo:
        "2021학년도 이후 신입학생부터 성인지 교육 4회 이상 이수 필수. 교육학과 단일전공 66학점 / 복수전공 주전공 62학점 적용.",
    },
    "2023": {
      cohortId: "2023",
      cohortLabel: "2023학년도 신입학생",
      admissionYears: [2023],
      curriculumYearLabel: "2023학년도 교육과정",
      totalGraduationCredits: 130,
      commonLiberalArtsCredits: 29,
      commonLiberalArtsRangeLabel: "29학점",
      commonLiberalArtsMinCredits: 29,
      commonLiberalArtsStatus: "confirmed",
      academicFoundationCredits: 6,
      academicFoundationStatus: "confirmed",
      generalSingleMajorCredits: 54,
      generalDoublePrimaryCredits: 50,
      eduSingleMajorCredits: 66,
      eduDoublePrimaryCredits: 62,
      eduMajorRuleStatus: "confirmed",
      eduDoublePartnerCredits: 50,
      generalDoublePartnerCredits: null,
      subjectEducationCredits: 9,
      teachingTotalCredits: 22,
      teachingTheoryCredits: 12,
      teachingTheoryMinSubjects: 6,
      teachingLiteracyCredits: 6,
      teachingPracticumMinCredits: 4,
      teachingPracticumMaxCredits: 6,
      volunteeringCredits: 2,
      volunteeringHours: 60,
      schoolPracticumMinCredits: 2,
      personalityTestMinCount: 2,
      cprMinCount: 2,
      genderSensitivityMinCount: 4,
      majorGpaMin: 2.31,
      teachingGpaMin: 2.75,
      graduationThesisRequired: true,
      englishLectureExempt: true,
      sourceUrl: OFFICIAL_GUIDE_URL,
      lastVerifiedAt: OFFICIAL_GUIDE_VERIFIED_DATE,
      reviewStatus: "confirmed",
      version: OFFICIAL_CATALOG_VERSION,
      adminMemo:
        "2023학년도 신입학생 기준: 총 130학점, 공통교양 29학점, 학문기초(외국어영역) 6학점, 교육학과 단일전공 66학점 / 복수전공 주전공 62학점.",
    },
    "2024-2025": {
      cohortId: "2024-2025",
      cohortLabel: "2024~2025학년도 신입학생",
      admissionYears: [2024, 2025],
      curriculumYearLabel: "2024~2025학년도 교육과정",
      totalGraduationCredits: 130,
      commonLiberalArtsCredits: 28,
      commonLiberalArtsRangeLabel: "28학점",
      commonLiberalArtsMinCredits: 28,
      commonLiberalArtsStatus: "confirmed",
      academicFoundationCredits: 6,
      academicFoundationStatus: "confirmed",
      generalSingleMajorCredits: 60,
      generalDoublePrimaryCredits: 50,
      eduSingleMajorCredits: 66,
      eduDoublePrimaryCredits: 62,
      eduMajorRuleStatus: "confirmed",
      eduDoublePartnerCredits: 50,
      generalDoublePartnerCredits: null,
      subjectEducationCredits: 9,
      teachingTotalCredits: 22,
      teachingTheoryCredits: 12,
      teachingTheoryMinSubjects: 6,
      teachingLiteracyCredits: 6,
      teachingPracticumMinCredits: 4,
      teachingPracticumMaxCredits: 6,
      volunteeringCredits: 2,
      volunteeringHours: 60,
      schoolPracticumMinCredits: 2,
      personalityTestMinCount: 2,
      cprMinCount: 2,
      genderSensitivityMinCount: 4,
      majorGpaMin: 2.31,
      teachingGpaMin: 2.75,
      graduationThesisRequired: true,
      englishLectureExempt: true,
      sourceUrl: OFFICIAL_GUIDE_URL,
      lastVerifiedAt: OFFICIAL_GUIDE_VERIFIED_DATE,
      reviewStatus: "confirmed",
      version: OFFICIAL_CATALOG_VERSION,
      adminMemo:
        "2024~2025학년도부터 공통교양 28학점, 사범대 일반 단일전공 60학점. 교육학과 최저이수 기준은 공식 각주에 따라 단일전공 66학점 / 복수전공 주전공 62학점.",
    },
    "2026": {
      cohortId: "2026",
      cohortLabel: "2026학년도 신입학생",
      admissionYears: [2026],
      curriculumYearLabel: "2026학년도 교육과정",
      totalGraduationCredits: 130,
      commonLiberalArtsCredits: 28,
      commonLiberalArtsRangeLabel: "28학점",
      commonLiberalArtsMinCredits: 28,
      commonLiberalArtsStatus: "confirmed",
      academicFoundationCredits: 6,
      academicFoundationStatus: "confirmed",
      generalSingleMajorCredits: 60,
      generalDoublePrimaryCredits: 50,
      eduSingleMajorCredits: 66,
      eduDoublePrimaryCredits: 62,
      eduMajorRuleStatus: "confirmed",
      eduDoublePartnerCredits: 50,
      generalDoublePartnerCredits: null,
      subjectEducationCredits: 9,
      teachingTotalCredits: 22,
      teachingTheoryCredits: 12,
      teachingTheoryMinSubjects: 6,
      teachingLiteracyCredits: 6,
      teachingPracticumMinCredits: 4,
      teachingPracticumMaxCredits: 6,
      volunteeringCredits: 2,
      volunteeringHours: 60,
      schoolPracticumMinCredits: 2,
      personalityTestMinCount: 2,
      cprMinCount: 2,
      genderSensitivityMinCount: 4,
      majorGpaMin: 2.31,
      teachingGpaMin: 2.75,
      graduationThesisRequired: true,
      englishLectureExempt: true,
      sourceUrl: OFFICIAL_GUIDE_URL,
      lastVerifiedAt: OFFICIAL_GUIDE_VERIFIED_DATE,
      reviewStatus: "confirmed",
      version: OFFICIAL_CATALOG_VERSION,
      adminMemo:
        "2026학년도 신입학생 기준: 총 130학점, 공통교양 28학점, 학문기초(외국어영역) 6학점, 교육학과 단일전공 66학점 / 복수전공 주전공 62학점.",
    },
  },
};

/**
 * 학번/입학연도 문자열("22학번", "2022학년도 입학 (22학번)", 2022 등)에서 4자리 신입학 연도를 추출합니다.
 */
export function parseAdmissionYearNumber(raw: string | number | undefined | null): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw >= 2000 && raw <= 2035) return Math.floor(raw);
    if (raw >= 10 && raw <= 35) return 2000 + Math.floor(raw);
  }
  const text = String(raw || "").trim();
  const fourDigitMatch = text.match(/(20[12]\d)/);
  if (fourDigitMatch) {
    return Number(fourDigitMatch[1]);
  }
  const twoDigitMatch = text.match(/(\d{2})\s*학번/);
  if (twoDigitMatch) {
    const yy = Number(twoDigitMatch[1]);
    return 2000 + yy;
  }
  return 2022; // 기본값: 2022학년도
}

export function formatAdmissionYearLabel(admissionYearNumber: number): string {
  const yy = String(admissionYearNumber).slice(-2);
  return `${admissionYearNumber}학년도 신입학 (${yy}학번)`;
}

/**
 * 신입학 연도를 공식 학업이수 가이드의 6개 연도 구간으로 변환합니다.
 */
export function resolveCohortBand(admissionYearNumber: number): CohortBandId {
  if (admissionYearNumber <= 2015) return "2014-2015";
  if (admissionYearNumber <= 2020) return "2016-2020";
  if (admissionYearNumber <= 2022) return "2021-2022";
  if (admissionYearNumber === 2023) return "2023";
  if (admissionYearNumber <= 2025) return "2024-2025";
  return "2026";
}

/**
 * 전공 이수 형태와 교직 이수 상태를 기존 StudentProgress 하위 호환 필드로 매핑합니다.
 */
export function deriveLegacyFieldsFromAcademicProfile(profile: StudentAcademicProfile): {
  admissionYear: string;
  majorType: "단일전공(심화)" | "복수전공 이수" | "교직 이수 병행";
  doubleMajorName: string;
  isTeacherTrack: boolean;
} {
  const hasDouble = profile.majorPlanType !== "single";
  const isTeacherTrack = profile.teachingTrackStatus !== "non_teaching";
  let majorType: "단일전공(심화)" | "복수전공 이수" | "교직 이수 병행" = "단일전공(심화)";
  if (hasDouble) {
    majorType = "복수전공 이수";
  } else if (isTeacherTrack) {
    majorType = "교직 이수 병행";
  }
  return {
    admissionYear: profile.admissionYearLabel,
    majorType,
    doubleMajorName: hasDouble ? profile.doubleMajorDepartment : "",
    isTeacherTrack,
  };
}

/**
 * 강좌명 또는 학수번호를 정규화합니다 (중복 검사 및 대체인정 매칭용).
 */
export function normalizeCourseText(text: string | undefined): string {
  if (!text) return "";
  return text
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]·\-_]/g, "");
}

/**
 * 강좌가 교육학과 교직이론 대체인정 전공과목인지 판별합니다.
 */
export function matchTeachingSubstitution(course: {
  courseCode?: string;
  courseTitle: string;
  category?: CourseCategory;
}): TeachingTheorySubstitutionItem | null {
  const normCode = normalizeCourseText(course.courseCode);
  const normTitle = normalizeCourseText(course.courseTitle);

  for (const item of EDU_TEACHING_SUBSTITUTION_MAP) {
    if (normCode && normCode === normalizeCourseText(item.eduCourseCode)) {
      return item;
    }
  }

  // 학수번호가 없거나 다르더라도 교육학과 전공 구분이면서 공식 대체인정 과목명과 일치하는 경우 매칭
  if (!course.category || course.category === "전공필수/선택 (교육학과)") {
    for (const item of EDU_TEACHING_SUBSTITUTION_MAP) {
      if (normTitle === normalizeCourseText(item.eduCourseTitle)) {
        return item;
      }
    }
  }

  return null;
}

/**
 * 강좌 목록을 이수 연도 + 학기 순으로 정렬합니다.
 */
const SEMESTER_ORDER: Record<CourseSemester, number> = {
  "1학기": 1,
  여름학기: 2,
  "2학기": 3,
  겨울학기: 4,
};

export function sortCoursesBySemester(courses: EnrolledCourse[]): EnrolledCourse[] {
  return [...courses].sort((a, b) => {
    if (a.yearTaken !== b.yearTaken) {
      return a.yearTaken - b.yearTaken;
    }
    const semA = SEMESTER_ORDER[a.semesterTaken] ?? 9;
    const semB = SEMESTER_ORDER[b.semesterTaken] ?? 9;
    if (semA !== semB) {
      return semA - semB;
    }
    return a.courseTitle.localeCompare(b.courseTitle, "ko");
  });
}

export interface DuplicateCourseCheckResult {
  hasExactDuplicate: boolean;
  hasSimilarWarning: boolean;
  matchedCourses: EnrolledCourse[];
  warningMessage: string;
}

/**
 * 강좌 추가/수정 시 중복 강좌 등록 여부를 검사합니다.
 * - 동일 강좌 여부를 자동 삭제하지 않고 사용자에게 경고 후 재확인할 수 있도록 결과를 반환합니다.
 */
export function detectDuplicateCourses(
  candidate: {
    id?: string;
    courseCode?: string;
    courseTitle: string;
    category?: CourseCategory;
  },
  existingCourses: EnrolledCourse[]
): DuplicateCourseCheckResult {
  const candCode = normalizeCourseText(candidate.courseCode);
  const candTitle = normalizeCourseText(candidate.courseTitle);
  const candSub = matchTeachingSubstitution(candidate);

  const matched: EnrolledCourse[] = [];
  let hasExactDuplicate = false;
  let hasSimilarWarning = false;
  const reasons: string[] = [];

  for (const existing of existingCourses) {
    if (candidate.id && existing.id === candidate.id) continue;

    const exCode = normalizeCourseText(existing.courseCode);
    const exTitle = normalizeCourseText(existing.courseTitle);
    const exSub = matchTeachingSubstitution(existing);

    if (candCode && exCode && candCode === exCode) {
      hasExactDuplicate = true;
      matched.push(existing);
      reasons.push(`동일한 학수번호(${existing.courseCode}) 강좌 '${existing.courseTitle}'이(가) 이미 등록되어 있습니다.`);
      continue;
    }

    if (candTitle && exTitle && candTitle === exTitle) {
      hasExactDuplicate = true;
      matched.push(existing);
      reasons.push(`동일한 강좌명('${existing.courseTitle}')이 이미 ${existing.yearTaken}년 ${existing.semesterTaken}에 등록되어 있습니다.`);
      continue;
    }

    // 교육학과 전공 대체과목(예: EDU2010 교육사회학)과 일반 교직이론 과목(예: ERC0005 교육사회)을 둘 다 넣으려는 경우 안내
    if (candSub && exSub && candSub.substitutedTheoryKey === exSub.substitutedTheoryKey) {
      hasSimilarWarning = true;
      matched.push(existing);
      reasons.push(
        `이미 동일한 교직이론 대체 영역('${existing.courseTitle}')이 등록되어 있습니다. 재수강 또는 중복 입력인지 확인해 주세요.`
      );
      continue;
    }

    if (
      candTitle.length >= 3 &&
      exTitle.length >= 3 &&
      (candTitle.includes(exTitle) || exTitle.includes(candTitle))
    ) {
      hasSimilarWarning = true;
      matched.push(existing);
      reasons.push(
        `유사한 이름의 강좌('${existing.courseTitle}', ${existing.yearTaken}년 ${existing.semesterTaken})가 이미 등록되어 있습니다.`
      );
    }
  }

  return {
    hasExactDuplicate,
    hasSimilarWarning,
    matchedCourses: matched,
    warningMessage: reasons.join(" "),
  };
}

/**
 * 기존 회원의 StudentProgress 및 User 데이터를 손실 없이 새 구조로 마이그레이션합니다.
 */
export function migrateStudentProgress(
  raw: Partial<StudentProgress> | null | undefined,
  userProfile?: Partial<User> | null
): StudentProgress {
  const userId = raw?.userId || userProfile?.id || "user-student-1";
  const rawYearSource =
    raw?.academicProfile?.admissionYearNumber ||
    raw?.admissionYear ||
    userProfile?.academicProfile?.admissionYearNumber ||
    userProfile?.studentIdOrYear ||
    "2022";
  const admissionYearNumber = parseAdmissionYearNumber(rawYearSource);
  const admissionYearLabel =
    raw?.academicProfile?.admissionYearLabel ||
    userProfile?.academicProfile?.admissionYearLabel ||
    (raw?.admissionYear && raw.admissionYear.trim().length > 0
      ? raw.admissionYear
      : formatAdmissionYearLabel(admissionYearNumber));

  // 기존 majorType & doubleMajorName & isTeacherTrack에서 새 트랙 구조 추론
  const legacyDoubleMajor =
    raw?.academicProfile?.doubleMajorDepartment ??
    userProfile?.academicProfile?.doubleMajorDepartment ??
    raw?.doubleMajorName ??
    (userProfile?.doubleMajor && !userProfile.doubleMajor.includes("단일")
      ? userProfile.doubleMajor
      : "") ??
    "";

  let majorPlanType: MajorPlanType =
    raw?.academicProfile?.majorPlanType ||
    userProfile?.academicProfile?.majorPlanType ||
    "single";

  if (!raw?.academicProfile?.majorPlanType && !userProfile?.academicProfile?.majorPlanType) {
    if (raw?.majorType === "복수전공 이수" || legacyDoubleMajor.trim().length > 0) {
      // 사범대 학과명 키워드 포함 시 double_edu, 그 외에는 double_general 기본값
      const eduDeptKeywords = [
        "국어교육",
        "역사교육",
        "지리교육",
        "수학교육",
        "가정교육",
        "체육교육",
        "사범",
      ];
      const isEduPartner = eduDeptKeywords.some((kw) => legacyDoubleMajor.includes(kw));
      majorPlanType = isEduPartner ? "double_edu" : "double_general";
    } else {
      majorPlanType = "single";
    }
  }

  let teachingTrackStatus: TeachingTrackStatus =
    raw?.academicProfile?.teachingTrackStatus ||
    userProfile?.academicProfile?.teachingTrackStatus ||
    "educational_major";

  if (!raw?.academicProfile?.teachingTrackStatus && !userProfile?.academicProfile?.teachingTrackStatus) {
    if (raw?.isTeacherTrack === false) {
      teachingTrackStatus = "non_teaching";
    } else if (majorPlanType === "double_edu") {
      teachingTrackStatus = "double_teaching";
    } else {
      teachingTrackStatus = "educational_major";
    }
  }

  const academicProfile: StudentAcademicProfile = {
    admissionYearNumber,
    admissionYearLabel,
    majorPlanType,
    hasDoubleMajor: majorPlanType !== "single",
    doubleMajorDepartment: majorPlanType === "single" ? "" : legacyDoubleMajor.trim(),
    teachingTrackStatus,
    isEnglishTrack: Boolean(
      raw?.academicProfile?.isEnglishTrack ?? userProfile?.academicProfile?.isEnglishTrack ?? false
    ),
    specialConditionMemo:
      raw?.academicProfile?.specialConditionMemo ??
      userProfile?.academicProfile?.specialConditionMemo ??
      "",
    adminVerifiedSpecialCondition: Boolean(raw?.academicProfile?.adminVerifiedSpecialCondition),
    updatedAt:
      raw?.academicProfile?.updatedAt ||
      userProfile?.academicProfile?.updatedAt ||
      new Date().toISOString().slice(0, 10),
  };

  const legacyMapped = deriveLegacyFieldsFromAcademicProfile(academicProfile);

  const volunteeringRecords = Array.isArray(raw?.volunteeringRecords)
    ? raw!.volunteeringRecords
    : [];

  const totalLogHours = volunteeringRecords.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);

  const volunteeringState: VolunteeringCourseState = {
    eduVolunteering1Completed:
      raw?.volunteeringState?.eduVolunteering1Completed ?? totalLogHours >= 30,
    eduVolunteering1Semester: raw?.volunteeringState?.eduVolunteering1Semester || "",
    eduVolunteering2Completed:
      raw?.volunteeringState?.eduVolunteering2Completed ?? totalLogHours >= 60,
    eduVolunteering2Semester: raw?.volunteeringState?.eduVolunteering2Semester || "",
    confirmationSubmitted: Boolean(raw?.volunteeringState?.confirmationSubmitted),
  };

  const practicumState: SchoolPracticumState = {
    practicum1Completed: Boolean(raw?.practicumState?.practicum1Completed),
    practicum1Semester: raw?.practicumState?.practicum1Semester || "",
    practicum2Completed: Boolean(raw?.practicumState?.practicum2Completed),
    practicum2Semester: raw?.practicumState?.practicum2Semester || "",
    practicum3Completed: Boolean(raw?.practicumState?.practicum3Completed),
    practicum3Semester: raw?.practicumState?.practicum3Semester || "",
    humanRightsEducationCompleted: Boolean(raw?.practicumState?.humanRightsEducationCompleted),
  };

  const teachingChecklist: TeachingChecklistState = {
    personalityTestPassCount: Number(raw?.teachingChecklist?.personalityTestPassCount ?? 0),
    cprCompletedCount: Number(raw?.teachingChecklist?.cprCompletedCount ?? 0),
    cprExternalCount: Number(raw?.teachingChecklist?.cprExternalCount ?? 0),
    genderSensitivityCount: Number(raw?.teachingChecklist?.genderSensitivityCount ?? 0),
    majorGpa:
      raw?.teachingChecklist?.majorGpa !== undefined && raw?.teachingChecklist?.majorGpa !== null
        ? Number(raw.teachingChecklist.majorGpa)
        : null,
    teachingGpa:
      raw?.teachingChecklist?.teachingGpa !== undefined &&
      raw?.teachingChecklist?.teachingGpa !== null
        ? Number(raw.teachingChecklist.teachingGpa)
        : null,
    graduationThesisCompleted: Boolean(raw?.teachingChecklist?.graduationThesisCompleted),
    disqualificationGuidanceAcknowledged: Boolean(
      raw?.teachingChecklist?.disqualificationGuidanceAcknowledged
    ),
    officialVerificationConfirmedByAdmin: Boolean(
      raw?.teachingChecklist?.officialVerificationConfirmedByAdmin
    ),
  };

  const courses: EnrolledCourse[] = Array.isArray(raw?.courses)
    ? sortCoursesBySemester(
        raw!.courses.map((c) => {
          const matchedSub = matchTeachingSubstitution(c);
          return {
            ...c,
            credits: Number(c.credits) || 0,
            yearTaken: Number(c.yearTaken) || admissionYearNumber,
            isCompleted: c.isCompleted !== false,
            recognitionStatus: c.recognitionStatus || "confirmed",
            substitutedTeachingSubjectCode:
              c.substitutedTeachingSubjectCode ||
              (matchedSub ? matchedSub.ercCourseCodes[0] : undefined),
          };
        })
      )
    : [];

  const isProfileComplete =
    raw?.isProfileComplete !== undefined
      ? raw.isProfileComplete
      : Boolean(raw?.academicProfile || userProfile?.academicProfile);

  return {
    userId,
    admissionYear: legacyMapped.admissionYear,
    majorType: legacyMapped.majorType,
    doubleMajorName: legacyMapped.doubleMajorName,
    isTeacherTrack: legacyMapped.isTeacherTrack,
    credits: raw?.credits ? { ...raw.credits } : {},
    volunteeringRecords,
    checklist: Array.isArray(raw?.checklist) ? [...raw!.checklist] : [],
    academicProfile,
    courses,
    volunteeringState,
    practicumState,
    teachingChecklist,
    isProfileComplete,
    officialAdminVerified: Boolean(raw?.officialAdminVerified),
  };
}

export interface ApplicableRequirementItem {
  id: string;
  category: RequirementCategory;
  title: string;
  targetValue: number | null;
  targetDisplay: string;
  unit: "학점" | "시간" | "회" | "평점" | "과목" | "여부";
  reviewStatus: RuleReviewStatus;
  applicableTarget: string;
  description: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  version: string;
}

export interface ApplicableRequirementsSummary {
  cohortBand: CohortBandId;
  cohortRule: OfficialCohortRuleSet;
  eduMajorTargetCredits: number;
  eduMajorTargetStatus: RuleReviewStatus;
  generalMajorReferenceCredits: number;
  doubleMajorTargetCredits: number | null;
  doubleMajorTargetStatus: RuleReviewStatus;
  commonLiberalArtsTargetCredits: number | null;
  commonLiberalArtsMinCredits: number;
  commonLiberalArtsDisplay: string;
  commonLiberalArtsStatus: RuleReviewStatus;
  academicFoundationTargetCredits: number;
  teachingRequired: boolean;
  genderSensitivityRequiredCount: number;
  items: ApplicableRequirementItem[];
}

/**
 * 학생의 학사정보(입학연도, 전공이수형태, 교직상태, 영어트랙 여부)에 따라
 * 자동 적용되는 공식 졸업요건을 도출합니다.
 */
export function resolveApplicableRequirements(
  profile: StudentAcademicProfile,
  catalog: OfficialGraduationCatalog = OFFICIAL_GRADUATION_CATALOG
): ApplicableRequirementsSummary {
  const cohortBand = resolveCohortBand(profile.admissionYearNumber);
  const cohortRule = catalog.cohorts[cohortBand] || OFFICIAL_GRADUATION_CATALOG.cohorts["2021-2022"];

  const isSingleMajor = profile.majorPlanType === "single";
  const eduMajorTargetCredits = isSingleMajor
    ? cohortRule.eduSingleMajorCredits // 66
    : cohortRule.eduDoublePrimaryCredits; // 62

  const generalMajorReferenceCredits = isSingleMajor
    ? cohortRule.generalSingleMajorCredits // 54 or 60
    : cohortRule.generalDoublePrimaryCredits; // 50

  // 2014학번은 각주("2015학년도 입학생부터 대체이수한 교직학점 12학점만큼 전공학점 추가 이수")에 따라 관리자 확인 필요 표시
  const eduMajorTargetStatus: RuleReviewStatus =
    profile.admissionYearNumber === 2014 ? "needs_admin_review" : cohortRule.eduMajorRuleStatus;

  let doubleMajorTargetCredits: number | null = null;
  let doubleMajorTargetStatus: RuleReviewStatus = "confirmed";
  if (profile.majorPlanType === "double_edu") {
    doubleMajorTargetCredits = cohortRule.eduDoublePartnerCredits; // 50
    doubleMajorTargetStatus = "confirmed";
  } else if (profile.majorPlanType === "double_general") {
    doubleMajorTargetCredits = cohortRule.generalDoublePartnerCredits; // null (타 학과 기준)
    doubleMajorTargetStatus = "needs_admin_review";
  }

  // 영어트랙 대상자는 공통교양/핵심교양 별도 기준 적용이므로 확인 필요 처리
  const commonLiberalArtsStatus: RuleReviewStatus = profile.isEnglishTrack
    ? "needs_admin_review"
    : cohortRule.commonLiberalArtsStatus;

  const commonLiberalArtsTargetCredits = profile.isEnglishTrack
    ? null
    : cohortRule.commonLiberalArtsCredits;

  const commonLiberalArtsDisplay = profile.isEnglishTrack
    ? `${cohortRule.commonLiberalArtsRangeLabel} (영어트랙 별도기준 확인 필요)`
    : cohortRule.commonLiberalArtsRangeLabel;

  const teachingRequired = profile.teachingTrackStatus !== "non_teaching";
  const genderSensitivityRequiredCount =
    profile.admissionYearNumber <= 2020 ? 2 : cohortRule.genderSensitivityMinCount;

  const items: ApplicableRequirementItem[] = [
    {
      id: "req-total-credits",
      category: "졸업 이수 학점",
      title: "총 졸업 취득학점",
      targetValue: cohortRule.totalGraduationCredits,
      targetDisplay: `${cohortRule.totalGraduationCredits}학점 이상`,
      unit: "학점",
      reviewStatus: "confirmed",
      applicableTarget: `${cohortRule.cohortLabel} 전원`,
      description: "신입학 재학생 최저 졸업이수학점 (동일 강좌 학점 이중 합산 제외)",
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
      version: cohortRule.version,
    },
    {
      id: "req-edu-major-credits",
      category: "전공 이수 학점",
      title: isSingleMajor
        ? "교육학과 단일전공 이수학점 (별도 기준)"
        : "교육학과 복수전공 주전공 이수학점 (별도 기준)",
      targetValue: eduMajorTargetCredits,
      targetDisplay: `${eduMajorTargetCredits}학점 이상 (사범대 일반 ${generalMajorReferenceCredits} + 교직이론 대체 12)`,
      unit: "학점",
      reviewStatus: eduMajorTargetStatus,
      applicableTarget: isSingleMajor
        ? "교육학과 단일전공 신입학생"
        : "교육학과 복수전공 이수자(주전공)",
      description:
        profile.admissionYearNumber === 2014
          ? "공식 안내문 각주상 2015학년도 입학생부터 +12학점 의무 적용으로 명시되어 있어 2014학번은 학사운영실 확인 필요"
          : "교육학과는 전공과목으로 교직이론(12학점)을 대체이수하므로 사범대 일반 기준보다 12학점을 추가 이수합니다 (교과교육영역 9학점 포함).",
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
      version: cohortRule.version,
    },
    {
      id: "req-common-liberal-arts",
      category: "교양 이수 학점",
      title: "공통교양(기초교양) 이수학점",
      targetValue: commonLiberalArtsTargetCredits,
      targetDisplay: commonLiberalArtsDisplay,
      unit: "학점",
      reviewStatus: commonLiberalArtsStatus,
      applicableTarget: profile.isEnglishTrack
        ? `${cohortRule.cohortLabel} (영어트랙 대상자)`
        : cohortRule.cohortLabel,
      description:
        commonLiberalArtsStatus === "needs_admin_review"
          ? "입학연도별 세부 교양 영역 또는 영어트랙 별도 기준이 적용되므로 입학연도 교육과정 요람 확인이 필요합니다."
          : `${cohortRule.curriculumYearLabel} 공식 공통교양(기초교양) 최저이수학점`,
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
      version: cohortRule.version,
    },
    {
      id: "req-academic-foundation",
      category: "교양 이수 학점",
      title: "학문기초(외국어영역) 이수학점",
      targetValue: cohortRule.academicFoundationCredits,
      targetDisplay: `${cohortRule.academicFoundationCredits}학점 이상 (외국어영역)`,
      unit: "학점",
      reviewStatus: cohortRule.academicFoundationStatus,
      applicableTarget: "교육학과·국어교육과·역사교육과·지리교육과 신입학생",
      description:
        "공식 학업이수 가이드 '나. 학문기초': 교육학과는 학문기초(외국어영역, PRI5*** 등) 6학점 이수 필수",
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
      version: cohortRule.version,
    },
  ];

  if (!isSingleMajor) {
    items.push({
      id: "req-double-major-credits",
      category: "복수전공 이수 학점",
      title:
        profile.majorPlanType === "double_edu"
          ? `복수전공(${profile.doubleMajorDepartment || "사범대 타 학과"}) 이수학점`
          : `복수전공(${profile.doubleMajorDepartment || "일반대 타 학과"}) 이수학점`,
      targetValue: doubleMajorTargetCredits,
      targetDisplay:
        doubleMajorTargetCredits !== null
          ? `${doubleMajorTargetCredits}학점 이상`
          : "확인 필요 (복수전공 학과 기준에 따름)",
      unit: "학점",
      reviewStatus: doubleMajorTargetStatus,
      applicableTarget:
        profile.majorPlanType === "double_edu"
          ? "사범대학 내 타 학과 복수전공자"
          : "비사범대(일반대학) 복수전공자",
      description:
        profile.majorPlanType === "double_edu"
          ? "사범대학 복수전공 최저이수학점 50학점 (교원자격 복수전공 시 해당 학과 기본이수과목 및 교과교육영역 포함 여부는 학과 확인)"
          : "공식 가이드: 비사범대 복수전공 학점은 복수전공 대학(학과)의 학점 기준에 따릅니다.",
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
      version: cohortRule.version,
    });
  }

  if (teachingRequired) {
    items.push(
      {
        id: "req-teaching-total",
        category: "교직 이수 학점",
        title: "교직과목 총 이수학점 (교직이론 12 + 교직소양 6 + 교육실습 4~6)",
        targetValue: cohortRule.teachingTotalCredits,
        targetDisplay: `${cohortRule.teachingTotalCredits}학점 이상 (대체인정 포함)`,
        unit: "학점",
        reviewStatus: "confirmed",
        applicableTarget: "교원자격증 취득 예정자",
        description:
          "교직이론 12학점(6과목 이상, 교육학과 전공 대체인정 가능) + 교직소양 6학점(직필 4과목) + 교육실습 4~6학점(학교현장실습 2~4학점 + 교육봉사 2학점)",
        sourceUrl: cohortRule.sourceUrl,
        lastVerifiedAt: cohortRule.lastVerifiedAt,
        version: cohortRule.version,
      },
      {
        id: "req-volunteering-hours",
        category: "교육봉사 시간",
        title: "교육봉사활동 시간 (교육봉사활동1·2)",
        targetValue: cohortRule.volunteeringHours,
        targetDisplay: `${cohortRule.volunteeringHours}시간 이상 (2학점)`,
        unit: "시간",
        reviewStatus: "confirmed",
        applicableTarget: "교원자격증 취득 예정자",
        description:
          "교육봉사활동1(ERC0022, 1학점/30시간) + 교육봉사활동2(ERC0023, 1학점/30시간) 총 60시간 이상 및 확인서 제출",
        sourceUrl: cohortRule.sourceUrl,
        lastVerifiedAt: cohortRule.lastVerifiedAt,
        version: cohortRule.version,
      },
      {
        id: "req-school-practicum",
        category: "교육실습 이수 여부",
        title: "학교현장실습 이수 (최소 2학점 이상 조합)",
        targetValue: cohortRule.schoolPracticumMinCredits,
        targetDisplay: "2학점 이상 (①Ⅰ+Ⅱ, ②Ⅲ, ③Ⅰ+Ⅱ+Ⅲ 중 택1)",
        unit: "학점",
        reviewStatus: "confirmed",
        applicableTarget: "교원자격증 취득 예정자",
        description:
          "학교현장실습Ⅰ(참관 1학점)·Ⅱ(수업 1학점, Ⅰ 선이수 필수)·Ⅲ(종합 2학점) 중 유효 조합 이수 및 실습 사전요건 충족",
        sourceUrl: cohortRule.sourceUrl,
        lastVerifiedAt: cohortRule.lastVerifiedAt,
        version: cohortRule.version,
      }
    );
  }

  return {
    cohortBand,
    cohortRule,
    eduMajorTargetCredits,
    eduMajorTargetStatus,
    generalMajorReferenceCredits,
    doubleMajorTargetCredits,
    doubleMajorTargetStatus,
    commonLiberalArtsTargetCredits,
    commonLiberalArtsMinCredits: cohortRule.commonLiberalArtsMinCredits,
    commonLiberalArtsDisplay,
    commonLiberalArtsStatus,
    academicFoundationTargetCredits: cohortRule.academicFoundationCredits,
    teachingRequired,
    genderSensitivityRequiredCount,
    items,
  };
}

export interface SchoolPracticumEvaluation {
  earnedPracticumCredits: number;
  combinationCode: "COMBO_1_2" | "COMBO_3" | "COMBO_1_2_3" | "INCOMPLETE" | "INVALID_2_WITHOUT_1";
  combinationLabel: string;
  isCombinationValid: boolean;
  hasSequenceError: boolean; // Ⅰ 미이수 상태에서 Ⅱ만 이수 체크한 경우
  sequenceErrorMessage?: string;
  prerequisites: {
    personalityTestOnce: boolean;
    cprOnce: boolean;
    humanRightsEdu: boolean;
    genderSensitivityOnce: boolean;
    allPrerequisitesMet: boolean;
  };
}

/**
 * 학교현장실습(Ⅰ·Ⅱ·Ⅲ) 조합 유효성 및 실습 참여 사전요건을 검증합니다.
 * 공식 규정(https://edu.dongguk.edu/page/619):
 * - 조합 ①: 학교현장실습Ⅰ(1학점) + 학교현장실습Ⅱ(1학점) = 2학점
 * - 조합 ②: 학교현장실습Ⅲ(2학점) = 2학점
 * - 조합 ③: 학교현장실습Ⅰ(1학점) + 학교현장실습Ⅱ(1학점) + 학교현장실습Ⅲ(2학점) = 4학점
 * - 주의: 학교현장실습Ⅰ을 이수하지 않고 학교현장실습Ⅱ를 수강할 수 없음.
 */
export function evaluateSchoolPracticum(
  practicum: SchoolPracticumState,
  checklist: TeachingChecklistState
): SchoolPracticumEvaluation {
  const p1 = Boolean(practicum.practicum1Completed);
  const p2 = Boolean(practicum.practicum2Completed);
  const p3 = Boolean(practicum.practicum3Completed);

  const earnedPracticumCredits = (p1 ? 1 : 0) + (p2 ? 1 : 0) + (p3 ? 2 : 0);
  const hasSequenceError = !p1 && p2;

  let combinationCode: SchoolPracticumEvaluation["combinationCode"] = "INCOMPLETE";
  let combinationLabel = "미충족 (최소 2학점 조합 필요)";
  let isCombinationValid = false;

  if (hasSequenceError) {
    combinationCode = "INVALID_2_WITHOUT_1";
    combinationLabel = "이수 순서 오류 (학교현장실습Ⅰ 미이수 시 Ⅱ 이수 불가)";
    isCombinationValid = false;
  } else if (p1 && p2 && p3) {
    combinationCode = "COMBO_1_2_3";
    combinationLabel = "조합 ③ 충족: 학교현장실습Ⅰ + Ⅱ + Ⅲ (총 4학점)";
    isCombinationValid = true;
  } else if (p1 && p2) {
    combinationCode = "COMBO_1_2";
    combinationLabel = "조합 ① 충족: 학교현장실습Ⅰ + Ⅱ (총 2학점)";
    isCombinationValid = true;
  } else if (p3 && !p1 && !p2) {
    combinationCode = "COMBO_3";
    combinationLabel = "조합 ② 충족: 학교현장실습Ⅲ (총 2학점)";
    isCombinationValid = true;
  } else if (p1 && p3 && !p2) {
    // Ⅰ(1학점) + Ⅲ(2학점)의 경우 Ⅲ(2학점)으로 최소 2학점 요건은 충족하나 공식 조합 안내 표시
    combinationCode = "COMBO_3";
    combinationLabel = "조합 ② 기준 충족 (학교현장실습Ⅲ 2학점 + 참관실습Ⅰ 1학점)";
    isCombinationValid = true;
  }

  const personalityTestOnce = (checklist.personalityTestPassCount || 0) >= 1;
  const cprOnce = (checklist.cprCompletedCount || 0) >= 1;
  const humanRightsEdu = Boolean(practicum.humanRightsEducationCompleted);
  const genderSensitivityOnce = (checklist.genderSensitivityCount || 0) >= 1;

  return {
    earnedPracticumCredits,
    combinationCode,
    combinationLabel,
    isCombinationValid,
    hasSequenceError,
    sequenceErrorMessage: hasSequenceError
      ? "공식 기준상 '학교현장실습Ⅰ(참관실습)'을 이수하지 않고 '학교현장실습Ⅱ(수업실습)'를 수강할 수 없습니다."
      : undefined,
    prerequisites: {
      personalityTestOnce,
      cprOnce,
      humanRightsEdu,
      genderSensitivityOnce,
      allPrerequisitesMet:
        personalityTestOnce && cprOnce && humanRightsEdu && genderSensitivityOnce,
    },
  };
}

export interface CategoryAuditCard {
  id: string;
  category: RequirementCategory;
  title: string;
  earnedValue: number;
  targetValue: number | null;
  targetDisplay: string;
  unit: "학점" | "시간" | "여부";
  percentage: number | null; // 정확한 기준값과 취득값이 모두 확정된 경우에만 0~100 계산
  status: "fulfilled" | "in_progress" | "needs_review";
  statusBadgeText: string;
  helperText: string;
  sourceUrl: string;
  lastVerifiedAt: string;
}

export interface TeachingTheoryAuditDetail {
  substitutedCourses: EnrolledCourse[]; // 교육학과 전공으로 대체인정된 과목 목록 (최대 8과목)
  directTheoryCourses: EnrolledCourse[]; // ERC**** 교직이론 직접 이수 과목 목록
  recognizedSubjectCount: number; // 대체인정 과목 수 + 직접 이수 과목 수 (중복 영역 제외)
  recognizedEquivalentCredits: number; // 과목당 2학점 기준 교직이론 인정 학점 (예: 6과목 = 12학점)
  targetSubjects: number; // 6과목
  targetCredits: number; // 12학점
  isFulfilled: boolean;
}

export interface GraduationAuditResult {
  profile: StudentAcademicProfile;
  applicable: ApplicableRequirementsSummary;
  usingCourseBasedCalculation: boolean;
  // 영역별 취득 학점 (이중 계산 방지 적용)
  totalEarnedCredits: number; // 130학점 대비 실제 취득 총학점 (각 이수완료 강좌 학점 1회만 합산)
  eduMajorEarnedCredits: number; // 교육학과 전공 취득학점 (66 또는 62 대비)
  subjectEducationEarnedCredits: number; // 교과교육영역 취득학점 (9학점 대비)
  doubleMajorEarnedCredits: number; // 복수전공 취득학점
  commonLiberalArtsEarnedCredits: number; // 공통교양 취득학점
  academicFoundationEarnedCredits: number; // 학문기초(외국어) 취득학점
  generalElectiveEarnedCredits: number; // 일반교양/자유선택 취득학점
  teachingLiteracyEarnedCredits: number; // 교직소양 취득학점 (6학점 대비)
  teachingTheoryAudit: TeachingTheoryAuditDetail;
  practicumEvaluation: SchoolPracticumEvaluation;
  volunteeringAudit: {
    course1Completed: boolean;
    course2Completed: boolean;
    loggedHours: number;
    effectiveHours: number;
    targetHours: number;
    confirmationSubmitted: boolean;
    isFulfilled: boolean;
  };
  teachingChecklistAudit: {
    personalityTestPassed: boolean;
    personalityTestCurrent: number;
    personalityTestTarget: number;
    cprPassed: boolean;
    cprCurrent: number;
    cprTarget: number;
    cprExternalWarning: boolean;
    genderSensitivityPassed: boolean;
    genderSensitivityCurrent: number;
    genderSensitivityTarget: number;
    majorGpaPassed: boolean;
    majorGpaCurrent: number | null;
    majorGpaTarget: number;
    teachingGpaPassed: boolean;
    teachingGpaCurrent: number | null;
    teachingGpaTarget: number;
    thesisCompleted: boolean;
    disqualificationGuidanceAcknowledged: boolean;
  };
  categoryCards: CategoryAuditCard[];
  unmetItems: { id: string; title: string; detail: string; category: string }[];
  needsReviewItems: { id: string; title: string; detail: string; sourceUrl: string }[];
}

/**
 * 학생의 전체 학사정보·강좌·봉사·실습·체크리스트를 분석하여 졸업요건 달성 현황을 계산합니다.
 * - 핵심 원칙 1: 동일 강좌 학점이 총 졸업학점(130)에 이중으로 합산되지 않도록 강좌 고유 ID 기준으로 1회만 합산합니다.
 * - 핵심 원칙 2: 교육학과 전공 대체인정과목(EDU2013 등 3학점)은 교육학과 전공학점(66/62)에 3학점으로 반영되면서,
 *                동시에 교직이론 이수 요건(6과목 / 12학점 상당) 충족에 인정됩니다.
 * - 핵심 원칙 3: 정확한 기준값과 취득값이 없는 항목은 퍼센트 진행률을 임의 계산하지 않고 '확인 필요'로 분류합니다.
 */
export function calculateGraduationAudit(
  rawProgress: StudentProgress,
  catalog: OfficialGraduationCatalog = OFFICIAL_GRADUATION_CATALOG
): GraduationAuditResult {
  const progress = migrateStudentProgress(rawProgress);
  const profile = progress.academicProfile!;
  const applicable = resolveApplicableRequirements(profile, catalog);
  const { cohortRule } = applicable;

  const completedCourses = (progress.courses || []).filter((c) => c.isCompleted !== false);
  const hasCourses = completedCourses.length > 0;

  // 1. 강좌 기반 학점 집계 (고유 강좌 1회 합산으로 총 졸업학점 이중 계산 원천 차단)
  let courseTotalCredits = 0;
  let courseEduMajorCredits = 0;
  let courseSubjectEduCredits = 0;
  let courseDoubleMajorCredits = 0;
  let courseCommonLiberalCredits = 0;
  let courseAcademicFoundationCredits = 0;
  let courseGeneralElectiveCredits = 0;
  let courseTeachingLiteracyCredits = 0;
  let coursePracticumCredits = 0;
  let courseVolunteeringCredits = 0;

  const substitutedCourses: EnrolledCourse[] = [];
  const directTheoryCourses: EnrolledCourse[] = [];
  const recognizedTheoryKeys = new Set<string>();

  for (const course of completedCourses) {
    const c = Math.max(0, Number(course.credits) || 0);
    // 총 졸업학점(130)에는 모든 이수 완료 강좌의 학점을 정확히 1번만 더함
    courseTotalCredits += c;

    const subItem = matchTeachingSubstitution(course);

    switch (course.category) {
      case "전공필수/선택 (교육학과)":
        courseEduMajorCredits += c;
        if (course.isSubjectEducationCourse) {
          courseSubjectEduCredits += c;
        }
        if (subItem) {
          substitutedCourses.push(course);
          recognizedTheoryKeys.add(subItem.substitutedTheoryKey);
        }
        break;
      case "복수전공":
        courseDoubleMajorCredits += c;
        break;
      case "교직이론":
        directTheoryCourses.push(course);
        recognizedTheoryKeys.add(
          subItem
            ? subItem.substitutedTheoryKey
            : `DIRECT_${normalizeCourseText(course.courseCode || course.courseTitle)}`
        );
        break;
      case "교직소양":
        courseTeachingLiteracyCredits += c;
        break;
      case "교육실습(학교현장실습)":
        coursePracticumCredits += c;
        break;
      case "교육봉사활동":
        courseVolunteeringCredits += c;
        break;
      case "공통교양(기초교양)":
        courseCommonLiberalCredits += c;
        break;
      case "학문기초(외국어영역)":
        courseAcademicFoundationCredits += c;
        break;
      case "일반교양/자유선택":
      default:
        courseGeneralElectiveCredits += c;
        break;
    }
  }

  // 기존 숫자 누적 입력(credits)과의 하위 호환:
  // 강좌가 1개 이상 등록된 경우에는 강좌 합산을 우선하되, 기존 숫자 입력값이 더 크다면(아직 개별 강좌로 다 옮기지 않은 경우) 보존 안내와 함께 큰 값을 반영 가능
  const legacyTotal = Number(progress.credits["졸업 이수 학점"]?.completedValue ?? 0);
  const legacyMajor = Number(progress.credits["전공 이수 학점"]?.completedValue ?? 0);
  const legacyLiberal = Number(progress.credits["교양 이수 학점"]?.completedValue ?? 0);
  const legacyDouble = Number(progress.credits["복수전공 이수 학점"]?.completedValue ?? 0);
  const legacyTeaching = Number(progress.credits["교직 이수 학점"]?.completedValue ?? 0);

  const eduMajorEarnedCredits = hasCourses
    ? Math.max(courseEduMajorCredits, legacyMajor)
    : legacyMajor;
  const doubleMajorEarnedCredits = hasCourses
    ? Math.max(courseDoubleMajorCredits, legacyDouble)
    : legacyDouble;
  const commonLiberalArtsEarnedCredits = hasCourses
    ? Math.max(courseCommonLiberalCredits, legacyLiberal)
    : legacyLiberal;
  const academicFoundationEarnedCredits = courseAcademicFoundationCredits;

  // 교직이론 대체인정 및 직접이수 평가
  const recognizedSubjectCount = recognizedTheoryKeys.size;
  const recognizedEquivalentCredits = Math.min(
    cohortRule.teachingTheoryCredits,
    recognizedSubjectCount * 2
  );
  const isTeachingTheoryFulfilled = hasCourses
    ? recognizedSubjectCount >= cohortRule.teachingTheoryMinSubjects
    : legacyTeaching >= cohortRule.teachingTotalCredits;

  const teachingTheoryAudit: TeachingTheoryAuditDetail = {
    substitutedCourses,
    directTheoryCourses,
    recognizedSubjectCount,
    recognizedEquivalentCredits,
    targetSubjects: cohortRule.teachingTheoryMinSubjects, // 6과목
    targetCredits: cohortRule.teachingTheoryCredits, // 12학점
    isFulfilled: isTeachingTheoryFulfilled,
  };

  // 학교현장실습 및 교육봉사 평가 (강좌에 ERC0024/0025/0026 또는 ERC0022/0023이 있으면 상태에도 자동 연동)
  const hasCourseCode = (code: string) =>
    completedCourses.some((c) => normalizeCourseText(c.courseCode) === code);

  const mergedPracticumState: SchoolPracticumState = {
    ...progress.practicumState!,
    practicum1Completed:
      progress.practicumState!.practicum1Completed || hasCourseCode("ERC0024"),
    practicum2Completed:
      progress.practicumState!.practicum2Completed || hasCourseCode("ERC0025"),
    practicum3Completed:
      progress.practicumState!.practicum3Completed || hasCourseCode("ERC0026"),
  };

  const practicumEvaluation = evaluateSchoolPracticum(
    mergedPracticumState,
    progress.teachingChecklist!
  );

  const loggedHours = (progress.volunteeringRecords || []).reduce(
    (sum, r) => sum + (Number(r.hours) || 0),
    0
  );
  const legacyVolHours = Number(progress.credits["교육봉사 시간"]?.completedValue ?? 0);
  const course1Completed =
    progress.volunteeringState!.eduVolunteering1Completed || hasCourseCode("ERC0022");
  const course2Completed =
    progress.volunteeringState!.eduVolunteering2Completed || hasCourseCode("ERC0023");

  const effectiveHours = Math.max(loggedHours, legacyVolHours);
  const isVolunteeringFulfilled =
    effectiveHours >= cohortRule.volunteeringHours &&
    course1Completed &&
    course2Completed;

  const volunteeringAudit = {
    course1Completed,
    course2Completed,
    loggedHours,
    effectiveHours,
    targetHours: cohortRule.volunteeringHours,
    confirmationSubmitted: Boolean(progress.volunteeringState!.confirmationSubmitted),
    isFulfilled: isVolunteeringFulfilled,
  };

  // 총 졸업학점(130): 강좌 기반 합산과 기존 수동 입력값 중 유효값 사용 (단, 강좌 합산 시 대체인정 과목은 절대 이중 합산하지 않음)
  const totalEarnedCredits = hasCourses
    ? Math.max(courseTotalCredits, legacyTotal)
    : legacyTotal;

  // 교직 총 인정학점 (교직이론 12 + 교직소양 6 + 교육실습(현장실습+교육봉사) 4~6 = 22학점 기준)
  const volunteeringRecognizedCredits =
    (course1Completed ? 1 : 0) + (course2Completed ? 1 : 0) || courseVolunteeringCredits;
  const practicumRecognizedCredits = Math.max(
    practicumEvaluation.earnedPracticumCredits,
    coursePracticumCredits
  );
  const computedTeachingCredits =
    recognizedEquivalentCredits +
    courseTeachingLiteracyCredits +
    practicumRecognizedCredits +
    Math.min(2, volunteeringRecognizedCredits);

  const effectiveTeachingCredits = hasCourses
    ? Math.max(computedTeachingCredits, legacyTeaching)
    : legacyTeaching;

  // 교직 검사/교육/평점 체크리스트 평가
  const tc = progress.teachingChecklist!;
  const personalityTestPassed =
    (tc.personalityTestPassCount || 0) >= cohortRule.personalityTestMinCount;
  const cprPassed = (tc.cprCompletedCount || 0) >= cohortRule.cprMinCount;
  const cprExternalWarning = (tc.cprExternalCount || 0) > 1;
  const genderSensitivityTarget = applicable.genderSensitivityRequiredCount;
  const genderSensitivityPassed =
    (tc.genderSensitivityCount || 0) >= genderSensitivityTarget;
  const majorGpaPassed =
    tc.majorGpa !== null && tc.majorGpa >= cohortRule.majorGpaMin;
  const teachingGpaPassed =
    tc.teachingGpa !== null && tc.teachingGpa >= cohortRule.teachingGpaMin;

  // 2. 대시보드 영역별 카드 생성 (확정된 수치만 진행률 계산)
  const makePercentage = (
    earned: number,
    target: number | null,
    reviewStatus: RuleReviewStatus
  ): number | null => {
    if (target === null || target <= 0 || reviewStatus === "needs_admin_review") {
      return null;
    }
    return Math.min(100, Math.round((earned / target) * 100));
  };

  const totalLiberalArtsEarned =
    commonLiberalArtsEarnedCredits + academicFoundationEarnedCredits;
  const liberalArtsTarget =
    applicable.commonLiberalArtsTargetCredits !== null
      ? applicable.commonLiberalArtsTargetCredits + applicable.academicFoundationTargetCredits
      : null;

  const categoryCards: CategoryAuditCard[] = [
    {
      id: "card-total",
      category: "졸업 이수 학점",
      title: "총 졸업 이수 학점",
      earnedValue: totalEarnedCredits,
      targetValue: cohortRule.totalGraduationCredits,
      targetDisplay: `${cohortRule.totalGraduationCredits}학점`,
      unit: "학점",
      percentage: makePercentage(
        totalEarnedCredits,
        cohortRule.totalGraduationCredits,
        "confirmed"
      ),
      status:
        totalEarnedCredits >= cohortRule.totalGraduationCredits
          ? "fulfilled"
          : "in_progress",
      statusBadgeText:
        totalEarnedCredits >= cohortRule.totalGraduationCredits
          ? "기준 충족"
          : `잔여 ${Math.max(0, cohortRule.totalGraduationCredits - totalEarnedCredits)}학점`,
      helperText:
        "이수 완료한 모든 강좌의 학점을 1회씩만 합산합니다 (교직이론 대체인정 전공과목 이중 합산 제외).",
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
    },
    {
      id: "card-major",
      category: "전공 이수 학점",
      title:
        profile.majorPlanType === "single"
          ? "교육학과 전공 학점 (단일전공 66학점)"
          : "교육학과 주전공 학점 (복수전공 62학점)",
      earnedValue: eduMajorEarnedCredits,
      targetValue: applicable.eduMajorTargetCredits,
      targetDisplay: `${applicable.eduMajorTargetCredits}학점 (사범대 일반 ${applicable.generalMajorReferenceCredits} + 대체 12)`,
      unit: "학점",
      percentage: makePercentage(
        eduMajorEarnedCredits,
        applicable.eduMajorTargetCredits,
        applicable.eduMajorTargetStatus
      ),
      status:
        applicable.eduMajorTargetStatus === "needs_admin_review"
          ? "needs_review"
          : eduMajorEarnedCredits >= applicable.eduMajorTargetCredits
          ? "fulfilled"
          : "in_progress",
      statusBadgeText:
        applicable.eduMajorTargetStatus === "needs_admin_review"
          ? "확인 필요 (2014학번 예외 확인)"
          : eduMajorEarnedCredits >= applicable.eduMajorTargetCredits
          ? "기준 충족"
          : `잔여 ${Math.max(0, applicable.eduMajorTargetCredits - eduMajorEarnedCredits)}학점`,
      helperText:
        "교육학과는 전공과목으로 교직이론(12학점)을 대체이수하므로 단일 66학점 / 복수 62학점을 이수해야 합니다.",
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
    },
    {
      id: "card-liberal",
      category: "교양 이수 학점",
      title: "공통교양 및 학문기초(외국어 6학점)",
      earnedValue: totalLiberalArtsEarned,
      targetValue: liberalArtsTarget,
      targetDisplay:
        liberalArtsTarget !== null
          ? `총 ${liberalArtsTarget}학점 (공통교양 ${applicable.commonLiberalArtsTargetCredits} + 학문기초 ${applicable.academicFoundationTargetCredits})`
          : `공통교양 ${applicable.commonLiberalArtsDisplay} + 학문기초 ${applicable.academicFoundationTargetCredits}학점`,
      unit: "학점",
      percentage: makePercentage(
        totalLiberalArtsEarned,
        liberalArtsTarget,
        applicable.commonLiberalArtsStatus
      ),
      status:
        applicable.commonLiberalArtsStatus === "needs_admin_review"
          ? "needs_review"
          : liberalArtsTarget !== null && totalLiberalArtsEarned >= liberalArtsTarget && academicFoundationEarnedCredits >= applicable.academicFoundationTargetCredits
          ? "fulfilled"
          : "in_progress",
      statusBadgeText:
        applicable.commonLiberalArtsStatus === "needs_admin_review"
          ? "요람 세부기준 확인 필요"
          : liberalArtsTarget !== null &&
            totalLiberalArtsEarned >= liberalArtsTarget &&
            academicFoundationEarnedCredits >= applicable.academicFoundationTargetCredits
          ? "기준 충족"
          : "이수 진행 중",
      helperText: `공통교양 ${commonLiberalArtsEarnedCredits}학점 + 학문기초(외국어영역) ${academicFoundationEarnedCredits}/${applicable.academicFoundationTargetCredits}학점`,
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
    },
  ];

  if (profile.majorPlanType !== "single") {
    categoryCards.push({
      id: "card-double-major",
      category: "복수전공 이수 학점",
      title: `복수전공 학점 (${profile.doubleMajorDepartment || "복수전공 학과"})`,
      earnedValue: doubleMajorEarnedCredits,
      targetValue: applicable.doubleMajorTargetCredits,
      targetDisplay:
        applicable.doubleMajorTargetCredits !== null
          ? `${applicable.doubleMajorTargetCredits}학점 (사범대 복수전공 기준)`
          : "확인 필요 (타 학과 기준 적용)",
      unit: "학점",
      percentage: makePercentage(
        doubleMajorEarnedCredits,
        applicable.doubleMajorTargetCredits,
        applicable.doubleMajorTargetStatus
      ),
      status:
        applicable.doubleMajorTargetStatus === "needs_admin_review"
          ? "needs_review"
          : applicable.doubleMajorTargetCredits !== null &&
            doubleMajorEarnedCredits >= applicable.doubleMajorTargetCredits
          ? "fulfilled"
          : "in_progress",
      statusBadgeText:
        applicable.doubleMajorTargetStatus === "needs_admin_review"
          ? "확인 필요 (타 학과 요람 확인)"
          : applicable.doubleMajorTargetCredits !== null &&
            doubleMajorEarnedCredits >= applicable.doubleMajorTargetCredits
          ? "기준 충족"
          : `잔여 ${Math.max(0, (applicable.doubleMajorTargetCredits || 0) - doubleMajorEarnedCredits)}학점`,
      helperText:
        profile.majorPlanType === "double_edu"
          ? "사범대학 내 복수전공 최저이수학점 50학점 기준입니다."
          : "비사범대(일반대학) 복수전공은 해당 대학(학과)의 복수전공 학점 기준을 따릅니다.",
      sourceUrl: cohortRule.sourceUrl,
      lastVerifiedAt: cohortRule.lastVerifiedAt,
    });
  }

  if (applicable.teachingRequired) {
    categoryCards.push(
      {
        id: "card-teaching",
        category: "교직 이수 학점",
        title: "교직과목 이수 현황 (교직이론 대체인정 포함)",
        earnedValue: effectiveTeachingCredits,
        targetValue: cohortRule.teachingTotalCredits,
        targetDisplay: `${cohortRule.teachingTotalCredits}학점 (이론12·소양6·실습4~6)`,
        unit: "학점",
        percentage: makePercentage(
          effectiveTeachingCredits,
          cohortRule.teachingTotalCredits,
          "confirmed"
        ),
        status:
          effectiveTeachingCredits >= cohortRule.teachingTotalCredits &&
          teachingTheoryAudit.isFulfilled
            ? "fulfilled"
            : "in_progress",
        statusBadgeText:
          effectiveTeachingCredits >= cohortRule.teachingTotalCredits &&
          teachingTheoryAudit.isFulfilled
            ? "기준 충족"
            : `교직이론 ${teachingTheoryAudit.recognizedSubjectCount}/${teachingTheoryAudit.targetSubjects}과목`,
        helperText: `교직이론 인정 ${teachingTheoryAudit.recognizedEquivalentCredits}/12학점(${teachingTheoryAudit.recognizedSubjectCount}과목) · 교직소양 ${courseTeachingLiteracyCredits}/6학점 · 실습/봉사 ${practicumRecognizedCredits + Math.min(2, volunteeringRecognizedCredits)}/4학점`,
        sourceUrl: cohortRule.sourceUrl,
        lastVerifiedAt: cohortRule.lastVerifiedAt,
      },
      {
        id: "card-volunteering",
        category: "교육봉사 시간",
        title: "교육봉사활동 (교육봉사1·2 및 60시간)",
        earnedValue: volunteeringAudit.effectiveHours,
        targetValue: cohortRule.volunteeringHours,
        targetDisplay: `${cohortRule.volunteeringHours}시간 (교육봉사1·2 각 30시간)`,
        unit: "시간",
        percentage: makePercentage(
          volunteeringAudit.effectiveHours,
          cohortRule.volunteeringHours,
          "confirmed"
        ),
        status: volunteeringAudit.isFulfilled ? "fulfilled" : "in_progress",
        statusBadgeText: volunteeringAudit.isFulfilled
          ? "60시간 및 과목 이수 완료"
          : `잔여 ${Math.max(0, cohortRule.volunteeringHours - volunteeringAudit.effectiveHours)}시간`,
        helperText: `교육봉사활동1(${volunteeringAudit.course1Completed ? "이수" : "미이수"}) · 교육봉사활동2(${volunteeringAudit.course2Completed ? "이수" : "미이수"}) · 확인서(${volunteeringAudit.confirmationSubmitted ? "제출완료" : "미제출"})`,
        sourceUrl: cohortRule.sourceUrl,
        lastVerifiedAt: cohortRule.lastVerifiedAt,
      },
      {
        id: "card-practicum",
        category: "교육실습 이수 여부",
        title: "학교현장실습 (참관·수업·종합실습)",
        earnedValue: practicumEvaluation.earnedPracticumCredits,
        targetValue: cohortRule.schoolPracticumMinCredits,
        targetDisplay: `${cohortRule.schoolPracticumMinCredits}학점 이상 (조합 ①·②·③ 중 택1)`,
        unit: "학점",
        percentage: makePercentage(
          practicumEvaluation.earnedPracticumCredits,
          cohortRule.schoolPracticumMinCredits,
          "confirmed"
        ),
        status: practicumEvaluation.isCombinationValid ? "fulfilled" : "in_progress",
        statusBadgeText: practicumEvaluation.combinationLabel,
        helperText: practicumEvaluation.sequenceErrorMessage || "학교현장실습Ⅰ(1학점)·Ⅱ(1학점)·Ⅲ(2학점) 조합 기준",
        sourceUrl: cohortRule.sourceUrl,
        lastVerifiedAt: cohortRule.lastVerifiedAt,
      }
    );
  }

  // 3. 미충족 항목(unmetItems) 및 확인 필요 항목(needsReviewItems) 요약 생성
  const unmetItems: GraduationAuditResult["unmetItems"] = [];
  const needsReviewItems: GraduationAuditResult["needsReviewItems"] = [];

  if (totalEarnedCredits < cohortRule.totalGraduationCredits) {
    unmetItems.push({
      id: "unmet-total-credits",
      title: "총 졸업 이수 학점 부족",
      detail: `기준 ${cohortRule.totalGraduationCredits}학점 중 현재 ${totalEarnedCredits}학점 취득 (${cohortRule.totalGraduationCredits - totalEarnedCredits}학점 추가 필요)`,
      category: "졸업 이수 학점",
    });
  }

  if (eduMajorEarnedCredits < applicable.eduMajorTargetCredits) {
    unmetItems.push({
      id: "unmet-edu-major",
      title: "교육학과 전공 이수 학점 부족",
      detail: `교육학과 ${profile.majorPlanType === "single" ? "단일전공" : "복수전공 주전공"} 기준 ${applicable.eduMajorTargetCredits}학점 중 현재 ${eduMajorEarnedCredits}학점 취득 (${applicable.eduMajorTargetCredits - eduMajorEarnedCredits}학점 추가 필요)`,
      category: "전공 이수 학점",
    });
  }

  if (hasCourses && academicFoundationEarnedCredits < applicable.academicFoundationTargetCredits) {
    unmetItems.push({
      id: "unmet-academic-foundation",
      title: "학문기초(외국어영역) 학점 부족",
      detail: `교육학과 학문기초(외국어영역) 기준 ${applicable.academicFoundationTargetCredits}학점 중 현재 ${academicFoundationEarnedCredits}학점 이수`,
      category: "교양 이수 학점",
    });
  }

  if (
    applicable.commonLiberalArtsTargetCredits !== null &&
    commonLiberalArtsEarnedCredits < applicable.commonLiberalArtsTargetCredits
  ) {
    unmetItems.push({
      id: "unmet-common-liberal",
      title: "공통교양(기초교양) 학점 부족",
      detail: `기준 ${applicable.commonLiberalArtsTargetCredits}학점 중 현재 ${commonLiberalArtsEarnedCredits}학점 이수`,
      category: "교양 이수 학점",
    });
  }

  if (
    profile.majorPlanType === "double_edu" &&
    applicable.doubleMajorTargetCredits !== null &&
    doubleMajorEarnedCredits < applicable.doubleMajorTargetCredits
  ) {
    unmetItems.push({
      id: "unmet-double-edu",
      title: `사범대 복수전공(${profile.doubleMajorDepartment || "타 학과"}) 학점 부족`,
      detail: `기준 ${applicable.doubleMajorTargetCredits}학점 중 현재 ${doubleMajorEarnedCredits}학점 이수`,
      category: "복수전공 이수 학점",
    });
  }

  if (applicable.teachingRequired) {
    if (!teachingTheoryAudit.isFulfilled) {
      unmetItems.push({
        id: "unmet-teaching-theory",
        title: "교직이론(또는 교육학과 전공 대체인정) 과목 부족",
        detail: `교직이론 6과목(12학점 상당) 이상 필요 — 현재 ${teachingTheoryAudit.recognizedSubjectCount}과목(${teachingTheoryAudit.recognizedEquivalentCredits}학점 상당) 인정`,
        category: "교직 이수 학점",
      });
    }

    if (hasCourses && courseTeachingLiteracyCredits < cohortRule.teachingLiteracyCredits) {
      unmetItems.push({
        id: "unmet-teaching-literacy",
        title: "교직소양 필수 과목 학점 부족",
        detail: `교직소양 필수 6학점(교직실무1·디지털교육1·특수교육학개론2·학교폭력예방2) 중 현재 ${courseTeachingLiteracyCredits}학점 이수`,
        category: "교직 이수 학점",
      });
    }

    if (!volunteeringAudit.isFulfilled) {
      unmetItems.push({
        id: "unmet-volunteering",
        title: "교육봉사활동 요건 미충족",
        detail: `교육봉사활동1·2 수강 및 총 60시간 이상 필요 (현재 ${volunteeringAudit.effectiveHours}/60시간, 봉사1: ${volunteeringAudit.course1Completed ? "완료" : "미완료"}, 봉사2: ${volunteeringAudit.course2Completed ? "완료" : "미완료"})`,
        category: "교육봉사 시간",
      });
    }

    if (!practicumEvaluation.isCombinationValid) {
      unmetItems.push({
        id: "unmet-practicum",
        title: "학교현장실습 이수 조합 미충족",
        detail:
          practicumEvaluation.sequenceErrorMessage ||
          "학교현장실습 ①(Ⅰ+Ⅱ, 2학점), ②(Ⅲ, 2학점), ③(Ⅰ+Ⅱ+Ⅲ, 4학점) 중 1개 이상의 조합을 완료해야 합니다.",
        category: "교육실습 이수 여부",
      });
    }

    if (!personalityTestPassed) {
      unmetItems.push({
        id: "unmet-personality-test",
        title: "교직 적성 및 인성검사 적격 횟수 부족",
        detail: `2013학년도 이후 입학자 기준 ${cohortRule.personalityTestMinCount}회 이상 적격 필요 (현재 ${tc.personalityTestPassCount || 0}회)`,
        category: "기타 졸업요건",
      });
    }

    if (!cprPassed) {
      unmetItems.push({
        id: "unmet-cpr",
        title: "응급처치 및 심폐소생술 실습 횟수 부족",
        detail: `기준 ${cohortRule.cprMinCount}회 이상 이수 필요 (현재 ${tc.cprCompletedCount || 0}회)`,
        category: "기타 졸업요건",
      });
    }

    if (!genderSensitivityPassed) {
      unmetItems.push({
        id: "unmet-gender-sensitivity",
        title: "성인지 교육 이수 횟수 부족",
        detail: `${profile.admissionYearNumber <= 2020 ? "2020학년도 이전 입학자 2회" : "2021학년도 이후 입학자 4회"} 이상 이수 필요 (현재 ${tc.genderSensitivityCount || 0}회)`,
        category: "기타 졸업요건",
      });
    }

    if (!majorGpaPassed) {
      unmetItems.push({
        id: "unmet-major-gpa",
        title: "전공 평점평균 기준 미달 또는 미입력",
        detail: `전공 평점평균 ${cohortRule.majorGpaMin} 이상 필요 (현재 ${tc.majorGpa !== null ? tc.majorGpa.toFixed(2) : "미입력"})`,
        category: "기타 졸업요건",
      });
    }

    if (!teachingGpaPassed) {
      unmetItems.push({
        id: "unmet-teaching-gpa",
        title: "교직 평점평균 기준 미달 또는 미입력",
        detail: `교직 평점평균 ${cohortRule.teachingGpaMin} 이상 필요 (현재 ${tc.teachingGpa !== null ? tc.teachingGpa.toFixed(2) : "미입력"})`,
        category: "기타 졸업요건",
      });
    }
  }

  if (!tc.graduationThesisCompleted) {
    unmetItems.push({
      id: "unmet-thesis",
      title: "교육학과 졸업논문 미완료",
      detail: "공식 가이드 기준 교육학과는 졸업논문 통과가 필수입니다 (학과 세부 지침 확인 필수).",
      category: "기타 졸업요건",
    });
  }

  // 확인 필요(needsReviewItems) 수집
  if (applicable.commonLiberalArtsStatus === "needs_admin_review") {
    needsReviewItems.push({
      id: "review-common-liberal",
      title: "공통교양(기초교양) 세부 영역 및 학점 확인 필요",
      detail: profile.isEnglishTrack
        ? "영어트랙 대상자는 공통교양 및 핵심교양 이수 기준이 일반 트랙과 다르므로 입학연도 교육과정 요람 확인이 필요합니다."
        : `${cohortRule.cohortLabel}의 공통교양 기준은 세부 구성에 따라 ${cohortRule.commonLiberalArtsRangeLabel}으로 상이하므로 입학연도 요람 확인이 필요합니다.`,
      sourceUrl: cohortRule.sourceUrl,
    });
  }

  if (applicable.eduMajorTargetStatus === "needs_admin_review") {
    needsReviewItems.push({
      id: "review-2014-major",
      title: "2014학년도 신입학생 교육학과 전공 학점 기준 확인 필요",
      detail:
        "공식 안내문 각주상 '2015학년도 입학생부터 대체이수한 교직학점(12학점)만큼 전공학점을 추가 이수'하도록 명시되어 있으므로 2014학번 적용 여부는 학사운영실 확인이 필요합니다.",
      sourceUrl: cohortRule.sourceUrl,
    });
  }

  if (profile.majorPlanType === "double_general") {
    needsReviewItems.push({
      id: "review-general-double-major",
      title: `비사범대 복수전공(${profile.doubleMajorDepartment || "타 학과"}) 최저이수학점 확인 필요`,
      detail:
        "공식 학업이수 가이드에 따라 비사범대 복수전공 학점은 해당 복수전공 대학(학과)의 교육과정 요람 기준을 확인해야 합니다.",
      sourceUrl: cohortRule.sourceUrl,
    });
  }

  if (profile.teachingTrackStatus === "double_teaching") {
    needsReviewItems.push({
      id: "review-double-teaching-basic-courses",
      title: `복수전공 교직(${profile.doubleMajorDepartment || "복수전공 학과"}) 기본이수과목 및 교과교육영역 확인 필요`,
      detail:
        "교직 복수전공자는 복수전공 학과의 표시과목 기본이수과목(21학점/7과목 이상) 및 교과교육영역 이수 기준을『교직과정이수가이드』에서 반드시 확인해야 합니다.",
      sourceUrl: cohortRule.sourceUrl,
    });
  }

  if (cprExternalWarning) {
    needsReviewItems.push({
      id: "review-cpr-external",
      title: "외부기관 응급처치 및 심폐소생술 인정 횟수 한도 확인 필요",
      detail:
        "공식 기준상 외부기관 이수 및 증빙서류 제출은 최대 1회까지만 인정됩니다. 교내 실습 이수 횟수를 확인해 주세요.",
      sourceUrl: cohortRule.sourceUrl,
    });
  }

  for (const course of completedCourses) {
    if (course.recognitionStatus === "needs_review") {
      needsReviewItems.push({
        id: `review-course-${course.id}`,
        title: `강좌 인정 여부 확인 필요: ${course.courseTitle}`,
        detail: `${course.yearTaken}년 ${course.semesterTaken} 이수 '${course.courseTitle}'(${course.credits}학점, ${course.category}) 과목의 전공/교직/교양 인정 여부를 학사운영실 또는 요람에서 확인해 주세요.`,
        sourceUrl: cohortRule.sourceUrl,
      });
    }
  }

  return {
    profile,
    applicable,
    usingCourseBasedCalculation: hasCourses,
    totalEarnedCredits,
    eduMajorEarnedCredits,
    subjectEducationEarnedCredits: courseSubjectEduCredits,
    doubleMajorEarnedCredits,
    commonLiberalArtsEarnedCredits,
    academicFoundationEarnedCredits,
    generalElectiveEarnedCredits: courseGeneralElectiveCredits,
    teachingLiteracyEarnedCredits: courseTeachingLiteracyCredits,
    teachingTheoryAudit,
    practicumEvaluation,
    volunteeringAudit,
    teachingChecklistAudit: {
      personalityTestPassed,
      personalityTestCurrent: tc.personalityTestPassCount || 0,
      personalityTestTarget: cohortRule.personalityTestMinCount,
      cprPassed,
      cprCurrent: tc.cprCompletedCount || 0,
      cprTarget: cohortRule.cprMinCount,
      cprExternalWarning,
      genderSensitivityPassed,
      genderSensitivityCurrent: tc.genderSensitivityCount || 0,
      genderSensitivityTarget,
      majorGpaPassed,
      majorGpaCurrent: tc.majorGpa,
      majorGpaTarget: cohortRule.majorGpaMin,
      teachingGpaPassed,
      teachingGpaCurrent: tc.teachingGpa,
      teachingGpaTarget: cohortRule.teachingGpaMin,
      thesisCompleted: Boolean(tc.graduationThesisCompleted),
      disqualificationGuidanceAcknowledged: Boolean(
        tc.disqualificationGuidanceAcknowledged
      ),
    },
    categoryCards,
    unmetItems,
    needsReviewItems,
  };
}

/**
 * 카탈로그에서 레거시 GraduationRequirement[] 목록을 생성합니다 (AppContext 하위 호환용).
 */
export function buildLegacyGraduationRequirementsFromCatalog(
  catalog: OfficialGraduationCatalog = OFFICIAL_GRADUATION_CATALOG
): GraduationRequirement[] {
  const defaultCohort = catalog.cohorts["2024-2025"];
  return [
    {
      id: "req-total",
      category: "졸업 이수 학점",
      title: "총 졸업 이수 학점 (신입학 기준)",
      unit: "학점",
      targetValue: defaultCohort.totalGraduationCredits,
      description:
        "2014~2026학년도 신입학 재학생 공통 최저 졸업이수학점 130학점입니다.",
      applicableCondition: "신입학 전 학번 공통 (130학점)",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
    {
      id: "req-major",
      category: "전공 이수 학점",
      title: "교육학과 전공 이수 학점 (단일 66 / 복수 주전공 62)",
      unit: "학점",
      targetValue: defaultCohort.eduSingleMajorCredits,
      description:
        "교육학과는 전공과목으로 교직이론(12학점)을 대체이수하므로 단일전공 66학점, 복수전공 이수 시 주전공 62학점을 이수해야 합니다.",
      applicableCondition: "교육학과 단일전공 66학점 / 복수전공(주전공) 62학점",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
    {
      id: "req-liberal",
      category: "교양 이수 학점",
      title: "공통교양 및 학문기초(외국어영역 6학점)",
      unit: "학점",
      targetValue:
        defaultCohort.commonLiberalArtsCredits !== null
          ? defaultCohort.commonLiberalArtsCredits + defaultCohort.academicFoundationCredits
          : null,
      description:
        "2021~2023학번 공통교양 29학점, 2024~2026학번 공통교양 28학점 + 교육학과 학문기초(외국어영역) 6학점 필수",
      applicableCondition: "입학 연도 및 영어트랙 여부에 따라 자동 적용",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
    {
      id: "req-double",
      category: "복수전공 이수 학점",
      title: "복수전공 이수 학점 (사범대 50학점 / 일반대 학과별 기준)",
      unit: "학점",
      targetValue: defaultCohort.eduDoublePartnerCredits,
      description:
        "사범대 내 복수전공 시 50학점이며, 비사범대 복수전공 시 해당 대학(학과)의 학점 기준에 따릅니다.",
      applicableCondition: "복수전공 이수자 해당",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
    {
      id: "req-teaching",
      category: "교직 이수 학점",
      title: "교직 과목 이수 학점 (교직이론 12 + 교직소양 6 + 교육실습 4~6)",
      unit: "학점",
      targetValue: defaultCohort.teachingTotalCredits,
      description:
        "교직 총 22학점 이상 (교육학과 전공과목으로 교직이론 6과목/12학점 대체인정 가능)",
      applicableCondition: "교원자격증 취득 예정자",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
    {
      id: "req-volunteering",
      category: "교육봉사 시간",
      title: "교육봉사활동 (교육봉사활동1·2 합산 60시간)",
      unit: "시간",
      targetValue: defaultCohort.volunteeringHours,
      description:
        "교육봉사활동1(ERC0022, 1학점/30시간) 및 교육봉사활동2(ERC0023, 1학점/30시간) 총 60시간 이상 이수 및 확인서 제출",
      applicableCondition: "교원자격증 취득 예정자",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
    {
      id: "req-practicum",
      category: "교육실습 이수 여부",
      title: "학교현장실습 이수 (Ⅰ+Ⅱ, Ⅲ, Ⅰ+Ⅱ+Ⅲ 중 택1, 최소 2학점)",
      unit: "여부",
      targetValue: 1,
      description:
        "학교현장실습Ⅰ(참관 1학점)·Ⅱ(수업 1학점)·Ⅲ(종합 2학점) 중 유효 조합 이수",
      applicableCondition: "교원자격증 취득 예정자",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
    {
      id: "req-etc",
      category: "기타 졸업요건",
      title: "교직 인성검사(2회+)·응급처치(2회+)·성인지교육(2/4회+)·평점·졸업논문",
      unit: "여부",
      targetValue: 1,
      description:
        "전공 평점 2.31+ / 교직 평점 2.75+, 인성검사 적격 2회+, 심폐소생술 2회+, 성인지 교육(2020 이전 2회+, 2021 이후 4회+), 교육학과 졸업논문",
      applicableCondition: "전 학번 및 교직 과정 이수자",
      officialGuideLabel: "동국대학교 사범대학·교육학과 학업이수 가이드",
      officialGuideUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      reviewStatus: "confirmed",
      version: catalog.version,
    },
  ];
}
