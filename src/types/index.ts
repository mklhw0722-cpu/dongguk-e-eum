// 동국e음(Dongguk e-eum) 핵심 데이터 모델 정의
// 추후 Firebase / Supabase 연동을 고려하여 엔티티 구조와 관계를 명확히 분리합니다.

export type UserRole = "student" | "alumni" | "professor" | "admin";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "supplement_requested" | "suspended";

export type CareerTrack =
  | "교직"
  | "교육행정"
  | "공공기관"
  | "기업 HRD"
  | "교육기업 및 에듀테크"
  | "대학원 및 연구"
  | "기타";

// 동국대학교 교육학과 신입학 재학생 전공 이수 형태 (교직 이수 여부와 분리)
export type MajorPlanType =
  | "single" // 단일전공 (교육학과 66학점)
  | "double_edu" // 복수전공 - 사범대학 내 타 학과 (교육학과 주전공 62학점 + 사범대 복수전공 50학점)
  | "double_general"; // 복수전공 - 일반대학(비사범대) 학과 (교육학과 주전공 62학점 + 타 학과 기준)

// 교직 이수 관련 상태 (전공 이수 형태와 독립적으로 선택 가능)
export type TeachingTrackStatus =
  | "educational_major" // 주전공 교직 이수 (교육학과 사범대 기본 과정)
  | "double_teaching" // 주전공 + 복수전공 교직 병행 (교직 복수전공)
  | "non_teaching"; // 교직 미이수 (일반 학사학위 취득 과정)

export type CohortBandId =
  | "2014-2015"
  | "2016-2020"
  | "2021-2022"
  | "2023"
  | "2024-2025"
  | "2026";

export type RuleReviewStatus = "confirmed" | "needs_admin_review";

export interface StudentAcademicProfile {
  admissionYearNumber: number; // 신입학 연도 (예: 2022, 2024)
  admissionYearLabel: string; // 예: "2022학년도 신입학 (22학번)"
  majorPlanType: MajorPlanType;
  hasDoubleMajor: boolean;
  doubleMajorDepartment: string; // 복수전공 학과명 (단일전공이면 "")
  teachingTrackStatus: TeachingTrackStatus;
  isEnglishTrack: boolean; // 영어트랙 대상자 여부 (공통교양/핵심교양 별도 기준 확인 필요 대상)
  specialConditionMemo?: string; // 기타 개인별 적용 조건 메모
  adminVerifiedSpecialCondition?: boolean; // 관리자 공식 확인 여부 (학생 임의 true 설정 불가)
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  role: UserRole;
  studentIdOrYear: string; // 예: "22학번", "16학번 졸업", "교육학과 교수"
  doubleMajor?: string;
  careerTrack?: CareerTrack;
  bio: string;
  avatarInitials: string;
  approvalStatus: ApprovalStatus;
  joinedAt: string;
  academicProfile?: StudentAcademicProfile;
}

export interface ApprovalRequest {
  id: string;
  applicantName: string;
  applicantEmail: string;
  requestedRole: UserRole;
  studentIdOrYear: string;
  verificationMethod: string; // 예: "학교 웹메일(@dgu.ac.kr) 확인 예정", "재학/졸업 확인 메모"
  note: string;
  status: ApprovalStatus;
  adminComment?: string;
  submittedAt: string;
}

export interface ConversationMember {
  conversationId: string;
  userId: string;
  joinedAt: string;
  unreadCount: number;
  isMuted?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isSystemMessage?: boolean;
  seq?: number; // 대화방 내 메시지 단조 증가 순번 (읽음 표시 계산용)
}

export interface Conversation {
  id: string;
  title: string;
  isGroup: boolean;
  categoryTag?: string; // 예: "1:1 대화", "진로 멘토링", "수업/연구 모임"
  memberIds: string[];
  members: ConversationMember[];
  lastMessageText: string;
  lastMessageAt: string;
  createdBy: string;
  msgSeq?: number; // 마지막 일반 메시지 순번
  readSeq?: Record<string, number>; // 참여자별 마지막 읽은 순번
  joinSeq?: Record<string, number>; // 참여자별 대화방 입장 시점 순번 (초대 이전 메시지 제외용)
}

export type NoticeCategory =
  | "학교 공지"
  | "교육학과 공지"
  | "학사 일정"
  | "장학 및 지원"
  | "교직 관련 안내";

