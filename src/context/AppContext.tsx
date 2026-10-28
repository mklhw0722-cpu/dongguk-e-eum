"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  User,
  UserRole,
  Notice,
  NoticeCategory,
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
} from "@/types";
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
  inviteUsersToChatInFirestore,
  leaveChatInFirestore,
  searchApprovedUsersInFirestore,
  subscribeToApprovedUsers,
  PublicChatUser,
  getFirebaseInstances,
  syncApprovedUsersToPublicProfiles,
  updateUserDisplayName,
} from "@/lib/firebase";
import { User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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
  isAuthLoading: boolean;
  isRealAuthActive: boolean;
  isAccessAllowed: boolean; // 승인된 회원(approved) 또는 데모 모드일 때만 true

  // 실제 인증 액션
  handleSignUp: (params: {
    email: string;
    password: string;
    name: string;
    studentIdOrYear: string;
    role: UserRole;
    verificationNote?: string;
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
  markConversationRead: (conversationId: string) => void;
  startOrOpenDirectChat: (targetUserId: string, categoryTag?: string) => Promise<string> | string;
  createGroupConversation: (title: string, memberIds: string[], categoryTag?: string) => Promise<string> | string;
  firestoreRooms: FirestoreChatRoom[];
  approvedMembers: PublicChatUser[];
  approvedMembersLoading: boolean;
  approvedMembersError: string | null;
  refreshApprovedMembers: () => Promise<PublicChatUser[]>;
  inviteUsersToChat: (chatId: string, users: (PublicChatUser | UserProfileDoc)[]) => Promise<void>;
  leaveChat: (chatId: string) => Promise<void>;

  // 기능 B. 공지사항 액션
  createNotice: (payload: {
    title: string;
    category: NoticeCategory;
    summary: string;
    content: string;
    isPinned: boolean;
    officialUrl: string;
  }) => void;

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

  // 기능 D. 졸업요건 자가점검 액션
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [realUsersForAdmin, setRealUsersForAdmin] = useState<UserProfileDoc[]>([]);

  useEffect(() => {
    const loaded = PlatformRepository.loadState();
    setState(loaded);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlProjectId = params.get("fbProjectId");
      const urlApiKey = params.get("fbApiKey");
      if (urlProjectId && urlApiKey) {
        saveFirebaseConfigToLocal({
          apiKey: urlApiKey,
          projectId: urlProjectId,
          authDomain: `${urlProjectId}.firebaseapp.com`,
        });
      }
    }

    setHydrated(true);
  }, []);

  // Firebase Auth & 프로필 실시간 감지
  useEffect(() => {
    if (!hydrated) return;

    const activeConfig = getActiveFirebaseConfig();
    if (!activeConfig) {
      setIsFirestoreConnected(false);
      setFirebaseProjectId(null);
      setIsAuthLoading(false);
      return;
    }

    setFirebaseProjectId(activeConfig.projectId);
    setIsAuthLoading(true);

    const unsubAuth = subscribeToAuthStatus(
      (profile, rawUser) => {
        setRawFirebaseUser(rawUser);
        setAuthUserProfile(profile);
        setIsAuthLoading(false);
        setIsFirestoreConnected(true);

        if (profile) {
          setCurrentRole(profile.role);
        }
      },
      (err) => {
        setFirestoreError(err);
        setIsAuthLoading(false);
      }
    );

    return () => {
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
  const [approvedMembersRaw, setApprovedMembersRaw] = useState<PublicChatUser[]>([]);
  const [approvedMembersLoading, setApprovedMembersLoading] = useState(false);
  const [approvedMembersError, setApprovedMembersError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const activeConfig = getActiveFirebaseConfig();
    if (!activeConfig) return;

    if (!rawFirebaseUser || !authUserProfile || authUserProfile.approvalStatus !== "approved") {
      setFirestoreRooms([]);
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

    return () => {
      if (unsubChats) unsubChats();
      if (unsubApprovedUsers) unsubApprovedUsers();
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

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", isDarkMode);
    }
  }, [isDarkMode]);

  // 실제 Firebase Auth 로그인 여부
  const isRealAuthActive = Boolean(rawFirebaseUser);

  // 폐쇄형 학과 플랫폼 접근 제어: 승인 완료(approved)된 정회원만 true, 비로그인/미승인/거절 상태는 기본적으로 모두 차단(false)
  const isAccessAllowed = Boolean(
    rawFirebaseUser && authUserProfile && authUserProfile.approvalStatus === "approved"
  );

  const currentUser: User = isRealAuthActive && authUserProfile
    ? {
        id: authUserProfile.id || (rawFirebaseUser ? rawFirebaseUser.uid : ""),
        name: authUserProfile.name || (rawFirebaseUser?.email ? rawFirebaseUser.email.split("@")[0] : "사용자"),
        email: authUserProfile.email || rawFirebaseUser?.email || "",
        role: authUserProfile.role || "student",
        studentIdOrYear: authUserProfile.studentIdOrYear || "",
        bio: authUserProfile.bio || "",
        avatarInitials:
          authUserProfile.avatarInitials ||
          (authUserProfile.name ? authUserProfile.name.slice(0, 2) : "학"),
        approvalStatus: authUserProfile.approvalStatus || "approved",
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
            unreadCount: 0,
          })),
          lastMessageText: room.lastMessageText || "",
          lastMessageAt: room.lastMessageAt || "",
          createdBy: room.createdBy,
        };
      });
    }
    return state.conversations;
  }, [isRealAuthActive, authUserProfile, firestoreRooms, state.conversations]);

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
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
  }) => {
    await registerWithEmailAndPassword(params);
  };

  const handleLogin = async (email: string, password: string) => {
    await loginWithEmailAndPassword(email, password);
  };

  const handleLogout = async () => {
    await logoutUser();
    setRawFirebaseUser(null);
    setAuthUserProfile(null);
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

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      content: trimmed,
      createdAt: nowTime,
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, newMsg],
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              lastMessageText: trimmed,
              lastMessageAt: nowTime,
              members: conv.members.map((m) =>
                m.userId === currentUser.id ? { ...m, unreadCount: 0 } : m
              ),
            }
          : conv
      ),
    }));
  };

  const markConversationRead = (conversationId: string) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              members: conv.members.map((m) =>
                m.userId === currentUser.id ? { ...m, unreadCount: 0 } : m
              ),
            }
          : conv
      ),
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
          unreadCount: 1,
        },
      ],
      lastMessageText: "대화가 시작되었습니다. 첫 인사를 건네보세요!",
      lastMessageAt: nowTime,
      createdBy: currentUser.id,
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
        unreadCount: uid === currentUser.id ? 0 : 1,
      })),
      lastMessageText: `${currentUser.name}님이 단체 채팅방을 개설했습니다.`,
      lastMessageAt: nowTime,
      createdBy: currentUser.id,
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
    }
  };

  const leaveChat = async (chatId: string) => {
    if (isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved") {
      await leaveChatInFirestore(chatId, currentUser);
    }
  };

  // --- 공지사항 액션 ---
  const createNotice = (payload: {
    title: string;
    category: NoticeCategory;
    summary: string;
    content: string;
    isPinned: boolean;
    officialUrl: string;
  }) => {
    const formattedTitle = payload.title.startsWith("[예시 데이터]")
      ? payload.title
      : `[예시 데이터] ${payload.title}`;
    const newNotice: Notice = {
      id: `notice-${Date.now()}`,
      title: formattedTitle,
      category: payload.category,
      summary: payload.summary,
      content: `※ 본 게시물은 프로토타입 시연을 위한 [예시 데이터]이며 실제 동국대학교 공식 공지가 아닙니다.\n\n${payload.content}`,
      authorName: `${currentUser.name} (데모 작성)`,
      createdAt: new Date().toISOString().slice(0, 10),
      isPinned: payload.isPinned,
      isSampleData: true,
      officialUrl: payload.officialUrl || "https://www.dongguk.edu",
      viewCount: 1,
    };
    setState((prev) => ({
      ...prev,
      notices: [newNotice, ...prev.notices],
    }));
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

  // --- 졸업요건 자가점검 액션 ---
  const updateStudentCredit = (
    category: RequirementCategory,
    completedValue: number,
    userCustomTarget: number | null,
    isCompletedBoolean?: boolean
  ) => {
    const today = new Date().toISOString().slice(0, 10);
    setState((prev) => ({
      ...prev,
      studentProgress: {
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
      },
    }));
  };

  const updateStudentProfileMeta = (
    admissionYear: string,
    majorType: StudentProgress["majorType"],
    doubleMajorName: string,
    isTeacherTrack: boolean
  ) => {
    setState((prev) => ({
      ...prev,
      studentProgress: {
        ...prev.studentProgress,
        admissionYear,
        majorType,
        doubleMajorName,
        isTeacherTrack,
      },
    }));
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
    setState((prev) => {
      const updatedRecords = [
        newRec,
        ...prev.studentProgress.volunteeringRecords,
      ];
      const totalHours = updatedRecords.reduce((acc, r) => acc + r.hours, 0);
      const prevVolCredit = prev.studentProgress.credits["교육봉사 시간"];
      return {
        ...prev,
        studentProgress: {
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
        },
      };
    });
  };

  const removeVolunteeringRecord = (id: string) => {
    setState((prev) => {
      const updatedRecords = prev.studentProgress.volunteeringRecords.filter(
        (r) => r.id !== id
      );
      const totalHours = updatedRecords.reduce((acc, r) => acc + r.hours, 0);
      const prevVolCredit = prev.studentProgress.credits["교육봉사 시간"];
      return {
        ...prev,
        studentProgress: {
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
        },
      };
    });
  };

  const toggleChecklistItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      studentProgress: {
        ...prev.studentProgress,
        checklist: prev.studentProgress.checklist.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item
        ),
      },
    }));
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
    setState((prev) => ({
      ...prev,
      studentProgress: {
        ...prev.studentProgress,
        checklist: [...prev.studentProgress.checklist, newItem],
      },
    }));
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
        createMentoringRequest,
        updateMentoringStatus,
        upsertAlumniProfile,
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
