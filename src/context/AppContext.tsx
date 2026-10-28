"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import {
  User,
  UserRole,
  Notice,
  NoticeCategory,
  NoticeSyncMetadata,
  AlumniProfile,
  MentoringRequest,
  Conversation,
  Message,
  CommunityRoom,
  CommunityPost,
  PostCategory,
  GraduationRequirement,
  StudentProgress,
  ApprovalRequest,
  ApprovalStatus,
  ReportItem,
  RequirementCategory,
  CareerTrack,
  OfficialGraduationCatalog,
  StudentAcademicProfile,
  EnrolledCourse,
  VolunteeringCourseState,
  SchoolPracticumState,
  TeachingChecklistState,
} from "@/types";
import {
  OFFICIAL_GRADUATION_CATALOG,
  migrateStudentProgress,
  deriveLegacyFieldsFromAcademicProfile,
  matchTeachingSubstitution,
  sortCoursesBySemester,
  buildLegacyGraduationRequirementsFromCatalog,
} from "@/lib/graduationCurriculum";
import {
  PlatformRepository,
  getInitialDataState,
  PlatformDataState,
} from "@/services/repository";
import {
  FirebaseWebConfig,
  getActiveFirebaseConfig,
  saveFirebaseConfigToLocal,
  clearFirebaseConfigFromLocal,
  subscribeToCommunityPosts,
  createPostInFirestore,
  deletePostInFirestore,
  addCommentInFirestore,
  incrementLikeInFirestore,
  UserProfileDoc,
  registerWithEmailAndPassword,
  loginWithEmailAndPassword,
  logoutUser,
  sendPasswordReset,
  subscribeToAuthStatus,
  subscribeToAllUsersForAdmin,
  updateUserApprovalStatusByAdmin,
  claimInitialAdminRole,
  FirestoreChatRoom,
  FirestoreChatMessage,
  subscribeToUserChats,
  getOrCreateDirectChatInFirestore,
  createGroupChatInFirestore,
  sendChatMessageInFirestore,
  markChatReadInFirestore,
  inviteUsersToChatInFirestore,
  leaveChatInFirestore,
  searchApprovedUsersInFirestore,
  subscribeToApprovedUsers,
  PublicChatUser,
  getFirebaseInstances,
  syncApprovedUsersToPublicProfiles,
  updateUserDisplayName,
  subscribeToNoticesInFirestore,
  upsertNoticeInFirestore,
  syncOfficialNoticesToFirestore,
  subscribeToGraduationCatalogInFirestore,
  saveGraduationCatalogInFirestore,
  subscribeToStudentGraduationRecordInFirestore,
  saveStudentGraduationRecordInFirestore,
  updateUserAcademicProfileInFirestore,
} from "@/lib/firebase";
import { unreadCountForUser, effectiveReadSeq } from "@/lib/chatReadReceipts";
import officialNoticesJson from "@/data/officialNotices.json";
import { extractScheduleFromTitle } from "@/lib/officialNoticeParser";
import { User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  AccessGateState,
  ProfileFetchStatus,
  resolveAccessGate,
  canAccessInternal,
  isGateLoading,
} from "@/lib/accessGate";

/** 가입 직후 회원 문서 생성이 늦어지는 경우를 기다려 주는 시간 (이 시간이 지나도 없으면 '문서 누락'으로 차단) */
const PROFILE_MISSING_GRACE_MS = 8000;

interface AppContextValue extends PlatformDataState {
  currentUser: User;
  currentRole: UserRole;
  isDarkMode: boolean;
  switchRole: (role: UserRole) => void;
  toggleDarkMode: () => void;
  resetDemoData: () => void;

  // Firebase 실시간 상태
  isFirestoreConnected: boolean;
  firebaseProjectId: string | null;
  firestoreError: string | null;
  applyFirebaseConfig: (config: FirebaseWebConfig) => void;
  disconnectFirebaseConfig: () => void;

  // Firebase Authentication 상태 및 접근 제어
  rawFirebaseUser: FirebaseUser | null;
  authUserProfile: UserProfileDoc | null;
  isAuthLoading: boolean; // 로그인 확인 또는 회원 문서 조회 중이면 true
  isRealAuthActive: boolean;
  isAccessAllowed: boolean; // 로그인 + 회원 문서 approved 일 때만 true
  accessGate: AccessGateState; // 비로그인 / 승인대기 / 승인완료 등 현재 사용자 상태

  // 실제 인증 액션
  handleSignUp: (params: {
    email: string;
    password: string;
    name: string;
    studentIdOrYear: string;
    role: UserRole;
    verificationNote?: string;
    academicProfile?: StudentAcademicProfile;
    doubleMajor?: string;
  }) => Promise<void>;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleResetPassword: (email: string) => Promise<void>;
  handleClaimInitialAdmin: () => Promise<void>;
  handleUpdateUserName: (newName: string) => Promise<void>;

  // 실제 관리자 회원 승인 액션
  realUsersForAdmin: UserProfileDoc[];
  handleAdminUpdateApproval: (
    targetUid: string,
    status: ApprovalStatus,
    adminComment?: string,
    role?: UserRole
  ) => Promise<void>;

  // 기능 A. 대화창 액션
  sendMessage: (conversationId: string, content: string) => Promise<void> | void;
  markConversationRead: (conversationId: string, upToSeq?: number) => Promise<void> | void;
  startOrOpenDirectChat: (targetUserId: string, categoryTag?: string) => Promise<string> | string;
  createGroupConversation: (title: string, memberIds: string[], categoryTag?: string) => Promise<string> | string;
  firestoreRooms: FirestoreChatRoom[];
  approvedMembers: PublicChatUser[];
  approvedMembersLoading: boolean;
  approvedMembersError: string | null;
  refreshApprovedMembers: () => Promise<PublicChatUser[]>;
  inviteUsersToChat: (chatId: string, users: (PublicChatUser | UserProfileDoc)[]) => Promise<void>;
  leaveChat: (chatId: string) => Promise<void>;

  // 기능 B. 공지사항 액션 (공식 홈페이지 자동 연동 + 관리자 공지 작성 + 캘린더 일정 확정)
  noticeSyncMeta: NoticeSyncMetadata;
  createNotice: (payload: {
    title: string;
    category: NoticeCategory;
    summary: string;
    content: string;
    isPinned: boolean;
    officialUrl: string;
    eventStartDate?: string;
    eventEndDate?: string;
  }) => Promise<void> | void;
  syncOfficialNoticesToCloud: () => Promise<number>;
  updateNoticeSchedule: (
    noticeId: string,
    schedule: {
      scheduleStatus: "confirmed" | "needs_review" | "none";
      eventStartDate?: string;
      eventEndDate?: string;
    }
  ) => Promise<void>;

  // 기능 C. 졸업생 연결 액션
  createMentoringRequest: (
    toAlumniProfileId: string,
    topic: string,
    message: string
  ) => void;
  updateMentoringStatus: (
    requestId: string,
    status: "대기중" | "수락됨" | "답변완료"
  ) => void;
  upsertAlumniProfile: (profile: Omit<AlumniProfile, "id" | "userId">) => void;

  // 기능 D. 졸업요건 자가점검 및 공식 학업이수 기준 관리 액션
  graduationCatalog: OfficialGraduationCatalog;
  updateGraduationCatalogByAdmin: (catalog: OfficialGraduationCatalog) => Promise<void>;
  updateStudentAcademicProfile: (profile: StudentAcademicProfile) => Promise<void>;
  addEnrolledCourse: (course: Omit<EnrolledCourse, "id" | "createdAt">) => void;
  updateEnrolledCourse: (courseId: string, patch: Partial<EnrolledCourse>) => void;
  removeEnrolledCourse: (courseId: string) => void;
  updateVolunteeringCourseState: (patch: Partial<VolunteeringCourseState>) => void;
  updateSchoolPracticumState: (patch: Partial<SchoolPracticumState>) => void;
  updateTeachingChecklistState: (patch: Partial<TeachingChecklistState>) => void;
  updateStudentCredit: (
    category: RequirementCategory,
    completedValue: number,
    userCustomTarget: number | null,
    isCompletedBoolean?: boolean
  ) => void;
  updateStudentProfileMeta: (
    admissionYear: string,
    majorType: StudentProgress["majorType"],
    doubleMajorName: string,
    isTeacherTrack: boolean
  ) => void;
  addVolunteeringRecord: (
    institutionName: string,
    activityDate: string,
    hours: number,
    note: string
  ) => void;
  removeVolunteeringRecord: (id: string) => void;
  toggleChecklistItem: (id: string) => void;
  addChecklistItem: (
    label: string,
    category: RequirementCategory,
    memo: string
  ) => void;