export interface Notice {
  id: string;
  title: string;
  category: NoticeCategory;
  summary: string;
  content: string;
  authorName: string;
  createdAt: string;
  isPinned: boolean;
  isSampleData: boolean; // 예시 데이터 여부 (공식 자동 수집 공지나 실제 관리자 공지는 false)
  officialUrl: string;
  viewCount: number;
  // 공식 홈페이지 자동 연동 및 캘린더 확장 메타데이터
  articleSeq?: string;
  sourceId?: string;
  organization?: string;
  subCategoryTag?: string;
  hasAttachment?: boolean;
  isOfficialSynced?: boolean;
  isNew?: boolean;
  collectedAt?: string;
  lastVerifiedAt?: string;
  syncState?: "active" | "updated" | "unverified";
  scheduleStatus?: "confirmed" | "needs_review" | "none";
  eventStartDate?: string;
  eventEndDate?: string;
  extractedDateText?: string;
}

export interface NoticeSourceSyncStatus {
  sourceId: string;
  name: string;
  organization: string;
  boardUrl: string;
  defaultCategory: NoticeCategory;
  status: "ok" | "failed" | "cached";
  fetchedCount: number;
  lastSuccessAt: string | null;
  lastAttemptAt: string;
  errorMessage?: string;
}

export interface NoticeSyncMetadata {
  lastAttemptAt: string;
  lastSuccessAt: string;
  scheduleNote: string;
  sources: NoticeSourceSyncStatus[];
}

export interface PrivacySettings {
  showOrganization: boolean;
  showEmail: boolean;
  allowDirectChat: boolean;
}

export interface AlumniProfile {
  id: string;
  userId: string;
  displayName: string;
  graduationYear: number;
  admissionYear: number;
  doubleMajor: string; // 예: "심리학", "경영학", "단일전공(교육학)"
  careerTrack: CareerTrack;
  currentRoleTitle: string;
  organization?: string;
  bio: string;
  experienceSummary: string;
  mentoringAvailable: boolean;
  interests: string[];
  privacy: PrivacySettings;
}

export interface MentoringRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toAlumniProfileId: string;
  toAlumniName: string;
  topic: string;
  message: string;
  status: "대기중" | "수락됨" | "답변완료";
  createdAt: string;
}

export type CommunityRoomType = "career" | "double_major";

export interface CommunityRoom {
  id: string;
  name: string;
  type: CommunityRoomType;
  categoryName: string; // 진로 트랙명 또는 복수전공명
  description: string;
  memberIds: string[];
  relatedAlumniIds: string[];
  createdAt: string;
  isOfficial: boolean;
}

export type PostCategory = "질문/답변" | "복수전공 후기" | "진로 경험 공유" | "자유 정보";

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  roomId: string;
  roomName: string;
  category: PostCategory;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorBadge: string;
  createdAt: string;
  likes: number;
  comments: CommunityComment[];
}

export type RequirementCategory =
  | "졸업 이수 학점"
  | "전공 이수 학점"
  | "교양 이수 학점"
  | "복수전공 이수 학점"
  | "교직 이수 학점"
  | "교육봉사 시간"
  | "교육실습 이수 여부"
  | "기타 졸업요건";

export interface GraduationRequirement {
  id: string;
  category: RequirementCategory;
  title: string;
  unit: "학점" | "시간" | "여부";
  // 공식 자료 미확인 시 기준값을 임의로 넣지 않고 null(미설정)로 유지
  targetValue: number | null;
  description: string;
  applicableCondition: string; // 예: "입학 연도 및 다전공/교직 여부에 따라 상이"
  officialGuideLabel: string;
  officialGuideUrl: string;
  lastVerifiedAt?: string;
  reviewStatus?: RuleReviewStatus;
  version?: string;
}

export type CourseCategory =
  | "전공필수 (교육학과)"
  | "전공선택 (교육학과)"
  | "전공필수/선택 (교육학과)"
  | "복수전공"
  | "교직이론"
  | "교직소양"
  | "교육실습(학교현장실습)"
  | "교육봉사활동"
  | "공통교양(기초교양)"
  | "학문기초(외국어영역)"
  | "일반교양/자유선택";

export type CourseSemester = "1학기" | "여름학기" | "2학기" | "겨울학기";

