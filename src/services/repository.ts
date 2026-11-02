import {
  User,
  Notice,
  AlumniProfile,
  MentoringRequest,
  Conversation,
  Message,
  CommunityRoom,
  CommunityPost,
  GraduationRequirement,
  StudentProgress,
  ApprovalRequest,
  ReportItem,
  ConsultationRequest,
} from "@/types";
import {
  MOCK_USERS,
  MOCK_NOTICES,
  MOCK_ALUMNI_PROFILES,
  MOCK_MENTORING_REQUESTS,
  MOCK_CONVERSATIONS,
  MOCK_MESSAGES,
  MOCK_COMMUNITY_ROOMS,
  MOCK_COMMUNITY_POSTS,
  MOCK_GRADUATION_REQUIREMENTS,
  MOCK_STUDENT_PROGRESS,
  MOCK_APPROVAL_REQUESTS,
  MOCK_REPORTS,
  MOCK_CONSULTATIONS,
} from "@/data/mockData";

/**
 * 데이터 접근 계층 (Repository Layer)
 * - UI 컴포넌트가 Mock 데이터를 직접 참조하지 않고 이 서비스 계층을 통해 데이터를 읽고 변경하도록 분리했습니다.
 * - 추후 Firebase Firestore 또는 Supabase PostgreSQL 연결 시 이 파일의 함수 내부만 비동기 API 호출로 교체하면 됩니다.
 */

const STORAGE_KEY = "dongguk_e_eum_demo_state_v1";

export interface PlatformDataState {
  users: User[];
  notices: Notice[];
  alumniProfiles: AlumniProfile[];
  mentoringRequests: MentoringRequest[];
  conversations: Conversation[];
  messages: Message[];
  communityRooms: CommunityRoom[];
  communityPosts: CommunityPost[];
  graduationRequirements: GraduationRequirement[];
  studentProgress: StudentProgress;
  approvalRequests: ApprovalRequest[];
  reports: ReportItem[];
  consultations: ConsultationRequest[];
}

export function getInitialDataState(): PlatformDataState {
  return {
    users: MOCK_USERS,
    notices: MOCK_NOTICES,
    alumniProfiles: MOCK_ALUMNI_PROFILES,
    mentoringRequests: MOCK_MENTORING_REQUESTS,
    conversations: MOCK_CONVERSATIONS,
    messages: MOCK_MESSAGES,
    communityRooms: MOCK_COMMUNITY_ROOMS,
    communityPosts: MOCK_COMMUNITY_POSTS,
    graduationRequirements: MOCK_GRADUATION_REQUIREMENTS,
    studentProgress: MOCK_STUDENT_PROGRESS,
    approvalRequests: MOCK_APPROVAL_REQUESTS,
    reports: MOCK_REPORTS,
    consultations: MOCK_CONSULTATIONS,
  };
}

export const PlatformRepository = {
  loadState(): PlatformDataState {
    if (typeof window === "undefined") {
      return getInitialDataState();
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return getInitialDataState();
      const parsed = JSON.parse(saved) as Partial<PlatformDataState>;
      const initial = getInitialDataState();
      return {
        ...initial,
        ...parsed,
      };
    } catch {
      return getInitialDataState();
    }
  },

  saveState(state: PlatformDataState): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 로컬 스토리지 용량 제한 등 예외 무시
    }
  },

  resetState(): PlatformDataState {
    const initial = getInitialDataState();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return initial;
  },
};