  // 기능 E. 진로 및 복수전공 공유방 액션
  toggleJoinRoom: (roomId: string) => void;
  createCommunityRoom: (payload: {
    name: string;
    type: "career" | "double_major";
    categoryName: string;
    description: string;
  }) => void;
  updateCommunityRoomName: (roomId: string, name: string, categoryName: string, description: string) => void;
  createCommunityPost: (payload: {
    roomId: string;
    category: PostCategory;
    title: string;
    content: string;
  }) => void;
  deleteCommunityPost: (postId: string) => void;
  addCommunityComment: (postId: string, content: string) => void;
  likeCommunityPost: (postId: string) => void;

  // 기능 7 & 관리자 액션
  submitApprovalRequest: (payload: {
    applicantName: string;
    applicantEmail: string;
    requestedRole: UserRole;
    studentIdOrYear: string;
    verificationMethod: string;
    note: string;
  }) => void;
  updateApprovalStatus: (
    requestId: string,
    status: ApprovalStatus,
    adminComment?: string
  ) => void;
  updateUserRoleByAdmin: (userId: string, newRole: UserRole) => void;
  resolveReport: (reportId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const ROLE_DEFAULT_USER_ID: Record<UserRole, string> = {
  student: "u-student-1",
  alumni: "u-alumni-1",
  professor: "u-prof-1",
  admin: "u-admin-1",
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlatformDataState>(getInitialDataState);
  const [currentRole, setCurrentRole] = useState<UserRole>("student");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Firebase 실시간 상태
  const [firebaseVersionTick, setFirebaseVersionTick] = useState(0);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const [firebaseProjectId, setFirebaseProjectId] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Firebase Authentication 상태
  const [rawFirebaseUser, setRawFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authUserProfile, setAuthUserProfile] = useState<UserProfileDoc | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileFetchStatus>("idle");
  const profileMissingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [realUsersForAdmin, setRealUsersForAdmin] = useState<UserProfileDoc[]>([]);
  const [graduationCatalog, setGraduationCatalog] = useState<OfficialGraduationCatalog>(
    OFFICIAL_GRADUATION_CATALOG
  );

  useEffect(() => {
    const loaded = PlatformRepository.loadState();
    setState({
      ...loaded,
      studentProgress: migrateStudentProgress(loaded.studentProgress),
    });

    if (typeof window !== "undefined") {
      const savedCatalogRaw = window.localStorage.getItem(
        "dongguk_e_eum_graduation_catalog_v1"
      );
      if (savedCatalogRaw) {
        try {
          const parsedCatalog = JSON.parse(savedCatalogRaw) as OfficialGraduationCatalog;
          if (parsedCatalog && parsedCatalog.cohorts) {
            setGraduationCatalog(parsedCatalog);
          }
        } catch {
          // ignore
        }
      }
    }

    // Firebase config is now statically fixed to Dongguk E-Eum spark project

    setHydrated(true);
  }, []);

  // Firebase Auth & 프로필 실시간 감지
  useEffect(() => {
    if (!hydrated) return;

    const clearMissingTimer = () => {
      if (profileMissingTimerRef.current) {
        clearTimeout(profileMissingTimerRef.current);
        profileMissingTimerRef.current = null;
      }
    };

    const activeConfig = getActiveFirebaseConfig();
    setFirebaseProjectId(activeConfig.projectId);
    setAuthResolved(false);
    setProfileStatus("idle");

    const unsubAuth = subscribeToAuthStatus({
      // 1단계: 로그인 여부 확인 (회원 문서 조회보다 항상 먼저)
      onAuthUserChange: (rawUser) => {
        clearMissingTimer();
        setRawFirebaseUser(rawUser);
        setAuthUserProfile(null);
        setProfileStatus(rawUser ? "loading" : "idle");
        setAuthResolved(true);
        setIsFirestoreConnected(true);
      },
      // 2단계: 로그인한 사용자의 회원 문서 확인
      onProfileUpdate: (profile) => {
        if (profile) {
          clearMissingTimer();
          setAuthUserProfile(profile);
          setProfileStatus("loaded");
          setCurrentRole(profile.role);
          return;
        }
        // 회원 문서가 없음: 가입 직후 생성 지연일 수 있으므로 잠시 로딩을 유지한 뒤 '문서 누락'으로 차단
        setAuthUserProfile(null);
        setProfileStatus("loading");
        if (!profileMissingTimerRef.current) {
          profileMissingTimerRef.current = setTimeout(() => {
            profileMissingTimerRef.current = null;
            setProfileStatus((prev) => (prev === "loading" ? "missing" : prev));
          }, PROFILE_MISSING_GRACE_MS);
        }
      },
      onProfileError: (err, rawUser) => {
        clearMissingTimer();
        setFirestoreError(err);
        setAuthUserProfile(null);
        setRawFirebaseUser(rawUser);
        // 조회 실패 시 절대 자동 승인하지 않고 오류 상태로 차단
        setProfileStatus(rawUser ? "error" : "idle");
        setAuthResolved(true);
      },
    });

    if (!unsubAuth) {
      // Firebase 초기화 실패: 비로그인 상태로 간주 (내부 콘텐츠 차단)
      setFirestoreError("Firebase 초기화에 실패했습니다. 잠시 후 새로고침해 주세요.");
      setRawFirebaseUser(null);
      setAuthUserProfile(null);
      setAuthResolved(true);
    }

    return () => {
      clearMissingTimer();
      if (unsubAuth) unsubAuth();
    };
  }, [hydrated, firebaseVersionTick]);

  // 관리자용 실시간 회원 가입 신청 목록 감지 (관리자 계정일 때만 활성화)
  useEffect(() => {
    if (!authUserProfile || authUserProfile.role !== "admin" || authUserProfile.approvalStatus !== "approved") {
      setRealUsersForAdmin([]);
      return;
    }

    const unsubUsers = subscribeToAllUsersForAdmin(
      (list) => {
        setRealUsersForAdmin(list);
        // 과거 승인자를 포함하여 모든 승인 회원을 publicProfiles에 자동 동기화
        syncApprovedUsersToPublicProfiles(list).catch((e) =>
          console.warn("공개 프로필 백그라운드 동기화 경고:", e)
        );
      },
      (err) => {
        console.warn(err);
      }
    );

    return () => {
      if (unsubUsers) unsubUsers();
    };
  }, [authUserProfile]);

  // Firestore 공유방 실시간 구독
  useEffect(() => {
    if (!hydrated) return;

    const activeConfig = getActiveFirebaseConfig();
    if (!activeConfig) return;

    // 승인된 정회원만 Firestore 실시간 글 목록을 구독하도록 강제 (비로그인, 미승인, 거절 회원 전면 차단)
    if (!rawFirebaseUser || !authUserProfile || authUserProfile.approvalStatus !== "approved") {
      return;
    }

    const unsubscribe = subscribeToCommunityPosts(
      (cloudPosts) => {
        setState((prev) => ({
          ...prev,
          communityPosts: cloudPosts,
        }));
      },
      (errMessage) => {
        // 미승인 회원의 보안 차단인 경우는 정상 동작이므로 불필요한 경고 생략
        if (!rawFirebaseUser || authUserProfile?.approvalStatus === "approved") {
          setFirestoreError(errMessage);
        }
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [hydrated, firebaseVersionTick, rawFirebaseUser, authUserProfile]);

  // Firestore 실시간 대화방 목록 및 승인 회원 상태
  const [firestoreRooms, setFirestoreRooms] = useState<FirestoreChatRoom[]>([]);
  const [firestoreNotices, setFirestoreNotices] = useState<Notice[]>([]);
  const [approvedMembersRaw, setApprovedMembersRaw] = useState<PublicChatUser[]>([]);
  const [approvedMembersLoading, setApprovedMembersLoading] = useState(false);
  const [approvedMembersError, setApprovedMembersError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const activeConfig = getActiveFirebaseConfig();
    if (!activeConfig) return;

    if (!rawFirebaseUser || !authUserProfile || authUserProfile.approvalStatus !== "approved") {
      setFirestoreRooms([]);
      setFirestoreNotices([]);
      setApprovedMembersRaw([]);
      setApprovedMembersLoading(false);
      setApprovedMembersError(null);
      return;
    }

    setApprovedMembersLoading(true);
    setApprovedMembersError(null);

    // 1. 대화방 목록 실시간 구독
    const currentUid = authUserProfile.id || (rawFirebaseUser ? rawFirebaseUser.uid : "");
    const unsubChats = subscribeToUserChats(
      currentUid,
      (rooms) => {
        setFirestoreRooms(rooms);
      },
      (err) => {
        console.warn("대화방 구독 안내:", err);
      }
    );

    // 2. 승인된 정회원 실시간 목록 구독 (관리자가 승인/거절 시 즉시 자동 반영)
    const unsubApprovedUsers = subscribeToApprovedUsers(
      currentUid,
      (users) => {
        setApprovedMembersRaw(users);
        setApprovedMembersLoading(false);
        setApprovedMembersError(null);
      },
      (errMessage) => {
        setApprovedMembersLoading(false);
        setApprovedMembersError(errMessage);
      }
    );

    // 3. 공식 연동 공지 및 학과 관리자 공지 실시간 구독 (승인된 회원만 조회 가능)
    const unsubNotices = subscribeToNoticesInFirestore(
      (cloudNotices) => {
        setFirestoreNotices(cloudNotices);
      },
      () => {
        // 규칙 게시 전이거나 초기 빈 상태인 경우 정적 수집 데이터 및 로컬 상태로 안전하게 폴백
      }
    );

    // 4. 공식 공통 졸업요건 카탈로그(graduationRulesCatalog/current) 실시간 구독
    const unsubGradCatalog = subscribeToGraduationCatalogInFirestore(
      (cloudCatalog) => {
        if (cloudCatalog && cloudCatalog.cohorts) {
          setGraduationCatalog(cloudCatalog);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              "dongguk_e_eum_graduation_catalog_v1",
              JSON.stringify(cloudCatalog)
            );
          }
        }
      },
      () => {
        // 초기 문서 미생성 시 기본 공식 카탈로그(page/619) 유지
      }
    );

    // 5. 학생 개인별 졸업요건·이수 강좌 기록(graduationRecords/{uid}) 실시간 구독
    const unsubGradRecord = subscribeToStudentGraduationRecordInFirestore(
      currentUid,
      (cloudRecord) => {
        if (cloudRecord) {
          setState((prev) => ({
            ...prev,
            studentProgress: migrateStudentProgress(
              {
                ...prev.studentProgress,
                ...cloudRecord,
              },
              authUserProfile
            ),
          }));
        } else {
          // 클라우드 기록이 아직 없다면 가입 시 입력한 프로필(authUserProfile)과 기존 로컬 기록을 합쳐 마이그레이션
          setState((prev) => ({
            ...prev,
            studentProgress: migrateStudentProgress(prev.studentProgress, authUserProfile),
          }));
        }
      },
      () => {
        // 보안 규칙 적용 전이거나 초기 빈 상태인 경우 로컬 상태 유지
      }
    );

    return () => {
      if (unsubChats) unsubChats();
      if (unsubApprovedUsers) unsubApprovedUsers();
      if (unsubNotices) unsubNotices();
      if (unsubGradCatalog) unsubGradCatalog();
      if (unsubGradRecord) unsubGradRecord();
    };
  }, [hydrated, firebaseVersionTick, rawFirebaseUser, authUserProfile]);

  // 승인된 정회원 통합 목록 (Firestore 구독 결과 + 관리자의 경우 실시간 관리자 회원 목록의 승인자 자동 병합)
  const approvedMembers = useMemo(() => {
    const map = new Map<string, PublicChatUser>();
    const currentUid = authUserProfile?.id || (rawFirebaseUser ? rawFirebaseUser.uid : "");

    // 1. 일반 승인 목록 쿼리 결과 추가
    approvedMembersRaw.forEach((u) => {
      const uid = u.id || u.uid;
      if (uid && (!currentUid || uid !== currentUid)) {
        map.set(uid, { ...u, id: uid, uid });
      }
    });

    // 2. 관리자 계정인 경우, realUsersForAdmin에서 승인 완료된 회원을 즉시 병합 (과거 승인자 누락 방지)
    if (authUserProfile?.role === "admin" && Array.isArray(realUsersForAdmin)) {
      realUsersForAdmin.forEach((u) => {
        const uStatus = (u.approvalStatus || "").toString().trim().toLowerCase();
        const uid = u.id || (u as any).uid;
        if (uStatus === "approved" && uid && (!currentUid || uid !== currentUid)) {
          if (!map.has(uid)) {
            map.set(uid, {
              id: uid,
              uid,
              name: u.name || "구성원",
              role: u.role || "student",
              avatarInitials:
                u.avatarInitials || (u.name ? u.name.slice(0, 2) : "학"),
              approvalStatus: "approved",
              careerTrack: u.careerTrack || "",
              doubleMajor: u.doubleMajor || "",
              bio: u.bio || "",
            });
          }
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  }, [approvedMembersRaw, realUsersForAdmin, authUserProfile, rawFirebaseUser]);

  const refreshApprovedMembers = async () => {
    const currentUid = authUserProfile?.id || (rawFirebaseUser ? rawFirebaseUser.uid : "");
    if (currentUid) {
      try {
        setApprovedMembersLoading(true);
        const users = await searchApprovedUsersInFirestore(currentUid);
        setApprovedMembersRaw(users);
        setApprovedMembersError(null);
        return users;
      } catch (err: any) {
        setApprovedMembersError(err.message);
        return [];
      } finally {
        setApprovedMembersLoading(false);
      }
    }
    return [];
  };

  useEffect(() => {
    if (hydrated) {
      PlatformRepository.saveState(state);
    }
  }, [state, hydrated]);

  // 항상 라이트모드 유지: 브라우저나 시스템 설정에 다크모드가 켜져 있어도 dark 클래스를 제거하여 항상 라이트모드로 고정
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // 실제 Firebase Auth 로그인 여부
  const isRealAuthActive = Boolean(rawFirebaseUser);

  // 폐쇄형 학과 플랫폼 접근 제어: 로그인 → 회원 문서 → 승인 상태 순서로 판정
  const accessGate: AccessGateState = resolveAccessGate({
    authResolved: hydrated && authResolved,
    firebaseUser: rawFirebaseUser,
    profileStatus,
    profile: authUserProfile,
  });
  const isAuthLoading = isGateLoading(accessGate);
  // 승인 완료(approved)된 정회원만 true, 비로그인/미승인/거절/정지/문서누락 상태는 모두 차단(false)
  const isAccessAllowed = canAccessInternal(accessGate);

  const currentUser: User = isRealAuthActive && authUserProfile
    ? {
        id: authUserProfile.id || (rawFirebaseUser ? rawFirebaseUser.uid : ""),
        name: authUserProfile.name || (authUserProfile.role === "admin" ? "이혜원" : rawFirebaseUser?.email ? rawFirebaseUser.email.split("@")[0] : "사용자"),
        email: authUserProfile.email || rawFirebaseUser?.email || "",
        role: authUserProfile.role || "student",
        studentIdOrYear: authUserProfile.studentIdOrYear || "",
        doubleMajor: authUserProfile.doubleMajor,
        careerTrack: authUserProfile.careerTrack,
        academicProfile: authUserProfile.academicProfile,
        bio: authUserProfile.bio || "",
        avatarInitials:
          authUserProfile.avatarInitials ||
          (authUserProfile.name ? authUserProfile.name.slice(0, 2) : authUserProfile.role === "admin" ? "이혜" : "학"),
        approvalStatus: authUserProfile.approvalStatus || "pending",
        joinedAt: authUserProfile.joinedAt || new Date().toISOString().slice(0, 10),
      }
    : state.users.find((u) => u.id === ROLE_DEFAULT_USER_ID[currentRole]) || state.users[0];

  // 대화방 목록 계산 (Firestore 연결 시 실제 대화방 동기화, 데모 모드 시 로컬 상태)
  const conversations: Conversation[] = useMemo(() => {
    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      return firestoreRooms.map((room) => {
        let displayTitle = room.title;

        // 1:1 대화방의 경우 상대방 이름으로 제목 동적 설정 (학번 노출 방지)
        if (!room.isGroup) {
          const partnerUid = room.participants.find((uid) => uid !== authUserProfile.id);
          if (partnerUid && room.participantDetails?.[partnerUid]) {
            const partner = room.participantDetails[partnerUid];
            displayTitle = partner.name || "대화 상대";
          }
        }

        const readStateRoom = {
          participants: room.participants || [],
          msgSeq: room.msgSeq,
          readSeq: room.readSeq,
          joinSeq: room.joinSeq,
        };

        return {
          id: room.id,
          title: displayTitle,
          isGroup: room.isGroup,
          categoryTag: room.categoryTag || (room.isGroup ? "단체 대화방" : "1:1 대화"),
          memberIds: room.participants,
          members: room.participants.map((uid) => ({
            conversationId: room.id,
            userId: uid,
            joinedAt: room.createdAt,
            unreadCount: unreadCountForUser(readStateRoom, uid),
          })),
          lastMessageText: room.lastMessageText || "",
          lastMessageAt: room.lastMessageAt || "",
          createdBy: room.createdBy,
          msgSeq: room.msgSeq,
          readSeq: room.readSeq,
          joinSeq: room.joinSeq,
        };
      });
    }
    return state.conversations.map((conv) => {
      if (typeof conv.msgSeq !== "number") return conv;
      const readStateRoom = {
        participants: conv.memberIds || [],
        msgSeq: conv.msgSeq,
        readSeq: conv.readSeq,
        joinSeq: conv.joinSeq,
      };
      return {
        ...conv,
        members: conv.members.map((m) => ({
          ...m,
          unreadCount: unreadCountForUser(readStateRoom, m.userId),
        })),
      };
    });
  }, [isRealAuthActive, authUserProfile, firestoreRooms, state.conversations]);

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const toggleDarkMode = () => {
    // 향후 다크모드 재도입을 위해 인터페이스 보존 (현재는 라이트모드 고정)
    setIsDarkMode(false);
  };

  const resetDemoData = () => {
    const fresh = PlatformRepository.resetState();
    setState(fresh);
  };

  const applyFirebaseConfig = (config: FirebaseWebConfig) => {
    saveFirebaseConfigToLocal(config);
    setFirebaseVersionTick((v) => v + 1);
  };

  const disconnectFirebaseConfig = () => {
    clearFirebaseConfigFromLocal();
    setIsFirestoreConnected(false);
    setFirebaseProjectId(null);
    setFirestoreError(null);
    setRawFirebaseUser(null);
    setAuthUserProfile(null);
    setFirebaseVersionTick((v) => v + 1);
  };

  // --- 실제 Firebase 인증 함수 ---
  const handleSignUp = async (params: {
    email: string;
    password: string;
    name: string;
    studentIdOrYear: string;
    role: UserRole;
    verificationNote?: string;
    academicProfile?: StudentAcademicProfile;
    doubleMajor?: string;
  }) => {
    const createdProfile = await registerWithEmailAndPassword(params);
    setAuthUserProfile(createdProfile);
    setProfileStatus("loaded");
    if (params.academicProfile) {
      setState((prev) => ({
        ...prev,
        studentProgress: migrateStudentProgress(
          {
            ...prev.studentProgress,
            userId: createdProfile.id,
            academicProfile: params.academicProfile,
            isProfileComplete: true,
          },
          createdProfile
        ),
      }));
    }
  };

  const handleLogin = async (email: string, password: string) => {
    await loginWithEmailAndPassword(email, password);
  };

  const handleLogout = async () => {
    await logoutUser();
    setRawFirebaseUser(null);
    setAuthUserProfile(null);
    setProfileStatus("idle");
  };

  const handleResetPassword = async (email: string) => {
    await sendPasswordReset(email);
  };

  const handleClaimInitialAdmin = async () => {
    const updated = await claimInitialAdminRole();
    setAuthUserProfile(updated);
    setCurrentRole("admin");
  };

  const handleUpdateUserName = async (newName: string) => {
    const currentUid = authUserProfile?.id || (rawFirebaseUser ? rawFirebaseUser.uid : "");
    if (!currentUid) throw new Error("로그인된 사용자가 없습니다.");
    await updateUserDisplayName(currentUid, newName);
    setAuthUserProfile((prev) =>
      prev
        ? {
            ...prev,
            name: newName.trim(),
            avatarInitials: newName.trim().slice(0, 2),
          }
        : null
    );
  };

  const handleAdminUpdateApproval = async (
    targetUid: string,
    status: ApprovalStatus,
    adminComment?: string,
    role?: UserRole
  ) => {
    await updateUserApprovalStatusByAdmin({
      targetUid,
      status,
      adminComment,
      role,
    });
  };

  // --- 대화창 액션 ---
  // 중복 읽음 쓰기 방지용 ref (방 ID -> 마지막으로 요청한 순번)
  const lastMarkedSeqRef = useRef<Record<string, number>>({});

  const sendMessage = async (conversationId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      try {
        await sendChatMessageInFirestore(conversationId, currentUser, trimmed);
      } catch (err: any) {
        setFirestoreError(err?.message || "메시지 전송 중 오류가 발생했습니다.");
      }
      return;
    }

    const nowTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setState((prev) => {
      const targetConv = prev.conversations.find((c) => c.id === conversationId);
      const nextSeq = (targetConv?.msgSeq || 0) + 1;

      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        senderId: currentUser.id,
        content: trimmed,
        createdAt: nowTime,
        seq: nextSeq,
      };

      return {
        ...prev,
        messages: [...prev.messages, newMsg],
        conversations: prev.conversations.map((conv) => {
          if (conv.id !== conversationId) return conv;
          const nextReadSeq = {
            ...(conv.readSeq || {}),
            [currentUser.id]: nextSeq,
          };
          const readStateRoom = {
            participants: conv.memberIds,
            msgSeq: nextSeq,
            readSeq: nextReadSeq,
            joinSeq: conv.joinSeq || {},
          };
          return {
            ...conv,
            msgSeq: nextSeq,
            readSeq: nextReadSeq,
            lastMessageText: trimmed,
            lastMessageAt: nowTime,
            members: conv.members.map((m) => ({
              ...m,
              unreadCount: unreadCountForUser(readStateRoom, m.userId),
            })),
          };
        }),
      };
    });
  };

  const markConversationRead = async (conversationId: string, upToSeq?: number) => {
    if (!conversationId) return;

    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      const room = firestoreRooms.find((r) => r.id === conversationId);
      const targetSeq =
        typeof upToSeq === "number" && upToSeq > 0
          ? Math.floor(upToSeq)
          : typeof room?.msgSeq === "number"
          ? Math.floor(room.msgSeq)
          : 0;
      if (targetSeq <= 0) return;

      const currentEffective = room
        ? effectiveReadSeq(
            {
              participants: room.participants || [],
              msgSeq: room.msgSeq,
              readSeq: room.readSeq,
              joinSeq: room.joinSeq,
            },
            currentUser.id
          )
        : 0;
      if (targetSeq <= currentEffective) return;

      const inflightKey = `${conversationId}:${ currentUser.id }`;
      if ((lastMarkedSeqRef.current[inflightKey] || 0) >= targetSeq) {
        return;
      }
      lastMarkedSeqRef.current[inflightKey] = targetSeq;

      try {
        await markChatReadInFirestore(conversationId, currentUser.id, targetSeq);
      } catch (err) {
        // 실패 시 재시도 가능하도록 롤백
        delete lastMarkedSeqRef.current[inflightKey];
        console.warn("읽음 상태 갱신 안내:", err);
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((conv) => {
        if (conv.id !== conversationId) return conv;
        const maxSeq = conv.msgSeq || 0;
        const targetSeq =
          typeof upToSeq === "number" && upToSeq > 0
            ? Math.min(Math.floor(upToSeq), Math.max(maxSeq, Math.floor(upToSeq)))
            : maxSeq;
        const prevRead = conv.readSeq?.[currentUser.id] || 0;
        const nextReadVal = Math.max(prevRead, targetSeq);
        const nextReadSeq = {
          ...(conv.readSeq || {}),
          [currentUser.id]: nextReadVal,
        };
        const readStateRoom = {
          participants: conv.memberIds,
          msgSeq: maxSeq,
          readSeq: nextReadSeq,
          joinSeq: conv.joinSeq || {},
        };
        return {
          ...conv,
          readSeq: nextReadSeq,
          members: conv.members.map((m) =>
            m.userId === currentUser.id
              ? { ...m, unreadCount: unreadCountForUser(readStateRoom, currentUser.id) }
              : m
          ),
        };
      }),
    }));
  };

  const startOrOpenDirectChat = async (
    targetUserId: string,
    categoryTag = "1:1 대화"
  ): Promise<string> => {
    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      let targetUser: any =
        approvedMembers.find((u) => u.id === targetUserId) ||
        realUsersForAdmin.find((u) => u.id === targetUserId);

      if (!targetUser) {
        try {
          const { db } = getFirebaseInstances();
          if (db) {
            const userSnap = await getDoc(doc(db, "users", targetUserId));
            if (userSnap.exists()) {
              const d = userSnap.data();
              targetUser = {
                id: userSnap.id,
                uid: userSnap.id,
                name: d.name || "구성원",
                role: d.role || "student",
                avatarInitials: d.avatarInitials || "학",
                approvalStatus: d.approvalStatus || "approved",
              };
            }
          }
        } catch (e) {
          console.warn("대화 상대 정보 직접 조회 실패:", e);
        }
      }

      if (targetUser) {
        return await getOrCreateDirectChatInFirestore(
          currentUser,
          targetUser,
          categoryTag
        );
      }

      throw new Error("대화 상대를 찾을 수 없습니다.");
    }

    const existing = state.conversations.find(
      (c) =>
        !c.isGroup &&
        c.memberIds.includes(currentUser.id) &&
        c.memberIds.includes(targetUserId)
    );
    if (existing) {
      return existing.id;
    }

    const targetUser = state.users.find((u) => u.id === targetUserId);
    const newConvId = `conv-${Date.now()}`;
    const nowDate = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newConv: Conversation = {
      id: newConvId,
      title: targetUser ? targetUser.name : "새로운 1:1 대화",
      isGroup: false,
      categoryTag,
      memberIds: [currentUser.id, targetUserId],
      members: [
        {
          conversationId: newConvId,
          userId: currentUser.id,
          joinedAt: nowDate,
          unreadCount: 0,
        },
        {
          conversationId: newConvId,
          userId: targetUserId,
          joinedAt: nowDate,
          unreadCount: 0,
        },
      ],
      lastMessageText: "대화가 시작되었습니다. 첫 인사를 건네보세요!",
      lastMessageAt: nowTime,
      createdBy: currentUser.id,
      msgSeq: 0,
      readSeq: { [currentUser.id]: 0, [targetUserId]: 0 },
      joinSeq: { [currentUser.id]: 0, [targetUserId]: 0 },
    };

    const sysMsg: Message = {
      id: `msg-sys-${Date.now()}`,
      conversationId: newConvId,
      senderId: currentUser.id,
      content: `${currentUser.name}님이 ${targetUser?.name || "구성원"}님과의 대화를 시작했습니다.`,
      createdAt: nowTime,
      isSystemMessage: true,
    };

    setState((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
      messages: [...prev.messages, sysMsg],
    }));