export interface EnrolledCourse {
  id: string;
  courseCode?: string; // 예: "EDU2013", "ERC0013"
  courseTitle: string; // 예: "교육학개론"
  credits: number; // 예: 3
  yearTaken: number; // 예: 2024
  semesterTaken: CourseSemester;
  category: CourseCategory;
  isCompleted: boolean; // true: 이수 완료, false: 수강 중 / 예정
  recognitionStatus?: "confirmed" | "needs_review"; // 인정 여부 불확실 시 needs_review
  substitutedTeachingSubjectCode?: string; // 교육학과 전공으로 교직이론 대체인정 시 매핑된 교직이론 과목코드
  isSubjectEducationCourse?: boolean; // 교과교육영역(교과교육론, 교재연구및지도법, 논리및논술) 여부
  note?: string;
  createdAt: string;
}

export interface VolunteeringCourseState {
  eduVolunteering1Completed: boolean; // ERC0022 교육봉사활동1 (1학점 / 30시간)
  eduVolunteering1Semester?: string;
  eduVolunteering2Completed: boolean; // ERC0023 교육봉사활동2 (1학점 / 30시간)
  eduVolunteering2Semester?: string;
  confirmationSubmitted: boolean; // 교육봉사활동확인서 제출 여부
}

export interface SchoolPracticumState {
  practicum1Completed: boolean; // ERC0024 학교현장실습Ⅰ(참관실습, 1학점/2주, 3학기)
  practicum1Semester: string;
  practicum2Completed: boolean; // ERC0025 학교현장실습Ⅱ(수업실습, 1학점/2주, 5학기)
  practicum2Semester: string;
  practicum3Completed: boolean; // ERC0026 학교현장실습Ⅲ(종합실습, 2학점/4주, 7학기 이상)
  practicum3Semester: string;
  humanRightsEducationCompleted: boolean; // 실습 사전 요건: 온라인 인권존중 교육 이수 여부
}

export interface TeachingChecklistState {
  personalityTestPassCount: number; // 교직 적성 및 인성검사 적격 횟수 (기준: 2회 이상)
  cprCompletedCount: number; // 응급처치 및 심폐소생술 이수 횟수 (기준: 2회 이상)
  cprExternalCount?: number; // 외부기관 이수 증빙 횟수 (최대 1회 한도 인정)
  genderSensitivityCount: number; // 성인지 교육 이수 횟수 (2020 이전 입학: 2회+, 2021 이후 입학: 4회+)
  majorGpa: number | null; // 전공 평점평균 (기준: 2.31 이상)
  teachingGpa: number | null; // 교직 평점평균 (기준: 2.75 이상)
  graduationThesisCompleted: boolean; // (구) 교육학과 졸업논문 완료 여부 (호환용)
  graduationExamCompleted: boolean; // 교육학과 졸업시험 합격 여부 (최신)
  disqualificationGuidanceAcknowledged: boolean; // 교원자격 취득 결격사유 안내 확인 여부 (민감 건강·범죄 정보는 저장하지 않음)
  officialVerificationConfirmedByAdmin?: boolean; // 학교 공식 인정 확인 여부 (학생 임의 변경 불가)
}

