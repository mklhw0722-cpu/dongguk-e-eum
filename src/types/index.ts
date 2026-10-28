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
  isSampleData: boolean; // 반드시 '예시 데이터' 표시용
  officialUrl: string;
  viewCount: number;
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