    return newConvId;
  };

  const createGroupConversation = async (
    title: string,
    memberIds: string[],
    categoryTag = "단체 대화방"
  ): Promise<string> => {
    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      const invitedUsers = memberIds.map((id) => {
        const found = approvedMembers.find((u) => u.id === id);
        if (found) return found;
        return {
          id,
          name: "구성원",
          role: "student" as UserRole,
          avatarInitials: "학",
        };
      });
      return await createGroupChatInFirestore(
        currentUser,
        title,
        invitedUsers,
        categoryTag
      );
    }

    const uniqueMembers = Array.from(new Set([currentUser.id, ...memberIds]));
    const newConvId = `conv-grp-${Date.now()}`;
    const nowDate = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const initialCursor: Record<string, number> = {};
    uniqueMembers.forEach((uid) => {
      initialCursor[uid] = 0;
    });

    const newConv: Conversation = {
      id: newConvId,
      title: title.trim() || "교육학과 새 단체 대화방",
      isGroup: uniqueMembers.length > 2,
      categoryTag,
      memberIds: uniqueMembers,
      members: uniqueMembers.map((uid) => ({
        conversationId: newConvId,
        userId: uid,
        joinedAt: nowDate,
        unreadCount: 0,
      })),
      lastMessageText: `${currentUser.name}님이 단체 채팅방을 개설했습니다.`,
      lastMessageAt: nowTime,
      createdBy: currentUser.id,
      msgSeq: 0,
      readSeq: { ...initialCursor },
      joinSeq: { ...initialCursor },
    };

    const sysMsg: Message = {
      id: `msg-sys-${Date.now()}`,
      conversationId: newConvId,
      senderId: currentUser.id,
      content: `${currentUser.name}님이 [${newConv.title}] 채팅방을 개설하고 구성원 ${uniqueMembers.length}명을 초대했습니다.`,
      createdAt: nowTime,
      isSystemMessage: true,
    };

    setState((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
      messages: [...prev.messages, sysMsg],
    }));

    return newConvId;
  };

  const inviteUsersToChat = async (
    chatId: string,
    users: (PublicChatUser | UserProfileDoc)[]
  ) => {
    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      await inviteUsersToChatInFirestore(chatId, currentUser, users as any);
      return;
    }

    const newUids = users.map((u) => u.id).filter(Boolean);
    if (newUids.length === 0) return;

    const nowDate = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const names = users.map((u) => u.name).join(", ");
    const sysMsg: Message = {
      id: `msg-sys-${Date.now()}`,
      conversationId: chatId,
      senderId: currentUser.id,
      content: `${currentUser.name}님이 ${names}님을 초대했습니다.`,
      createdAt: nowTime,
      isSystemMessage: true,
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, sysMsg],
      conversations: prev.conversations.map((conv) => {
        if (conv.id !== chatId) return conv;
        const currentSeq = conv.msgSeq || 0;
        const nextMemberIds = Array.from(new Set([...conv.memberIds, ...newUids]));
        const nextJoinSeq = { ...(conv.joinSeq || {}) };
        const nextReadSeq = { ...(conv.readSeq || {}) };
        newUids.forEach((uid) => {
          if (typeof nextJoinSeq[uid] !== "number") nextJoinSeq[uid] = currentSeq;
          if (typeof nextReadSeq[uid] !== "number" || nextReadSeq[uid] < currentSeq) {
            nextReadSeq[uid] = currentSeq;
          }
        });
        const existingMemberMap = new Map(conv.members.map((m) => [m.userId, m]));
        const nextMembers = nextMemberIds.map(
          (uid) =>
            existingMemberMap.get(uid) || {
              conversationId: chatId,
              userId: uid,
              joinedAt: nowDate,
              unreadCount: 0,
            }
        );
        return {
          ...conv,
          isGroup: nextMemberIds.length > 2 ? true : conv.isGroup,
          memberIds: nextMemberIds,
          members: nextMembers,
          joinSeq: nextJoinSeq,
          readSeq: nextReadSeq,
        };
      }),
    }));
  };

  const leaveChat = async (chatId: string) => {
    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      await leaveChatInFirestore(chatId, currentUser);
      return;
    }

    const nowTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sysMsg: Message = {
      id: `msg-sys-${Date.now()}`,
      conversationId: chatId,
      senderId: currentUser.id,
      content: `${currentUser.name}님이 대화방을 나갔습니다.`,
      createdAt: nowTime,
      isSystemMessage: true,
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, sysMsg],
      conversations: prev.conversations.map((conv) => {
        if (conv.id !== chatId) return conv;
        return {
          ...conv,
          memberIds: conv.memberIds.filter((uid) => uid !== currentUser.id),
          members: conv.members.filter((m) => m.userId !== currentUser.id),
        };
      }),
    }));
  };

  // --- 공지사항 통합 데이터 & 액션 (공식 홈페이지 자동 연동 + 관리자 직접 작성 + 캘린더 일정 관리) ---
  const noticeSyncMeta: NoticeSyncMetadata = useMemo(() => {
    return {
      lastAttemptAt: officialNoticesJson.lastAttemptAt,
      lastSuccessAt: officialNoticesJson.lastSuccessAt,
      scheduleNote: officialNoticesJson.scheduleNote,
      sources: officialNoticesJson.sources as NoticeSyncMetadata["sources"],
    };
  }, []);

  const mergedNotices: Notice[] = useMemo(() => {
    const byId = new Map<string, Notice>();
    const urlToId = new Map<string, string>();

    // 1. 기존 로컬/예시 공지 보존 (삭제 금지 원칙 준수)
    state.notices.forEach((n) => {
      byId.set(n.id, n);
      if (n.officialUrl && n.officialUrl !== "https://www.dongguk.edu") {
        urlToId.set(n.officialUrl, n.id);
      }
    });

    // 2. 공식 홈페이지 자동 수집 공지 병합 (본문 무단 복제 없이 제목·메타데이터·원문 링크만 제공)
    (officialNoticesJson.notices as any[]).forEach((raw) => {
      const existingId = byId.has(raw.id) ? raw.id : urlToId.get(raw.officialUrl);
      const prev = existingId ? byId.get(existingId) : undefined;

      const officialItem: Notice = {
        id: raw.id,
        articleSeq: raw.articleSeq,
        sourceId: raw.sourceId,
        organization: raw.organization,
        subCategoryTag: raw.subCategoryTag,
        category: raw.category as NoticeCategory,
        title: raw.title,
        summary: raw.summary,
        content: [
          `[동국대학교 공식 홈페이지 자동 연동 안내]`,
          `• 작성 기관: ${raw.organization}`,
          `• 공지 분류: ${raw.category}${raw.subCategoryTag ? ` (${raw.subCategoryTag})` : ""}`,
          `• 작성일: ${raw.createdAt} / 작성자: ${raw.authorName}`,
          `• 첨부파일 여부: ${raw.hasAttachment ? "첨부파일 있음 (원문에서 다운로드 가능)" : "없음"}`,
          ``,
          `※ 동국e음은 저작권 및 학교 홈페이지 운영 정책을 준수하기 위해 공지 본문이나 첨부파일 전체를 무단 복제하지 않습니다.`,
          `아래 [공식 홈페이지 원문 이동] 버튼을 누르시면 해당 게시글(${raw.officialUrl})의 상세 본문과 첨부파일을 즉시 확인하실 수 있습니다.`,
        ].join("\n"),
        authorName: raw.authorName || raw.organization,
        createdAt: raw.createdAt,
        isPinned: Boolean(raw.isPinned),
        isSampleData: false,
        officialUrl: raw.officialUrl,
        viewCount: Number(raw.viewCount) || 0,
        hasAttachment: Boolean(raw.hasAttachment),
        isOfficialSynced: true,
        isNew: Boolean(raw.isNew),
        collectedAt: raw.collectedAt,
        lastVerifiedAt: raw.lastVerifiedAt,
        syncState: raw.syncState || "active",
        // 로컬에서 관리자가 이미 확정/수정한 일정이 있으면 우선 유지
        scheduleStatus: prev?.scheduleStatus || raw.scheduleStatus || "none",
        eventStartDate: prev?.eventStartDate || raw.eventStartDate,
        eventEndDate: prev?.eventEndDate || raw.eventEndDate,
        extractedDateText: prev?.extractedDateText || raw.extractedDateText,
      };

      byId.set(officialItem.id, officialItem);
      urlToId.set(officialItem.officialUrl, officialItem.id);
    });

    // 3. Firestore 실시간 공지 병합 (관리자가 작성했거나 캘린더 일정을 확정한 내역 최우선 반영)
    firestoreNotices.forEach((cloudNotice) => {
      const prev = byId.get(cloudNotice.id);
      byId.set(cloudNotice.id, {
        ...prev,
        ...cloudNotice,
      });
    });

    return Array.from(byId.values()).sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const dateCmp = (b.createdAt || "").localeCompare(a.createdAt || "");
      if (dateCmp !== 0) return dateCmp;
      return b.id.localeCompare(a.id);
    });
  }, [state.notices, firestoreNotices]);

  const createNotice = async (payload: {
    title: string;
    category: NoticeCategory;
    summary: string;
    content: string;
    isPinned: boolean;
    officialUrl: string;
    eventStartDate?: string;
    eventEndDate?: string;
  }) => {
    // 실제 인증 모드에서는 오직 승인된 관리자만 공지를 등록할 수 있음 (일반 사용자 권한 차단)
    if (isRealAuthActive) {
      if (!authUserProfile || authUserProfile.role !== "admin" || authUserProfile.approvalStatus !== "approved") {
        throw new Error("공지사항 등록 권한이 없습니다. 승인된 학과 관리자만 공지를 작성할 수 있습니다.");
      }
    }

    const isAdminReal =
      isRealAuthActive &&
      authUserProfile?.role === "admin" &&
      authUserProfile?.approvalStatus === "approved";

    const today = new Date().toISOString().slice(0, 10);
    const hasExplicitSchedule = Boolean(payload.eventStartDate);
    const extracted = hasExplicitSchedule
      ? {
          scheduleStatus: "confirmed" as const,
          eventStartDate: payload.eventStartDate,
          eventEndDate: payload.eventEndDate || payload.eventStartDate,
        }
      : extractScheduleFromTitle(payload.title, today);

    const newNotice: Notice = {
      id: `notice-admin-${Date.now()}`,
      title: payload.title.trim(),
      category: payload.category,
      organization: "동국대학교 교육학과 (동국e음 관리자)",
      summary: payload.summary.trim() || payload.content.trim().slice(0, 90),
      content: payload.content.trim(),
      authorName: `${currentUser.name} (학과 관리자)`,
      createdAt: today,
      isPinned: payload.isPinned,
      isSampleData: !isAdminReal,
      isOfficialSynced: false,
      isNew: true,
      officialUrl: payload.officialUrl.trim() || "https://education.dongguk.edu",
      viewCount: 1,
      ...extracted,
    };

    setState((prev) => ({
      ...prev,
      notices: [newNotice, ...prev.notices],
    }));

    if (isAdminReal) {
      await upsertNoticeInFirestore(newNotice);
    }
  };

  const syncOfficialNoticesToCloud = async (): Promise<number> => {
    if (!authUserProfile || authUserProfile.role !== "admin" || authUserProfile.approvalStatus !== "approved") {
      throw new Error("승인된 관리자만 Firestore에 공식 공지를 동기화할 수 있습니다.");
    }
    return await syncOfficialNoticesToFirestore(mergedNotices, noticeSyncMeta);
  };

  const updateNoticeSchedule = async (
    noticeId: string,
    schedule: {
      scheduleStatus: "confirmed" | "needs_review" | "none";
      eventStartDate?: string;
      eventEndDate?: string;
    }
  ): Promise<void> => {
    if (isRealAuthActive) {
      if (!authUserProfile || authUserProfile.role !== "admin" || authUserProfile.approvalStatus !== "approved") {
        throw new Error("승인된 관리자만 캘린더 일정을 확정·수정할 수 있습니다.");
      }
    }

    const target = mergedNotices.find((n) => n.id === noticeId);
    if (!target) return;

    const updatedNotice: Notice = {
      ...target,
      scheduleStatus: schedule.scheduleStatus,
      eventStartDate: schedule.eventStartDate,
      eventEndDate: schedule.eventEndDate || schedule.eventStartDate,
    };

    setState((prev) => {
      const exists = prev.notices.some((n) => n.id === noticeId);
      return {
        ...prev,
        notices: exists
          ? prev.notices.map((n) => (n.id === noticeId ? updatedNotice : n))
          : [updatedNotice, ...prev.notices],
      };
    });

    if (
      isRealAuthActive &&
      authUserProfile?.role === "admin" &&
      authUserProfile?.approvalStatus === "approved"
    ) {
      await upsertNoticeInFirestore(updatedNotice);
    }
  };

  // --- 졸업생 연결 액션 ---
  const createMentoringRequest = (
    toAlumniProfileId: string,
    topic: string,
    message: string
  ) => {
    const targetAlumni = state.alumniProfiles.find(
      (a) => a.id === toAlumniProfileId
    );
    if (!targetAlumni) return;

    const newReq: MentoringRequest = {
      id: `mentor-req-${Date.now()}`,
      fromUserId: currentUser.id,
      fromUserName: `${currentUser.name} (${currentUser.studentIdOrYear})`,
      toAlumniProfileId,
      toAlumniName: targetAlumni.displayName,
      topic,
      message,
      status: "대기중",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setState((prev) => ({
      ...prev,
      mentoringRequests: [newReq, ...prev.mentoringRequests],
    }));
  };

  const updateMentoringStatus = (
    requestId: string,
    status: "대기중" | "수락됨" | "답변완료"
  ) => {
    setState((prev) => ({
      ...prev,
      mentoringRequests: prev.mentoringRequests.map((r) =>
        r.id === requestId ? { ...r, status } : r
      ),
    }));
  };

  const upsertAlumniProfile = (
    profileData: Omit<AlumniProfile, "id" | "userId">
  ) => {
    setState((prev) => {
      const existing = prev.alumniProfiles.find(
        (p) => p.userId === currentUser.id
      );
      if (existing) {
        return {
          ...prev,
          alumniProfiles: prev.alumniProfiles.map((p) =>
            p.userId === currentUser.id ? { ...existing, ...profileData } : p
          ),
        };
      }
      const newProfile: AlumniProfile = {
        id: `alumni-${Date.now()}`,
        userId: currentUser.id,
        ...profileData,
      };
      return {
        ...prev,
        alumniProfiles: [newProfile, ...prev.alumniProfiles],
      };
    });
  };

  // --- 졸업요건 자가점검 및 공식 학업이수 기준 관리 액션 ---
  const syncStudentProgressToCloud = (nextProgress: StudentProgress) => {
    if (
      isRealAuthActive &&
      authUserProfile &&
      authUserProfile.approvalStatus === "approved"
    ) {
      const uid = authUserProfile.id || rawFirebaseUser?.uid || nextProgress.userId;
      if (uid) {
        saveStudentGraduationRecordInFirestore(uid, nextProgress).catch((err) => {
          console.warn("졸업요건 기록 클라우드 동기화 안내:", err);
        });
      }
    }
  };

  const updateGraduationCatalogByAdmin = async (
    nextCatalog: OfficialGraduationCatalog
  ): Promise<void> => {
    if (isRealAuthActive) {
      if (
        !authUserProfile ||
        authUserProfile.role !== "admin" ||
        authUserProfile.approvalStatus !== "approved"
      ) {
        throw new Error(
          "공통 졸업요건 기준은 승인된 관리자만 등록·수정할 수 있습니다."
        );
      }
    }

    const stampedCatalog: OfficialGraduationCatalog = {
      ...nextCatalog,
      updatedByAdminName: currentUser.name,
    };

    setGraduationCatalog(stampedCatalog);
    setState((prev) => ({
      ...prev,
      graduationRequirements:
        buildLegacyGraduationRequirementsFromCatalog(stampedCatalog),
    }));

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "dongguk_e_eum_graduation_catalog_v1",
        JSON.stringify(stampedCatalog)
      );
    }

    if (
      isRealAuthActive &&
      authUserProfile?.role === "admin" &&
      authUserProfile?.approvalStatus === "approved"
    ) {
      await saveGraduationCatalogInFirestore(stampedCatalog);
    }
  };

  const updateStudentAcademicProfile = async (
    profile: StudentAcademicProfile
  ): Promise<void> => {
    const safeProfile: StudentAcademicProfile = {
      ...profile,
      hasDoubleMajor: profile.majorPlanType !== "single",
      doubleMajorDepartment:
        profile.majorPlanType === "single"
          ? ""
          : profile.doubleMajorDepartment.trim(),
      adminVerifiedSpecialCondition: Boolean(
        state.studentProgress.academicProfile?.adminVerifiedSpecialCondition
      ),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const legacyFields = deriveLegacyFieldsFromAcademicProfile(safeProfile);

    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const migrated = migrateStudentProgress(prev.studentProgress, currentUser);
      const nextProgress: StudentProgress = {
        ...migrated,
        ...legacyFields,
        academicProfile: safeProfile,
        isProfileComplete: true,
        officialAdminVerified: false,
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });

    if (nextSnapshot) {
      syncStudentProgressToCloud(nextSnapshot);
    }

    if (isRealAuthActive && authUserProfile) {
      const uid = authUserProfile.id || rawFirebaseUser?.uid || "";
      setAuthUserProfile((prev) =>
        prev
          ? {
              ...prev,
              studentIdOrYear: safeProfile.admissionYearLabel,
              doubleMajor: safeProfile.hasDoubleMajor
                ? safeProfile.doubleMajorDepartment || "복수전공"
                : "단일전공(교육학)",
              academicProfile: safeProfile,
            }
          : null
      );
      if (uid) {
        updateUserAcademicProfileInFirestore(uid, safeProfile).catch((err) =>
          console.warn("프로필 학사정보 동기화 안내:", err)
        );
      }
    }
  };

  const addEnrolledCourse = (
    coursePayload: Omit<EnrolledCourse, "id" | "createdAt">
  ) => {
    const subMatch = matchTeachingSubstitution(coursePayload);
    const newCourse: EnrolledCourse = {
      ...coursePayload,
      id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      credits: Math.max(0, Number(coursePayload.credits) || 0),
      yearTaken: Number(coursePayload.yearTaken) || 2024,
      recognitionStatus: coursePayload.recognitionStatus || "confirmed",
      substitutedTeachingSubjectCode:
        coursePayload.substitutedTeachingSubjectCode ||
        (subMatch ? subMatch.ercCourseCodes[0] : undefined),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const migrated = migrateStudentProgress(prev.studentProgress, currentUser);
      const nextCourses = sortCoursesBySemester([
        ...(migrated.courses || []),
        newCourse,
      ]);
      const nextProgress: StudentProgress = {
        ...migrated,
        courses: nextCourses,
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });

    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const updateEnrolledCourse = (
    courseId: string,
    patch: Partial<EnrolledCourse>
  ) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const migrated = migrateStudentProgress(prev.studentProgress, currentUser);
      const nextCourses = sortCoursesBySemester(
        (migrated.courses || []).map((c) => {
          if (c.id !== courseId) return c;
          const merged = { ...c, ...patch };
          const subMatch = matchTeachingSubstitution(merged);
          return {
            ...merged,
            credits: Math.max(0, Number(merged.credits) || 0),
            yearTaken: Number(merged.yearTaken) || c.yearTaken,
            substitutedTeachingSubjectCode: subMatch
              ? subMatch.ercCourseCodes[0]
              : undefined,
          };
        })
      );
      const nextProgress: StudentProgress = {
        ...migrated,
        courses: nextCourses,
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });

    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const removeEnrolledCourse = (courseId: string) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const migrated = migrateStudentProgress(prev.studentProgress, currentUser);
      const nextCourses = (migrated.courses || []).filter(
        (c) => c.id !== courseId
      );
      const nextProgress: StudentProgress = {
        ...migrated,
        courses: nextCourses,
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });

    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const updateVolunteeringCourseState = (
    patch: Partial<VolunteeringCourseState>
  ) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const migrated = migrateStudentProgress(prev.studentProgress, currentUser);
      const nextProgress: StudentProgress = {
        ...migrated,
        volunteeringState: {
          ...migrated.volunteeringState!,
          ...patch,
        },
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });

    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const updateSchoolPracticumState = (patch: Partial<SchoolPracticumState>) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const migrated = migrateStudentProgress(prev.studentProgress, currentUser);
      const nextProgress: StudentProgress = {
        ...migrated,
        practicumState: {
          ...migrated.practicumState!,
          ...patch,
        },
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });

    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const updateTeachingChecklistState = (
    patch: Partial<TeachingChecklistState>
  ) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const migrated = migrateStudentProgress(prev.studentProgress, currentUser);
      const nextProgress: StudentProgress = {
        ...migrated,
        teachingChecklist: {
          ...migrated.teachingChecklist!,
          ...patch,
          // 학생이 임의로 학교 공식 인정 확인 상태를 변경할 수 없도록 보존
          officialVerificationConfirmedByAdmin: Boolean(
            migrated.teachingChecklist?.officialVerificationConfirmedByAdmin
          ),
        },
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });

    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const updateStudentCredit = (
    category: RequirementCategory,
    completedValue: number,
    userCustomTarget: number | null,
    isCompletedBoolean?: boolean
  ) => {
    const today = new Date().toISOString().slice(0, 10);
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const nextProgress: StudentProgress = {
        ...prev.studentProgress,
        credits: {
          ...prev.studentProgress.credits,
          [category]: {
            completedValue,
            userCustomTarget,
            isCompletedBoolean,
            lastUpdated: today,
          },
        },
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });
    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const updateStudentProfileMeta = (
    admissionYear: string,
    majorType: StudentProgress["majorType"],
    doubleMajorName: string,
    isTeacherTrack: boolean
  ) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const nextProgress = migrateStudentProgress(
        {
          ...prev.studentProgress,
          admissionYear,
          majorType,
          doubleMajorName,
          isTeacherTrack,
        },
        currentUser
      );
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });
    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const addVolunteeringRecord = (
    institutionName: string,
    activityDate: string,
    hours: number,
    note: string
  ) => {
    const newRec = {
      id: `vol-${Date.now()}`,
      institutionName,
      activityDate,
      hours,
      verifiedBySelf: true,
      note,
    };
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const updatedRecords = [
        newRec,
        ...prev.studentProgress.volunteeringRecords,
      ];
      const totalHours = updatedRecords.reduce((acc, r) => acc + r.hours, 0);
      const prevVolCredit = prev.studentProgress.credits["교육봉사 시간"];
      const nextProgress: StudentProgress = {
        ...prev.studentProgress,
        volunteeringRecords: updatedRecords,
        credits: {
          ...prev.studentProgress.credits,
          "교육봉사 시간": {
            completedValue: totalHours,
            userCustomTarget: prevVolCredit?.userCustomTarget ?? null,
            lastUpdated: new Date().toISOString().slice(0, 10),
          },
        },
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });
    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const removeVolunteeringRecord = (id: string) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const updatedRecords = prev.studentProgress.volunteeringRecords.filter(
        (r) => r.id !== id
      );
      const totalHours = updatedRecords.reduce((acc, r) => acc + r.hours, 0);
      const prevVolCredit = prev.studentProgress.credits["교육봉사 시간"];
      const nextProgress: StudentProgress = {
        ...prev.studentProgress,
        volunteeringRecords: updatedRecords,
        credits: {
          ...prev.studentProgress.credits,
          "교육봉사 시간": {
            completedValue: totalHours,
            userCustomTarget: prevVolCredit?.userCustomTarget ?? null,
            lastUpdated: new Date().toISOString().slice(0, 10),
          },
        },
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });
    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const toggleChecklistItem = (id: string) => {
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const nextProgress: StudentProgress = {
        ...prev.studentProgress,
        checklist: prev.studentProgress.checklist.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item
        ),
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });
    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  const addChecklistItem = (
    label: string,
    category: RequirementCategory,
    memo: string
  ) => {
    const newItem = {
      id: `chk-${Date.now()}`,
      label,
      category,
      completed: false,
      memo,
    };
    let nextSnapshot: StudentProgress | null = null;
    setState((prev) => {
      const nextProgress: StudentProgress = {
        ...prev.studentProgress,
        checklist: [...prev.studentProgress.checklist, newItem],
      };
      nextSnapshot = nextProgress;
      return {
        ...prev,
        studentProgress: nextProgress,
      };
    });
    if (nextSnapshot) syncStudentProgressToCloud(nextSnapshot);
  };

  // --- 진로 및 복수전공 공유방 액션 (Firestore 실시간 연동) ---
  const toggleJoinRoom = (roomId: string) => {
    setState((prev) => ({
      ...prev,
      communityRooms: prev.communityRooms.map((room) => {
        if (room.id !== roomId) return room;
        const isMember = room.memberIds.includes(currentUser.id);
        return {
          ...room,
          memberIds: isMember
            ? room.memberIds.filter((id) => id !== currentUser.id)
            : [...room.memberIds, currentUser.id],
        };
      }),
    }));
  };

  const createCommunityRoom = (payload: {
    name: string;
    type: "career" | "double_major";
    categoryName: string;
    description: string;
  }) => {
    const newRoom: CommunityRoom = {
      id: `room-${Date.now()}`,
      name: payload.name,
      type: payload.type,
      categoryName: payload.categoryName,
      description: payload.description,
      memberIds: [currentUser.id],
      relatedAlumniIds: [],
      createdAt: new Date().toISOString().slice(0, 10),
      isOfficial: true,
    };
    setState((prev) => ({
      ...prev,
      communityRooms: [...prev.communityRooms, newRoom],
    }));
  };

  const updateCommunityRoomName = (
    roomId: string,
    name: string,
    categoryName: string,
    description: string
  ) => {
    setState((prev) => ({
      ...prev,
      communityRooms: prev.communityRooms.map((r) =>
        r.id === roomId ? { ...r, name, categoryName, description } : r
      ),
    }));
  };

  const createCommunityPost = (payload: {
    roomId: string;
    category: PostCategory;
    title: string;
    content: string;
  }) => {
    const room = state.communityRooms.find((r) => r.id === payload.roomId);
    const roleLabel =
      currentUser.role === "student"
        ? "재학생"
        : currentUser.role === "alumni"
        ? "졸업생"
        : currentUser.role === "professor"
        ? "교수진"
        : "관리자";

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      roomId: payload.roomId,
      roomName: room?.name || "공유방",
      category: payload.category,
      title: payload.title,
      content: payload.content,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorBadge: `${currentUser.studentIdOrYear} · ${roleLabel}`,
      createdAt: new Date().toISOString().slice(0, 10),
      likes: 0,
      comments: [],
    };

    setState((prev) => ({
      ...prev,
      communityPosts: [newPost, ...prev.communityPosts],
    }));

    if (isFirestoreConnected) {
      createPostInFirestore(newPost).catch((err) => {
        setFirestoreError(
          `글 등록 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    }
  };

  const deleteCommunityPost = (postId: string) => {
    setState((prev) => ({
      ...prev,
      communityPosts: prev.communityPosts.filter((p) => p.id !== postId),
    }));

    if (isFirestoreConnected) {
      deletePostInFirestore(postId).catch((err) => {
        setFirestoreError(
          `글 삭제 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    }
  };

  const addCommunityComment = (postId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const newComment = {
      id: `cmt-${Date.now()}`,
      postId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      content: trimmed,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const targetPost = state.communityPosts.find((p) => p.id === postId);
    const updatedComments = targetPost
      ? [...targetPost.comments, newComment]
      : [newComment];

    setState((prev) => ({
      ...prev,
      communityPosts: prev.communityPosts.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      ),
    }));

    if (isFirestoreConnected) {
      addCommentInFirestore(postId, updatedComments).catch((err) => {
        setFirestoreError(
          `댓글 등록 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    }
  };

  const likeCommunityPost = (postId: string) => {
    const targetPost = state.communityPosts.find((p) => p.id === postId);
    const nextLikes = (targetPost?.likes ?? 0) + 1;

    setState((prev) => ({
      ...prev,
      communityPosts: prev.communityPosts.map((p) =>
        p.id === postId ? { ...p, likes: nextLikes } : p
      ),
    }));

    if (isFirestoreConnected) {
      incrementLikeInFirestore(postId, nextLikes).catch((err) => {
        setFirestoreError(
          `공감 반영 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    }
  };

  // --- 가입 신청 및 관리자 액션 (로컬 데모용) ---
  const submitApprovalRequest = (payload: {
    applicantName: string;
    applicantEmail: string;
    requestedRole: UserRole;
    studentIdOrYear: string;
    verificationMethod: string;
    note: string;
  }) => {
    const newReq: ApprovalRequest = {
      id: `app-req-${Date.now()}`,
      ...payload,
      status: "pending",
      submittedAt: new Date().toLocaleString("ko-KR"),
    };
    setState((prev) => ({
      ...prev,
      approvalRequests: [newReq, ...prev.approvalRequests],
    }));
  };

  const updateApprovalStatus = (
    requestId: string,
    status: ApprovalStatus,
    adminComment?: string
  ) => {
    setState((prev) => ({
      ...prev,
      approvalRequests: prev.approvalRequests.map((req) =>
        req.id === requestId ? { ...req, status, adminComment } : req
      ),
    }));
  };

  const updateUserRoleByAdmin = (userId: string, newRole: UserRole) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, role: newRole } : u
      ),
    }));
  };

  const resolveReport = (reportId: string) => {
    setState((prev) => ({
      ...prev,
      reports: prev.reports.map((r) =>
        r.id === reportId
          ? { ...r, status: r.status === "접수됨" ? "처리완료" : "접수됨" }
          : r
      ),
    }));
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        notices: mergedNotices,
        noticeSyncMeta,
        conversations,
        firestoreRooms,
        approvedMembers,
        approvedMembersLoading,
        approvedMembersError,
        refreshApprovedMembers,
        inviteUsersToChat,
        leaveChat,
        currentUser,
        currentRole,
        isDarkMode,
        switchRole,
        toggleDarkMode,
        resetDemoData,
        isFirestoreConnected,
        firebaseProjectId,
        firestoreError,
        applyFirebaseConfig,
        disconnectFirebaseConfig,
        rawFirebaseUser,
        authUserProfile,
        isAuthLoading,
        isRealAuthActive,
        isAccessAllowed,
        accessGate,
        handleSignUp,
        handleLogin,
        handleLogout,
        handleResetPassword,
        handleClaimInitialAdmin,
        handleUpdateUserName,
        realUsersForAdmin,
        handleAdminUpdateApproval,
        sendMessage,
        markConversationRead,
        startOrOpenDirectChat,
        createGroupConversation,
        createNotice,
        syncOfficialNoticesToCloud,
        updateNoticeSchedule,
        createMentoringRequest,
        updateMentoringStatus,
        upsertAlumniProfile,
        graduationCatalog,
        updateGraduationCatalogByAdmin,
        updateStudentAcademicProfile,
        addEnrolledCourse,
        updateEnrolledCourse,
        removeEnrolledCourse,
        updateVolunteeringCourseState,
        updateSchoolPracticumState,
        updateTeachingChecklistState,
        updateStudentCredit,
        updateStudentProfileMeta,
        addVolunteeringRecord,
        removeVolunteeringRecord,
        toggleChecklistItem,
        addChecklistItem,
        toggleJoinRoom,
        createCommunityRoom,
        updateCommunityRoomName,
        createCommunityPost,
        deleteCommunityPost,
        addCommunityComment,
        likeCommunityPost,
        submitApprovalRequest,
        updateApprovalStatus,
        updateUserRoleByAdmin,
        resolveReport,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within AppProvider");
  }
  return ctx;
}

export const CAREER_TRACK_LIST: CareerTrack[] = [
  "교직",
  "교육행정",
  "공공기관",
  "기업 HRD",
  "교육기업 및 에듀테크",
  "대학원 및 연구",
  "기타",
];