export interface OfficialCohortRuleSet {
  cohortId: CohortBandId;
  cohortLabel: string; // 예: "2024~2025학년도 신입학생"
  admissionYears: number[]; // 예: [2024, 2025]
  curriculumYearLabel: string; // 예: "2024~2025학년도 교육과정"
  totalGraduationCredits: number; // 130
  commonLiberalArtsCredits: number | null; // 단일 확정치(29, 28) 또는 범위일 경우 null
  commonLiberalArtsRangeLabel: string; // "25~29학점", "29~31학점", "29학점", "28학점"
  commonLiberalArtsMinCredits: number; // 최소 기준 학점 (25, 29, 28)
  commonLiberalArtsStatus: RuleReviewStatus;
  academicFoundationCredits: number; // 교육학과 학문기초(외국어영역) 6학점
  academicFoundationStatus: RuleReviewStatus;
  generalSingleMajorCredits: number; // 사범대 일반 단일전공 기준 (54 또는 60)
  generalDoublePrimaryCredits: number; // 사범대 일반 복수전공 주전공 기준 (50)
  eduSingleMajorCredits: number; // 교육학과 별도 단일전공 기준 (66)
  eduDoublePrimaryCredits: number; // 교육학과 별도 복수전공 주전공 기준 (62)
  eduMajorRuleStatus: RuleReviewStatus; // 2015~2026 confirmed, 2014 needs_admin_review
  eduDoublePartnerCredits: number; // 사범대 복수전공 타 학과 기준 (50)
  generalDoublePartnerCredits: number | null; // 일반대 복수전공 타 학과 기준 (타 학과 기준에 따름 -> null)
  subjectEducationCredits: number; // 교과교육영역 9학점 (교과교육론 3 + 교재연구및지도법 3 + 논리및논술 3)
  teachingTotalCredits: number; // 교직 총 22학점
  teachingTheoryCredits: number; // 교직이론 12학점
  teachingTheoryMinSubjects: number; // 교직이론 6과목 이상
  teachingLiteracyCredits: number; // 교직소양 6학점 (4과목)
  teachingPracticumMinCredits: number; // 교육실습 영역 최소 4학점 (학교현장실습 2 + 교육봉사 2)
  teachingPracticumMaxCredits: number; // 교육실습 영역 최대 6학점 (학교현장실습 4 + 교육봉사 2)
  volunteeringCredits: number; // 교육봉사활동 2학점
  volunteeringHours: number; // 교육봉사활동 60시간
  schoolPracticumMinCredits: number; // 학교현장실습 최소 2학점
  personalityTestMinCount: number; // 교직 적성 및 인성검사 2회 이상 적격
  cprMinCount: number; // 응급처치 및 심폐소생술 2회 이상 이수
  genderSensitivityMinCount: number; // 성인지 교육 (2020 이전: 2회, 2021 이후: 4회)
  majorGpaMin: number; // 전공 평점평균 2.31 이상
  teachingGpaMin: number; // 교직 평점평균 2.75 이상
  majorRequiredCredits: number; // 전공필수: 36학점 필수
  graduationThesisRequired: boolean; // (구) 졸업논문: 교육학과 필수 (호환용)
  graduationExamRequired: boolean; // 교육학과 졸업시험: 필수
  englishLectureExempt: boolean; // 사범대학 영어강의 적용 제외
  sourceUrl: string; // https://edu.dongguk.edu/page/619
  lastVerifiedAt: string; // 예: "2026-10-28"
  reviewStatus: RuleReviewStatus;
  version: string; // 예: "2026.10-edu-page619-v1"
  adminMemo: string;
}

export interface OfficialGraduationCatalog {
  version: string;
  sourceUrl: string;
  sourceTitle: string;
  lastVerifiedAt: string;
  updatedByAdminName?: string;
  cohorts: Record<CohortBandId, OfficialCohortRuleSet>;
}

export interface StudentChecklistItem {
  id: string;
  label: string;
  category: RequirementCategory;
  completed: boolean;
  memo: string;
}

export interface VolunteeringRecord {
  id: string;
  institutionName: string;
  activityDate: string;
  hours: number;
  verifiedBySelf: boolean;
  note: string;
}

export interface StudentProgress {
  userId: string;
  admissionYear: string;
  majorType: "단일전공(심화)" | "복수전공 이수" | "교직 이수 병행";
  doubleMajorName: string;
  isTeacherTrack: boolean;
  // 학생이 직접 자가점검용으로 입력한 이수 수치 및 본인이 학사공지에서 확인해 직접 입력한 목표 기준값(선택)
  credits: {
    [key in RequirementCategory]?: {
      completedValue: number;
      userCustomTarget: number | null; // 초기값은 null(기준 미설정)
      isCompletedBoolean?: boolean;
      lastUpdated: string;
    };
  };
  volunteeringRecords: VolunteeringRecord[];
  checklist: StudentChecklistItem[];
  // 개선된 공식 졸업요건 관리 시스템 확장 필드 (기존 데이터와 100% 하위 호환)
  academicProfile?: StudentAcademicProfile;
  courses?: EnrolledCourse[];
  volunteeringState?: VolunteeringCourseState;
  practicumState?: SchoolPracticumState;
  teachingChecklist?: TeachingChecklistState;
  isProfileComplete?: boolean;
  officialAdminVerified?: boolean;
}

export interface ReportItem {
  id: string;
  targetType: "게시글" | "채팅" | "사용자";
  targetTitle: string;
  reporterName: string;
  reason: string;
  status: "접수됨" | "처리완료";
  createdAt: string;
}
