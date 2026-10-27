"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
} from "@/lib/firebase";

interface AppContextValue extends PlatformDataState {
  currentUser: User;
  currentRole: UserRole;
  isDarkMode: boolean;
  switchRole: (role: UserRole) => void;
  toggleDarkMode: () => void;
  resetDemoData: () => void;

  // Firebase Firestore 실시간 연결 상태 및 설정 액션
  isFirestoreConnected: boolean;
  firebaseProjectId: string | null;
  firestoreError: string | null;
  applyFirebaseConfig: (config: FirebaseWebConfig) => void;
  disconnectFirebaseConfig: () => void;

  // 기능 A. 대화창 액션
  sendMessage: (conversationId: string, content: string) => void;
  markConversationRead: (conversationId: string) => void;
  startOrOpenDirectChat: (targetUserId: string, categoryTag?: string) => string;
  createGroupConversation: (title: string, memberIds: string[], categoryTag?: string) => string;

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

  // 기능 E. 진로 및 복수전공 공유방 액션 (Firestore 실시간 연동 대상)
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

  // Firebase Firestore 상태
  const [firebaseVersionTick, setFirebaseVersionTick] = useState(0);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const [firebaseProjectId, setFirebaseProjectId] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = PlatformRepository.loadState();
    setState(loaded);

    // URL 파라미터(?fbProjectId=...&fbApiKey=...)가 있으면 자동으로 저장해 다른 컴퓨터에서도 즉시 연결되게 함
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

  // Firestore 실시간 구독 (학우들이 쓴 글: communityPosts)
  useEffect(() => {
    if (!hydrated) return;

    const activeConfig = getActiveFirebaseConfig();
    if (!activeConfig) {
      setIsFirestoreConnected(false);
      setFirebaseProjectId(null);
      setFirestoreError(null);
      return;
    }

    setFirebaseProjectId(activeConfig.projectId);
    setFirestoreError(null);

    const unsubscribe = subscribeToCommunityPosts(
      (cloudPosts) => {
        setIsFirestoreConnected(true);
        setFirestoreError(null);
        setState((prev) => ({
          ...prev,
          communityPosts: cloudPosts,
        }));
      },
      (errMessage) => {
        setIsFirestoreConnected(false);
        setFirestoreError(errMessage);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [hydrated, firebaseVersionTick]);

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

  const currentUser =
    state.users.find((u) => u.id === ROLE_DEFAULT_USER_ID[currentRole]) ||
    state.users[0];

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
    setFirebaseVersionTick((v) => v + 1);
  };

  // --- 대화창 액션 ---
  const sendMessage = (conversationId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
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

  const startOrOpenDirectChat = (
    targetUserId: string,
    categoryTag = "1:1 대화"
  ): string => {
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
      title: targetUser
        ? `${targetUser.name} (${targetUser.studentIdOrYear})`
        : "새로운 1:1 대화",
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
      content: `${currentUser.name}님이 ${targetUser?.name || "구성원"}님과의 대화를 시작했습니다. (로컬 데모 상태)`,
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

  const createGroupConversation = (
    title: string,
    memberIds: string[],
    categoryTag = "단체 대화방"
  ): string => {
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

  // --- 진로 및 복수전공 공유방 액션 (학우들이 쓴 글: Firestore 실시간 연동) ---
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

    // Firestore가 연결된 상태라면 클라우드 DB에도 즉시 저장
    createPostInFirestore(newPost).catch((err) => {
      setFirestoreError(
        `글 등록 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  };

  const deleteCommunityPost = (postId: string) => {
    setState((prev) => ({
      ...prev,
      communityPosts: prev.communityPosts.filter((p) => p.id !== postId),
    }));

    deletePostInFirestore(postId).catch((err) => {
      setFirestoreError(
        `글 삭제 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
      );
    });
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

    addCommentInFirestore(postId, updatedComments).catch((err) => {
      setFirestoreError(
        `댓글 등록 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
      );
    });
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

    incrementLikeInFirestore(postId, nextLikes).catch((err) => {
      setFirestoreError(
        `공감 반영 중 Firestore 오류: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  };

  // --- 가입 신청 및 관리자 액션 ---
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
