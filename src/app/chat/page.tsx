"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { ROLE_LABELS, DemoInfoBanner } from "@/components/common/Cards";
import { cn, Avatar, AvatarStack, Badge, CountBadge } from "@/components/ui";
import {
  MessageSquare,
  Send,
  Users,
  UserPlus,
  Search,
  Info,
  PlusCircle,
  Check,
  X,
  LogOut,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  GraduationCap,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  subscribeToChatMessages,
  FirestoreChatMessage,
  PublicChatUser,
  getAvatarInitials,
  saveUserCalendarEventToFirestore,
} from "@/lib/firebase";
import {
  unreadCountForMessage,
  formatUnreadBadge,
  computeMarkReadTarget,
  effectiveReadSeq,
  ReadStateRoom,
  sortConversationsByLatestMessage,
  GroupChatCategoryTab,
  sortChatUsersForGroupCreation,
  formatChatMemberHakbun,
  formatMessageDateDivider,
  formatMessageTimeDisplay,
} from "@/lib/chatReadReceipts";
import {
  UserRole,
  User,
  ConsultationStatus,
  ConsultationType,
  ConsultationRequest,
} from "@/types";

const CONSULTATION_STATUS_BADGES: Record<
  ConsultationStatus,
  { label: string; style: string }
> = {
  pending: {
    label: "신청 대기",
    style: "bg-amber-100 text-amber-800   border border-amber-200 ",
  },
  accepted: {
    label: "상담 수락됨",
    style: "bg-emerald-100 text-emerald-800   border border-emerald-200 ",
  },
  reschedule_requested: {
    label: "일정 조정 요청",
    style: "bg-blue-100 text-blue-800   border border-blue-200 ",
  },
  rejected: {
    label: "상담 거절됨",
    style: "bg-rose-100 text-rose-800   border border-rose-200 ",
  },
  completed: {
    label: "상담 완료",
    style: "bg-slate-100 text-slate-700   border border-slate-200 ",
  },
  cancelled: {
    label: "신청 취소됨",
    style: "bg-slate-100 text-slate-500   border border-slate-200 ",
  },
};

/**
 * 대화 상대 검색 및 프로필 요약 문구 생성
 * - 졸업생: "00학번 000님의 프로필입니다."
 * - 재학생: "00학번 000님의 프로필입니다."
 * - 교수: "교육학과 전임교원 000님의 프로필입니다."
 * - 관리자: "동국e음 최고관리자 000님의 프로필입니다."
 */
function formatUserChatProfileSubtitle(u: {
  role?: string;
  name?: string;
  studentIdOrYear?: string;
  bio?: string;
  specialty?: string;
}): string {
  const name = (u.name || "회원").trim();
  const raw = `${u.studentIdOrYear || ""} ${u.bio || ""}`.trim();

  // 학번 추출: "23학번", "19학번 졸업", "2023학년도 신입학 (23학번)" 등에서 2자리 학번 추출
  let hakbun = "";
  const matchHakbun = raw.match(/(\d{2})\s*학번/);
  if (matchHakbun) {
    hakbun = `${matchHakbun[1]}학번`;
  } else {
    const matchYear = raw.match(/20(\d{2})/);
    if (matchYear) {
      hakbun = `${matchYear[1]}학번`;
    } else {
      const matchOldYear = raw.match(/19(\d{2})/);
      if (matchOldYear) {
        hakbun = `${matchOldYear[1]}학번`;
      } else {
        const matchNum = raw.match(/^\d{2}/);
        if (matchNum) {
          hakbun = `${matchNum[0]}학번`;
        }
      }
    }
  }

  // 1. 졸업생 및 재학생: "00학번 000님의 프로필입니다."
  if (u.role === "student" || u.role === "alumni") {
    if (hakbun) {
      return `${hakbun} ${name}님의 프로필입니다.`;
    }
    return `${name}님의 프로필입니다.`;
  }

  // 2. 교수진: "교육학과 전임교원 000님의 프로필입니다."
  if (u.role === "professor") {
    if (u.bio && u.bio.includes("프로필입니다")) {
      return u.bio;
    }
    return `교육학과 전임교원 ${name}님의 프로필입니다.`;
  }

  // 3. 관리자
  if (u.role === "admin") {
    return "동국e음 관리자님의 프로필입니다.";
  }

  // 기본 fallback
  if (hakbun) {
    return `${hakbun} ${name}님의 프로필입니다.`;
  }
  return u.bio || `${name}님의 프로필입니다.`;
}


export default function ChatPage() {
  const {
    currentUser,
    currentRole,
    users,
    conversations,
    messages,
    sendMessage,
    markConversationRead,
    startOrOpenDirectChat,
    createGroupConversation,
    approvedMembers,
    approvedMembersLoading,
    approvedMembersError,
    refreshApprovedMembers,
    inviteUsersToChat,
    leaveChat,
    isRealAuthActive,
    authUserProfile,
    consultations,
    handleCreateConsultation,
    handleUpdateConsultationStatus,
    handleCancelConsultation,
    handleRescheduleConsultation,
    handleConnectConsultationChat,
  } = useApp();

  const isCurrentUserProfessor =
    (authUserProfile?.role || currentUser.role || currentRole) === "professor";

  const [activeConvId, setActiveConvId] = useState<string>(
    conversations[0]?.id || ""
  );
  const [messageInput, setMessageInput] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [convSearch, setConvSearch] = useState("");
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 실시간 Firestore 메시지 및 통신 오류 상태
  const [realMessages, setRealMessages] = useState<FirestoreChatMessage[]>([]);
  const [loadedRoomId, setLoadedRoomId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(true);
  const [isScrolledToLatest, setIsScrolledToLatest] = useState<boolean>(true);

  // 모달 상태: "direct" (사용자 검색 및 1:1 대화 시작) | "group" (단체 채팅방 개설) | "invite" (기존 방 새 참여자 초대) | null
  const [modalMode, setModalMode] = useState<"direct" | "group" | "invite" | null>(
    null
  );
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [groupCategoryTab, setGroupCategoryTab] =
    useState<GroupChatCategoryTab>("student");
  const [groupUserSearchQuery, setGroupUserSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [inviteSelectedIds, setInviteSelectedIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupCategory, setGroupCategory] = useState("수업/스터디 모임");

  // 상담 신청 모달 상태 (학생 -> 교수)
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [selectedProfessorForConsultation, setSelectedProfessorForConsultation] =
    useState<any>(null);
  const [consultationType, setConsultationType] =
    useState<ConsultationType>("학업 상담");
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [preferredTime, setPreferredTime] = useState("14:00");
  const [consultationPurpose, setConsultationPurpose] = useState("");
  const [isSubmittingConsultation, setIsSubmittingConsultation] = useState(false);

  // 교수용: 승인 시 상담 방식 선택 상태 (상담 ID -> "대면" | "채팅")
  const [approvalMethods, setApprovalMethods] = useState<{
    [consultId: string]: "대면" | "채팅";
  }>({});
  const [isUpdatingConsultation, setIsUpdatingConsultation] = useState(false);

  // 1. 상담 신청 확인 모달 상태
  const [isConfirmConsultationOpen, setIsConfirmConsultationOpen] = useState(false);

  // 2. 교수 상담 일정 변경 모달 상태
  const [rescheduleTarget, setRescheduleTarget] = useState<ConsultationRequest | null>(null);
  const [rescheduleNewDate, setRescheduleNewDate] = useState("");
  const [rescheduleNewTime, setRescheduleNewTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isRescheduleConfirmStep, setIsRescheduleConfirmStep] = useState(false);
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  // 3. 상담 취소 모달 상태
  const [cancelTarget, setCancelTarget] = useState<ConsultationRequest | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 브라우저 탭 가시성(visibilityState) 감지: 백그라운드 탭에서는 무조건 읽음 처리하지 않음
  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateVisibility = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("focus", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("focus", updateVisibility);
    };
  }, []);

  // 방금 사용자가 선택하거나 새로 생성한 대화방 ID 보존 (실시간 목록 동기화 지연 시 첫 번째 방으로 튕김 방지)
  const newlySelectedConvIdRef = useRef<string | null>(null);

  // URL query parameter (?convId=... 또는 ?id=..., ?consultProfessorId=...) 지원
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const qConvId = searchParams.get("convId") || searchParams.get("id");
      if (qConvId) {
        newlySelectedConvIdRef.current = qConvId;
        setActiveConvId(qConvId);
        setMobileView("thread");
      }

      const profId = searchParams.get("consultProfessorId");
      if (profId) {
        const prof =
          (approvedMembers || []).find((u) => u.id === profId) ||
          users.find((u) => u.id === profId);
        if (prof) {
          if (isCurrentUserProfessor) {
            Promise.resolve(startOrOpenDirectChat(prof.id, "교수진 1:1 대화")).then((convId: string) => {
              newlySelectedConvIdRef.current = convId;
              setActiveConvId(convId);
              markConversationRead(convId);
            });
          } else {
            setSelectedProfessorForConsultation(prof);
            setConsultationModalOpen(true);
          }
        }
      }
    }
  }, [approvedMembers, users]);

  // 대화방 목록 변경 시 기본 활성 방 유지
  useEffect(() => {
    if (conversations.length === 0) return;
    if (newlySelectedConvIdRef.current) {
      if (conversations.some((c) => c.id === newlySelectedConvIdRef.current)) {
        newlySelectedConvIdRef.current = null;
      }
      return;
    }
    if (!activeConvId || !conversations.some((c) => c.id === activeConvId)) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // 대화 가능한 사용자 풀:
  // 실제 Firebase 인증 상태이면 승인된 실제 정회원(approvedMembers)만 엄격하게 사용 (목데이터 혼입 원천 방지)
  // 비로그인 데모 상태일 때만 예시 목데이터(users) 사용
  const availableUsers: (PublicChatUser | User)[] = isRealAuthActive
    ? approvedMembers
    : users;

  const activeConversation =
    conversations.find((c) => c.id === activeConvId) || conversations[0];

  // 활성 대화방 실시간 메시지 구독 (Lazy Loading: 열려있는 1개 방만 구독하여 무료 할당량 절약)
  useEffect(() => {
    if (
      !activeConversation?.id ||
      !isRealAuthActive ||
      !authUserProfile ||
      authUserProfile.approvalStatus !== "approved"
    ) {
      setRealMessages([]);
      setLoadedRoomId(activeConversation?.id || null);
      return;
    }

    const targetRoomId = activeConversation.id;
    setLoadedRoomId(null);
    setIsScrolledToLatest(true);

    const unsub = subscribeToChatMessages(
      targetRoomId,
      50,
      (msgs) => {
        setRealMessages(msgs);
        setLoadedRoomId(targetRoomId);
        setChatError(null);
      },
      (err) => {
        setChatError(err);
      }
    );

    return () => {
      unsub();
    };
  }, [activeConversation?.id, isRealAuthActive, authUserProfile]);

  // 화면에 렌더링할 메시지 목록: Firestore 연결 시 실시간 메시지, 데모 시 로컬 메시지
  const displayMessages =
    isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved"
      ? realMessages
      : messages.filter((m) => m.conversationId === activeConversation?.id);

  // 현재 활성 대화방의 읽음 상태 계산용 객체
  const activeRoomReadState: ReadStateRoom = {
    participants: activeConversation?.memberIds || [],
    msgSeq: activeConversation?.msgSeq,
    readSeq: activeConversation?.readSeq,
    joinSeq: activeConversation?.joinSeq,
  };

  // 화면에 실제로 불러온 메시지 중 가장 큰 순번 (불러오지 않은 메시지까지 앞질러 읽음 처리 방지)
  const latestLoadedSeq = displayMessages.reduce((maxSeq: number, m: any) => {
    const s = typeof m.seq === "number" && Number.isFinite(m.seq) ? Math.floor(m.seq) : 0;
    return s > maxSeq ? s : maxSeq;
  }, 0);

  // 읽음 처리 조건 검사:
  // 1) 해당 채팅방이 현재 화면에 열려 있고(activeConversation 존재)
  // 2) 브라우저 탭이 화면에 보이는 상태이며(isPageVisible)
  // 3) 해당 방의 메시지 목록을 실제로 불러왔고(messagesLoaded)
  // 4) 사용자가 최신 메시지 영역을 보고 있을 때(isScrolledToLatest)만 읽음 처리
  useEffect(() => {
    if (!activeConversation?.id) return;
    const isRealMode =
      isRealAuthActive && authUserProfile && authUserProfile.approvalStatus === "approved";
    const messagesLoaded = isRealMode
      ? loadedRoomId === activeConversation.id
      : true;

    const currentReadSeq = effectiveReadSeq(activeRoomReadState, currentUser.id);
    const targetSeq = computeMarkReadTarget({
      isRoomOpen: Boolean(activeConversation?.id),
      isPageVisible,
      messagesLoaded,
      isScrolledToLatest,
      latestLoadedSeq:
        latestLoadedSeq > 0
          ? latestLoadedSeq
          : !isRealMode
          ? activeConversation.msgSeq || 0
          : 0,
      currentReadSeq,
    });

    if (targetSeq !== null) {
      markConversationRead(activeConversation.id, targetSeq);
    }
  }, [
    activeConversation?.id,
    activeConversation?.msgSeq,
    activeConversation?.readSeq,
    activeConversation?.joinSeq,
    isRealAuthActive,
    authUserProfile,
    loadedRoomId,
    isPageVisible,
    isScrolledToLatest,
    latestLoadedSeq,
    currentUser.id,
    markConversationRead,
  ]);

  // 새 메시지 수신 또는 전송 시 대화창 맨 아래로 스크롤 (이미 하단 근처를 보고 있을 때)
  useEffect(() => {
    if (isScrolledToLatest) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages, isScrolledToLatest]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsScrolledToLatest(distanceFromBottom <= 80);
  };

  const handleSelectConversation = (convId: string) => {
    setActiveConvId(convId);
    setIsScrolledToLatest(true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !messageInput.trim() || isSending) return;
    const textToSend = messageInput;
    setMessageInput("");
    setIsSending(true);

    try {
      await sendMessage(activeConversation.id, textToSend);
    } catch (err: any) {
      setChatError(err?.message || "메시지 전송 중 오류가 발생했습니다.");
    } finally {
      setIsSending(false);
    }
  };

  const filteredConversations = sortConversationsByLatestMessage(
    conversations
      .filter((c) => {
        // 1:1 대화방의 경우 상대방이 이미 탈퇴/삭제된 회원이면 대화 목록에서 제외
        if (!c.isGroup) {
          const otherId = c.memberIds.find((id) => id !== currentUser.id);
          if (!otherId || !availableUsers.some((u) => u.id === otherId)) {
            return false;
          }
        }
        return true;
      })
      .filter((c) => {
        const q = convSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          c.title.toLowerCase().includes(q) ||
          c.lastMessageText.toLowerCase().includes(q)
        );
      })
  );

  // 대화 상대 검색용 사용자 목록 (본인 제외, 개인정보 보호: 학번/이메일 검색 제외, 이름 및 역할/전공/진로만 검색)
  const searchableUsers = availableUsers.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const subtitle = formatUserChatProfileSubtitle(u).toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      subtitle.includes(q) ||
      (u.doubleMajor && u.doubleMajor.toLowerCase().includes(q)) ||
      (u.careerTrack && u.careerTrack.toLowerCase().includes(q))
    );
  });

  // 단체 채팅방 개설용 후보 회원 (본인 제외)
  const groupCandidates = useMemo(() => {
    return availableUsers.filter((u) => u.id !== currentUser.id);
  }, [availableUsers, currentUser.id]);

  const groupStudentsList = useMemo(() => {
    return groupCandidates.filter((u) => u.role === "student");
  }, [groupCandidates]);

  const groupAlumniList = useMemo(() => {
    return groupCandidates.filter((u) => u.role === "alumni");
  }, [groupCandidates]);

  const groupProfessorList = useMemo(() => {
    return groupCandidates.filter((u) => u.role === "professor");
  }, [groupCandidates]);

  // 단체 채팅방 모달에서 현재 선택된 탭의 검색 및 정렬 결과
  const currentTabGroupUsers = useMemo(() => {
    let list: (PublicChatUser | User)[] = [];
    if (groupCategoryTab === "student") list = groupStudentsList;
    else if (groupCategoryTab === "alumni") list = groupAlumniList;
    else if (groupCategoryTab === "professor") list = groupProfessorList;

    const q = groupUserSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => {
        const name = (u.name || "").toLowerCase();
        const subtitle = formatUserChatProfileSubtitle(u).toLowerCase();
        const hakbun = (u.studentIdOrYear || "").toLowerCase();
        const track = (u.careerTrack || "").toLowerCase();
        const major = (u.doubleMajor || "").toLowerCase();
        return (
          name.includes(q) ||
          subtitle.includes(q) ||
          hakbun.includes(q) ||
          track.includes(q) ||
          major.includes(q)
        );
      });
    }

    return sortChatUsersForGroupCreation(list, groupCategoryTab);
  }, [groupCategoryTab, groupStudentsList, groupAlumniList, groupProfessorList, groupUserSearchQuery]);

  // 1:1 대화 요청 실행
  const handleStartDirect = async (targetUserId: string) => {
    const targetUser =
      (approvedMembers || []).find((u) => u.id === targetUserId) ||
      users.find((u) => u.id === targetUserId);
    const isTargetProfessor = targetUser?.role === "professor";
    const tag =
      isCurrentUserProfessor && isTargetProfessor
        ? "교수진 1:1 대화"
        : isCurrentUserProfessor
        ? "교수-학생 면담"
        : isTargetProfessor
        ? "교수-학생 대화"
        : "학과 구성원 1:1 대화";
    try {
      const convId = await startOrOpenDirectChat(targetUserId, tag);
      newlySelectedConvIdRef.current = convId;
      setActiveConvId(convId);
      markConversationRead(convId);
      setModalMode(null);
    } catch (err: any) {
      alert(err?.message || "대화방을 생성할 수 없습니다.");
    }
  };

  // 학생용: 교수 상담 신청 버튼 클릭 시 검증 및 확인창 열기
  const handleSubmitConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfessorForConsultation) return;
    if (!preferredDate.trim()) {
      alert("희망 날짜를 선택해 주세요.");
      return;
    }
    if (!preferredTime.trim()) {
      alert("희망 시간대를 입력해 주세요 (예: 14:00 또는 수요일 오후).");
      return;
    }
    if (!consultationPurpose.trim()) {
      alert("상담 목적이나 질문 내용을 작성해 주세요.");
      return;
    }
    setIsConfirmConsultationOpen(true);
  };

  // 학생용: 확인창에서 '신청하기' 클릭 시 실제 Firestore 저장
  const handleActualSubmitConsultation = async () => {
    if (!selectedProfessorForConsultation || isSubmittingConsultation) return;
    try {
      setIsSubmittingConsultation(true);
      await handleCreateConsultation({
        professorId: selectedProfessorForConsultation.id,
        professorName: selectedProfessorForConsultation.name,
        consultationType,
        preferredDate: preferredDate.trim(),
        preferredTime: preferredTime.trim(),
        purpose: consultationPurpose.trim(),
      });
      setIsConfirmConsultationOpen(false);
      setConsultationModalOpen(false);
      setConsultationPurpose("");
      alert(
        `${selectedProfessorForConsultation.name} 교수님께 상담 신청서가 성공적으로 접수되었습니다!\n교수님이 승인하시면 바로 대화방이 시작됩니다.`
      );
    } catch (err: any) {
      alert(`상담 신청 접수 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsSubmittingConsultation(false);
    }
  };

  // 상담 취소 모달 열기
  const handleOpenCancelModal = (c: ConsultationRequest) => {
    setCancelTarget(c);
    setCancelReasonInput("");
  };

  // 상담 취소 최종 확정 및 저장
  const handleConfirmCancel = async () => {
    if (!cancelTarget || isSubmittingCancel) return;
    const trimmed = cancelReasonInput.trim();
    if (!trimmed) {
      alert("취소 사유를 입력해 주세요. (공백만 입력할 수 없습니다)");
      return;
    }
    if (trimmed.length > 500) {
      alert("취소 사유는 최대 500자까지 입력 가능합니다.");
      return;
    }
    try {
      setIsSubmittingCancel(true);
      await handleCancelConsultation(
        cancelTarget.id,
        trimmed,
        isCurrentUserProfessor ? "professor" : "student"
      );
      alert("상담이 취소 처리되었습니다.");
      setCancelTarget(null);
      setCancelReasonInput("");
    } catch (e: any) {
      alert(`신청 취소 실패: ${e?.message || e}`);
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // 교수용: 상담 일정 변경 모달 열기
  const handleOpenRescheduleModal = (c: ConsultationRequest) => {
    setRescheduleTarget(c);
    setRescheduleNewDate(c.preferredDate || new Date().toISOString().slice(0, 10));
    setRescheduleNewTime(c.preferredTime || "14:00");
    setRescheduleReason("");
    setIsRescheduleConfirmStep(false);
  };

  // 일정 변경 다음 비교 확인 단계로 진행
  const handleNextRescheduleStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleNewDate.trim()) {
      alert("변경할 상담 날짜를 선택해 주세요.");
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (rescheduleNewDate < todayStr) {
      alert("지난 날짜로는 일정을 변경할 수 없습니다.");
      return;
    }
    if (!rescheduleNewTime.trim()) {
      alert("변경할 상담 시간을 입력해 주세요.");
      return;
    }
    setIsRescheduleConfirmStep(true);
  };

  // 교수용: 일정 변경 최종 확정 및 저장
  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget || isSubmittingReschedule) return;
    try {
      setIsSubmittingReschedule(true);
      await handleRescheduleConsultation({
        consultationId: rescheduleTarget.id,
        newDate: rescheduleNewDate.trim(),
        newTime: rescheduleNewTime.trim(),
        reason: rescheduleReason.trim() || undefined,
      });
      alert("상담 일정이 성공적으로 변경되었습니다.");
      setRescheduleTarget(null);
      setIsRescheduleConfirmStep(false);
    } catch (err: any) {
      alert(`일정 변경 실패: ${err?.message || err}`);
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  // 교수용: 상담 승인 (비대면: 1:1 대화창 즉시 연결 / 대면: 상담 일정 및 캘린더 일정 생성)
  const handleProfessorApprove = async (c: ConsultationRequest) => {
    const method = approvalMethods[c.id] || "대면";
    try {
      setIsUpdatingConsultation(true);
      if (method === "채팅") {
        // 1. 비대면 상담: 대화방 생성/조회 후 즉시 대화창 활성화
        const convId = await handleConnectConsultationChat(c, "채팅");
        await handleUpdateConsultationStatus(
          c.id,
          "accepted",
          undefined,
          convId,
          "채팅"
        );
        try {
          await sendMessage(
            convId,
            `[교수 상담 승인 안내]\n안녕하세요 ${c.studentName} 학생, 신청하신 '${c.consultationType}' 비대면 상담이 승인되었습니다.\n• 진행 방식: 비대면(채팅) 상담\n• 제안 일시: ${c.preferredDate} · ${c.preferredTime}\n• 상담 질문/내용: ${c.purpose}\n\n이 대화창에서 편하게 상담을 진행해 주세요.`
          );
        } catch (sendErr) {
          console.warn("첫 안내 메시지 발송 경고:", sendErr);
        }
        newlySelectedConvIdRef.current = convId;
        setActiveConvId(convId);
        setMobileView("thread");
        markConversationRead(convId);
        alert(
          `${c.studentName} 학생의 비대면 상담을 승인했습니다.\n1:1 대화방으로 바로 연결되었습니다!`
        );
      } else {
        // 2. 대면 상담: 상태 승인 및 해당 날짜에 상담 일정(캘린더) 등록
        await handleUpdateConsultationStatus(
          c.id,
          "accepted",
          undefined,
          undefined,
          "대면"
        );
        const profId = currentUser.id || c.professorId;
        const calEvent = {
          id: `consult-cal-${c.id}`,
          userId: profId,
          title: `[대면 상담] ${c.studentName} 학생 (${c.consultationType})`,
          date: c.preferredDate,
          time: c.preferredTime || "",
          isAllDay: !c.preferredTime,
          category: "personal" as const,
          location: "교수 연구실 (대면 상담)",
          memo: `상담 목적: ${c.purpose}`,
        };
        if (profId) {
          await saveUserCalendarEventToFirestore(profId, calEvent).catch(() => {});
        }
        if (c.studentId) {
          await saveUserCalendarEventToFirestore(c.studentId, {
            ...calEvent,
            userId: c.studentId,
            title: `[대면 상담] ${c.professorName} 교수님 (${c.consultationType})`,
          }).catch(() => {});
        }
        alert(
          `${c.studentName} 학생의 대면 상담을 승인했습니다.\n[${c.preferredDate} · ${c.preferredTime}] 상담 일정이 등록되었습니다!`
        );
      }
    } catch (err: any) {
      alert(`상담 승인 처리 오류: ${err?.message || err}`);
    } finally {
      setIsUpdatingConsultation(false);
    }
  };

  // 교수용: 상담 미승인 (거절)
  const handleProfessorReject = async (c: ConsultationRequest) => {
    const reason = prompt(
      "상담 미승인 사유를 입력해 주세요 (선택 사항):",
      "일정상 상담이 어렵습니다."
    );
    if (reason === null) return;
    try {
      setIsUpdatingConsultation(true);
      await handleUpdateConsultationStatus(
        c.id,
        "rejected",
        reason || "일정상 상담이 어렵습니다."
      );
      alert(`${c.studentName} 학생의 상담이 미승인(거절) 처리되었습니다.`);
    } catch (err: any) {
      alert(`미승인 처리 오류: ${err?.message || err}`);
    } finally {
      setIsUpdatingConsultation(false);
    }
  };

  // 단체방 생성용 선택 토글
  const toggleSelectGroupUser = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // 단체방 개설 실행
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;
    try {
      const convId = await createGroupConversation(
        groupTitle.trim() || "교육학과 새 단체 채팅방",
        selectedUserIds,
        groupCategory
      );
      newlySelectedConvIdRef.current = convId;
      setActiveConvId(convId);
      setSelectedUserIds([]);
      setGroupTitle("");
      setModalMode(null);
    } catch (err: any) {
      alert(err?.message || "단체 채팅방을 개설할 수 없습니다.");
    }
  };

  // 새 참여자 초대 모달 열기
  const handleOpenInviteModal = () => {
    setInviteSelectedIds([]);
    setModalMode("invite");
  };

  // 참여자 초대 실행
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || inviteSelectedIds.length === 0) return;
    const usersToInvite = availableUsers.filter((u) =>
      inviteSelectedIds.includes(u.id)
    );
    try {
      await inviteUsersToChat(activeConversation.id, usersToInvite as any);
      setInviteSelectedIds([]);
      setModalMode(null);
    } catch (err: any) {
      alert(err?.message || "참여자 초대에 실패했습니다.");
    }
  };

  // 대화방 나가기
  const handleLeaveCurrentChat = async () => {
    if (!activeConversation) return;
    const confirmed = window.confirm(
      `'${activeConversation.title}' 대화방을 나가시겠습니까? 나가면 대화 목록에서 사라집니다.`
    );
    if (!confirmed) return;

    const leavingId = activeConversation.id;
    const remaining = conversations.filter((c) => c.id !== leavingId);

    try {
      setShowMemberPanel(false);
      // 메시지 구독 및 UI 상태를 다음 대화방으로 먼저 전환하여 리스너 권한 충돌 방지
      setActiveConvId(remaining[0]?.id || "");
      await leaveChat(leavingId);
    } catch (err: any) {
      setActiveConvId(leavingId);
      alert(err?.message || "대화방 나가기 중 오류가 발생했습니다.");
    }
  };

  // 현재 활성 대화방의 참여자 상세 목록 (탈퇴/삭제된 회원은 유령 계정 방지를 위해 제외)
  const activeMembers =
    activeConversation?.memberIds
      .map((uid) => {
        if (uid === currentUser.id) return currentUser;
        return availableUsers.find((u) => u.id === uid);
      })
      .filter((m): m is (PublicChatUser | User) => Boolean(m)) || [];

  // 학생 전용: 실존하는 교수님과의 유효 진행 중 상담만 필터링 (삭제된 교수 계정의 상담 자동 배제)
  const myActiveConsultations = useMemo(() => {
    return (consultations || []).filter((c) => {
      const isMy =
        c.studentId === currentUser.id || c.studentEmail === currentUser.email;
      const isActive =
        c.status === "pending" ||
        c.status === "accepted" ||
        c.status === "reschedule_requested";
      const profExists = availableUsers.some(
        (u) => u.id === c.professorId || u.name === c.professorName
      );
      return isMy && isActive && profExists;
    });
  }, [consultations, currentUser, availableUsers]);

  return (
    <div className="space-y-4">
      {/* 상단 타이틀 및 새 대화 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              동국e음 학과 전용 대화창
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            교수님의 재학생 면담 요청, 선후배 1:1 멘토링 대화, 학술제·스터디 단체 채팅방을 지원합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setUserSearchQuery("");
              setRoleFilter("all");
              setModalMode("direct");
              refreshApprovedMembers();
            }}
            className="h-9 px-3.5 rounded-lg bg-ink text-white hover:bg-ink/85 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> 사용자 검색 · 1:1 대화 시작
          </button>
          <button
            type="button"
            onClick={() => {
              setUserSearchQuery("");
              setGroupUserSearchQuery("");
              setSelectedUserIds([]);
              setGroupTitle("");
              setGroupCategoryTab("student");
              setModalMode("group");
              refreshApprovedMembers();
            }}
            className="h-9 px-3.5 rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> 단체 채팅방 개설
          </button>
        </div>
      </div>

      {/* 상태 배너: 데모 모드일 때만 안내하고, 실제 로그인 시에는 깔끔한 화면을 위해 안내창 숨김 */}
      {!isRealAuthActive && (
        <DemoInfoBanner
          title="로컬 데모 메신저 모드"
          description="현재 데모 계정으로 체험 중입니다. 우측 상단 로그인 메뉴에서 실제 Firebase 계정으로 로그인하시면 실제 학과 구성원과 실시간 대화를 나누실 수 있습니다."
        />
      )}

      {/* 통신 에러 배너 */}
      {(chatError || approvedMembersError) && (
        <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">{chatError || approvedMembersError}</p>
            {approvedMembersError && (
              <p className="text-[11px] text-rose-600">
                Firebase Console의 Firestore Database ➔ Rules(규칙) 탭에서 최신 보안 규칙이 정상 배포되었는지 확인해 주세요.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 교수 전용: 접수된 학생 상담 신청 관리함 */}
      {(currentUser.role === "professor" || currentRole === "professor") &&
        (consultations || []).filter((c) => c.status === "pending").length > 0 && (
          <section className="bg-white rounded-3xl border border-orange-200 p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-orange-600" />
                <h2 className="text-base font-extrabold text-slate-900">
                  접수된 학생 상담 신청
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-bold">
                  {(consultations || []).filter((c) => c.status === "pending").length}건 대기 중
                </span>
              </div>
              <p className="text-xs text-slate-500">
                상담 진행 방식(대면 / 채팅)을 선택하신 후 승인하시면 학생과의 1:1 대화방이 즉시 시작됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(consultations || []).filter((c) => c.status === "pending")
                .map((c) => {
                  const selectedMethod = approvalMethods[c.id] || "대면";
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-orange-50/40 border border-orange-200 space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm sm:text-base text-slate-900">
                              {c.studentName} 학생
                            </span>
                            {c.studentIdOrYear && (
                              <span className="text-xs text-slate-500 font-semibold">
                                ({c.studentIdOrYear})
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold text-xs">
                              {c.consultationType}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <Clock className="w-3.5 h-3.5 text-orange-600" />
                            <span>희망 일시: {c.preferredDate} · {c.preferredTime}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white text-xs text-slate-700 leading-relaxed border border-orange-100">
                        <span className="font-bold text-slate-900">상담 목적: </span>
                        {c.purpose}
                      </div>

                      {/* 상담 유형(진행 방식) 선택: 대면 vs 채팅 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          상담 진행 방식 선택 *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setApprovalMethods((prev) => ({
                                ...prev,
                                [c.id]: "대면",
                              }))
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                              selectedMethod === "대면"
                                ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                                : "bg-white  text-slate-600  border-slate-200  hover:border-slate-300"
                            }`}
                          >
                            🏫 대면 상담
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setApprovalMethods((prev) => ({
                                ...prev,
                                [c.id]: "채팅",
                              }))
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                              selectedMethod === "채팅"
                                ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                                : "bg-white  text-slate-600  border-slate-200  hover:border-slate-300"
                            }`}
                          >
                            💬 채팅 상담
                          </button>
                        </div>
                      </div>

                      {/* 승인 / 미승인 버튼 */}
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-orange-200/60">
                        <button
                          type="button"
                          disabled={isUpdatingConsultation}
                          onClick={() => handleOpenCancelModal(c)}
                          className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-white transition disabled:opacity-50 cursor-pointer"
                        >
                          미승인 (거절/취소)
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingConsultation}
                          onClick={() => handleProfessorApprove(c)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> 승인 및 대화 시작
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

      {/* 학생 전용: 나의 상담 신청 현황 */}
      {(currentUser.role === "student" || currentRole === "student") &&
        myActiveConsultations.length > 0 && (
          <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  나의 교수 상담 신청 현황
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                진행 중 {myActiveConsultations.length}건
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myActiveConsultations.map((c) => {
                  const st = CONSULTATION_STATUS_BADGES[c.status];
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">
                            {c.professorName} 교수님
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 font-bold text-xs">
                            {c.consultationType}
                          </span>
                          {c.rescheduledAt && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              일정 변경됨
                            </span>
                          )}
                          {st && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.style}`}
                            >
                              {st.label}
                            </span>
                          )}
                        </div>
                        {c.consultationMethod && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs">
                            {c.consultationMethod} 상담
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <p>
                          희망/확정 일정: <strong>{c.preferredDate} · {c.preferredTime}</strong>
                        </p>
                        {c.rescheduleHistory && c.rescheduleHistory.length > 0 && (
                          <p className="text-[11px] text-slate-400">
                            (변경 전: {c.rescheduleHistory[c.rescheduleHistory.length - 1].previousDate} {c.rescheduleHistory[c.rescheduleHistory.length - 1].previousTime})
                          </p>
                        )}
                        {c.cancelReason && (
                          <p className="p-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-100">
                            취소 사유 ({c.cancelledBy === "professor" ? "교수님 취소" : "학생 취소"}): {c.cancelReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 flex-wrap">
                        {(c.status === "pending" || c.status === "accepted") && (
                          <button
                            type="button"
                            onClick={() => handleOpenCancelModal(c)}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs transition cursor-pointer"
                          >
                            상담 취소
                          </button>
                        )}
                        {c.status === "accepted" && c.conversationId && (
                          <button
                            type="button"
                            onClick={() => {
                              newlySelectedConvIdRef.current = c.conversationId!;
                              setActiveConvId(c.conversationId!);
                              markConversationRead(c.conversationId!);
                            }}
                            className="px-3.5 py-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            1:1 대화방으로 바로 이동
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

      {/* 메인 메신저 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 bg-surface rounded-3xl border border-line overflow-hidden shadow-xs min-h-[580px]">
        {/* 좌측: 대화방 목록 */}
        <div className={cn(
          "lg:col-span-4 border-b lg:border-b-0 lg:border-r border-line flex flex-col min-h-0",
          mobileView === "list" ? "flex" : "hidden lg:flex"
        )}>
          <div className="p-3.5 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder="대화방 이름 또는 메시지 검색..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[260px] lg:max-h-[520px]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                참여 중인 대화방이 없습니다. 상단에서 새로운 대화를 시작해 보세요.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConversation?.id;
                const myMember = conv.members.find(
                  (m) => m.userId === currentUser.id
                );
                const unread = myMember?.unreadCount || 0;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition ${
                      isSelected ? "bg-accent-soft/40 border-l-3 border-[#f58220]" : "hover:bg-surface-2"
                    }`}
                  >
                    <div className={`w-10 h-10 font-bold text-xs flex items-center justify-center shrink-0 ${
                      conv.isGroup
                        ? "rounded-xl bg-surface-3 text-ink-2"
                        : "rounded-full bg-accent-soft text-accent"
                    }`}>
                      {conv.isGroup ? <Users className="w-4 h-4" /> : conv.title.slice(0, 1)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h2 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {conv.title}
                        </h2>
                        {conv.categoryTag && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 shrink-0">
                            {conv.categoryTag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {conv.lastMessageText || "대화를 시작해 보세요."}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-slate-400">
                        {conv.lastMessageAt}
                      </span>
                      {unread > 0 && (
                        <span
                          data-testid={`room-unread-badge-${conv.id}`}
                          className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold"
                        >
                          안읽음 {formatUnreadBadge(unread)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 우측: 활성 대화 화면 */}
        <div className={cn(
          "lg:col-span-8 flex flex-col justify-between bg-surface-2 min-h-0",
          mobileView === "thread" ? "flex" : "hidden lg:flex"
        )}>
          {activeConversation ? (
            <>
              {/* 대화방 상단 헤더 */}
              <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-900">
                      {activeConversation.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                      참여자 {activeConversation.memberIds.length}명
                    </span>
                    {activeConversation.isGroup && (
                      <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-xs font-bold">
                        단체방
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    참여 중:{" "}
                    {activeMembers
                      .map((m) => `${m?.name}(${ROLE_LABELS[m!.role] || "구성원"})`)
                      .join(", ")}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleLeaveCurrentChat}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 inline-flex items-center gap-1 transition cursor-pointer"
                    title="대화방 나가기"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>방 나가기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMemberPanel((prev) => !prev)}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-orange-600" />
                    <span>참여자 {showMemberPanel ? "닫기" : "보기"}</span>
                  </button>
                </div>
              </div>

              {/* 참여자 상세 정보 접이식 패널 */}
              {showMemberPanel && (
                <div className="bg-orange-50/70 border-b border-orange-200 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-orange-600" /> 채팅방 참여 구성원 ({activeMembers.length}명)
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={handleOpenInviteModal}
                        className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> 새 참여자 초대
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeMembers.map((member) => {
                      if (!member) return null;
                      const hakbun = formatChatMemberHakbun(member);
                      return (
                        <div
                          key={member.id}
                          className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">
                              {member.name}{" "}
                              <span className="text-orange-600 font-semibold">
                                ({ROLE_LABELS[member.role] || "구성원"})
                              </span>
                            </p>
                            {hakbun ? (
                              <p className="text-slate-500 text-[11px] font-medium">
                                {hakbun}
                              </p>
                            ) : null}
                          </div>
                          {member.role !== "admin" && member.role !== "professor" && member.careerTrack && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              {member.careerTrack}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 메시지 스트림 */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]"
              >
                {displayMessages.map((msg: any, idx: number) => {
                  const baseDateStr =
                    activeConversation?.createdAt ||
                    activeConversation?.lastMessageIso ||
                    activeConversation?.lastMessageAt;
                  const currentDateDivider = formatMessageDateDivider(msg, baseDateStr);
                  const prevDateDivider =
                    idx > 0
                      ? formatMessageDateDivider(displayMessages[idx - 1], baseDateStr)
                      : null;
                  const showDateDivider =
                    Boolean(currentDateDivider && currentDateDivider !== prevDateDivider);
                  const formattedTime =
                    formatMessageTimeDisplay(msg.createdAt) || msg.createdAt;

                  return (
                    <React.Fragment key={msg.id || `msg-${idx}`}>
                      {showDateDivider && (
                        <div
                          data-testid={`chat-date-divider-${msg.id || idx}`}
                          className="flex items-center justify-center my-4 py-1 select-none"
                          role="separator"
                          aria-label={currentDateDivider!}
                        >
                          <div className="flex-1 h-[1px] bg-slate-200" />
                          <span className="px-3.5 py-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full mx-2 shadow-2xs whitespace-nowrap">
                            {currentDateDivider}
                          </span>
                          <div className="flex-1 h-[1px] bg-slate-200" />
                        </div>
                      )}

                      {msg.isSystemMessage ? (
                        <div className="text-center my-2">
                          <span className="inline-block px-3 py-1 rounded-full bg-slate-200/80 text-slate-600 text-[11px]">
                            {msg.content}
                          </span>
                        </div>
                      ) : (() => {
                        const isMe = msg.senderId === currentUser.id;
                        const sender = availableUsers.find((u) => u.id === msg.senderId);
                        const senderDisplayName =
                          msg.senderName || sender?.name || "구성원";
                        const senderDisplayRole = msg.senderRole
                          ? ROLE_LABELS[msg.senderRole as UserRole]
                          : sender
                          ? ROLE_LABELS[sender.role]
                          : "";
                        const msgUnreadCount = unreadCountForMessage(
                          msg,
                          activeRoomReadState
                        );

                        return (
                          <div
                            className={`flex flex-col ${
                              isMe ? "items-end" : "items-start"
                            }`}
                          >
                            {!isMe && (
                              <span className="text-[11px] font-semibold text-slate-500 mb-1 ml-1">
                                {senderDisplayName}
                                {senderDisplayRole ? ` · ${senderDisplayRole}` : ""}
                              </span>
                            )}
                            <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[75%]">
                              {isMe && (
                                <div className="flex flex-col items-end justify-end leading-tight shrink-0 gap-0.5">
                                  {msgUnreadCount > 0 && (
                                    <span
                                      data-testid={`msg-unread-count-${msg.id}`}
                                      title={`아직 읽지 않은 참여자 ${msgUnreadCount}명`}
                                      className="text-[11px] font-bold text-amber-600 tabular-nums"
                                    >
                                      {msgUnreadCount}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                    {formattedTime}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs break-words ${
                                  isMe
                                    ? "bg-[#f58220] text-white font-medium rounded-br-xs shadow-xs"
                                    : "bg-white  text-slate-800  border border-slate-200  rounded-bl-xs"
                                }`}
                              >
                                {msg.content}
                              </div>
                              {!isMe && (
                                <div className="flex flex-col items-start justify-end leading-tight shrink-0 gap-0.5">
                                  {msgUnreadCount > 0 && (
                                    <span
                                      data-testid={`msg-unread-count-${msg.id}`}
                                      title={`아직 읽지 않은 참여자 ${msgUnreadCount}명`}
                                      className="text-[11px] font-bold text-amber-600 tabular-nums"
                                    >
                                      {msgUnreadCount}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                    {formattedTime}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* 메시지 입력 폼 */}
              <form
                onSubmit={handleSend}
                className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={`${currentUser.name}(${ROLE_LABELS[currentUser.role]})님으로 메시지 입력...`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || isSending}
                  className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 shadow-raise transition cursor-pointer"
                >
                  <Send className="w-4 h-4" /> {isSending ? "전송중..." : "전송"}
                </button>
              </form>
            </>
          ) : (
            <div className="p-12 text-center text-sm text-slate-500">
              좌측에서 대화방을 선택하거나 새로운 대화를 시작하세요.
            </div>
          )}
        </div>
      </div>

      {/* 모달 1: 사용자 검색 및 1:1 대화 시작 */}
      {modalMode === "direct" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  학과 구성원 검색 및 1:1 대화 요청
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isCurrentUserProfessor
                    ? "교수진 간 연구·학사 소통 및 학생 면담 대화를 바로 시작할 수 있습니다."
                    : "교수님의 특정 학생 면담 요청, 재학생과 졸업생 간 멘토링 대화를 바로 시작할 수 있습니다."}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => refreshApprovedMembers()}
                  title="회원 목록 새로고침"
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-orange-600 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${approvedMembersLoading ? "animate-spin text-orange-600" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1.5 rounded-lg bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="이름, 복수전공, 진로 분야 검색..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: "all", label: "전체 구성원" },
                  { key: "student", label: "재학생" },
                  { key: "alumni", label: "졸업생" },
                  { key: "professor", label: "교수진" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setRoleFilter(tab.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      roleFilter === tab.key
                        ? "bg-orange-600 text-white"
                        : "bg-slate-100  text-slate-600 "
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {approvedMembersError ? (
                <div className="p-4 text-center text-xs text-rose-500 space-y-1">
                  <p className="font-bold">회원 목록 조회 오류</p>
                  <p className="text-[11px]">{approvedMembersError}</p>
                  <p className="text-[10px] text-slate-400">Firebase 콘솔에서 최신 Firestore 보안 규칙을 게시했는지 확인해 주세요.</p>
                </div>
              ) : approvedMembersLoading ? (
                <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin text-orange-600" />
                  <p>승인된 학과 구성원 목록을 실시간으로 불러오는 중입니다...</p>
                </div>
              ) : availableUsers.filter((u) => u.id !== currentUser.id).length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <Users className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                  <p className="font-semibold text-slate-600">대화 가능한 다른 승인 회원이 아직 없습니다.</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    본인 계정({currentUser.name} 님)은 자기 자신에게 대화할 수 없어 목록에서 제외됩니다.<br />
                    관리자가 다른 회원의 가입을 승인하거나, 관리자 계정과 1:1 대화를 진행할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => refreshApprovedMembers()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs text-slate-700 hover:bg-slate-200 font-bold transition mt-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> 목록 다시 불러오기
                  </button>
                </div>
              ) : searchableUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  '{userSearchQuery}' 검색 조건과 일치하는 승인 회원이 없습니다.
                </div>
              ) : (
                searchableUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900">
                          {u.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-bold">
                          {ROLE_LABELS[u.role] || "구성원"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatUserChatProfileSubtitle(u)}
                      </p>
                    </div>

                    {u.role === "professor" && !isCurrentUserProfessor ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProfessorForConsultation(u);
                          setConsultationModalOpen(true);
                          setModalMode(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-accent-soft text-accent hover:bg-brand-100 border border-brand-200/70 text-xs font-semibold shrink-0 transition flex items-center gap-1 cursor-pointer"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        상담신청
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartDirect(u.id)}
                        className="px-3 py-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 text-xs font-semibold shrink-0 transition shadow-2xs cursor-pointer"
                      >
                        대화 요청
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 단체 채팅방 개설 */}
      {modalMode === "group" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  단체 채팅방 개설
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  여러 명의 재학생·졸업생·교수진을 선택해 스터디나 프로젝트 단체방을 만드세요.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => refreshApprovedMembers()}
                  title="회원 목록 새로고침"
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-orange-600 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${approvedMembersLoading ? "animate-spin text-orange-600" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1.5 rounded-lg bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold mb-1">단체 채팅방 이름</label>
                <input
                  type="text"
                  required
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="예: 교육공학 팀프로젝트 3조 / 임용 교육학 논술 스터디"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">대화방 성격 태그</label>
                <select
                  value={groupCategory}
                  onChange={(e) => setGroupCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <option value="수업/스터디 모임">수업/스터디 모임</option>
                  <option value="학술제/연구 분과">학술제/연구 분과</option>
                  <option value="진로 멘토링 그룹">진로 멘토링 그룹</option>
                  <option value="학과 자치/소모임">학과 자치/소모임</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold">
                    초대할 구성원 선택 ({selectedUserIds.length}명 선택됨)
                  </label>
                  {selectedUserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      전체 선택 해제
                    </button>
                  )}
                </div>

                {/* 회원 검색창 */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={groupUserSearchQuery}
                    onChange={(e) => setGroupUserSearchQuery(e.target.value)}
                    placeholder="이름, 학번, 전공, 진로 분야 검색..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  {groupUserSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGroupUserSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 3대 카테고리 탭: 재학생, 졸업생, 교수진 */}
                <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {[
                    { key: "student" as const, label: "재학생", count: groupStudentsList.length },
                    { key: "alumni" as const, label: "졸업생", count: groupAlumniList.length },
                    { key: "professor" as const, label: "교수진", count: groupProfessorList.length },
                  ].map((tab) => {
                    const isActive = groupCategoryTab === tab.key;
                    const tabUserIds = (
                      tab.key === "student"
                        ? groupStudentsList
                        : tab.key === "alumni"
                        ? groupAlumniList
                        : groupProfessorList
                    ).map((u) => u.id);
                    const selectedInTabCount = selectedUserIds.filter((id) =>
                      tabUserIds.includes(id)
                    ).length;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setGroupCategoryTab(tab.key)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          isActive
                            ? "bg-white text-orange-600 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                            isActive
                              ? "bg-orange-100 text-orange-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {tab.count}
                        </span>
                        {selectedInTabCount > 0 && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-orange-600"
                            title={`${selectedInTabCount}명 선택됨`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 회원 선택 목록 (카테고리별 정렬 적용) */}
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white">
                  {approvedMembersError ? (
                    <div className="p-4 text-center text-xs text-rose-500">
                      회원 목록 조회 오류: {approvedMembersError}
                    </div>
                  ) : approvedMembersLoading ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      승인 회원 목록을 불러오는 중...
                    </div>
                  ) : currentTabGroupUsers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                      <Users className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                      <p className="font-semibold text-slate-600">해당하는 회원이 없습니다.</p>
                      {groupUserSearchQuery.trim() && (
                        <p className="text-[11px] text-slate-400">검색 조건에 맞는 회원이 없습니다.</p>
                      )}
                    </div>
                  ) : (
                    currentTabGroupUsers.map((u) => {
                      const checked = selectedUserIds.includes(u.id);
                      const hakbunLabel = formatChatMemberHakbun(u);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleSelectGroupUser(u.id)}
                          className={`w-full text-left p-3 flex items-center justify-between transition cursor-pointer ${
                            checked
                              ? "bg-orange-50/70"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                              {u.avatarInitials || getAvatarInitials(u.name, u.role)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {u.name}
                                </span>
                                {hakbunLabel && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                    {hakbunLabel}
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-400">
                                  {ROLE_LABELS[u.role] || "구성원"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate max-w-[260px]">
                                {u.careerTrack || u.doubleMajor || u.specialty || formatUserChatProfileSubtitle(u)}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition ${
                              checked
                                ? "bg-orange-600 border-orange-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={selectedUserIds.length === 0}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-raise transition cursor-pointer"
                >
                  채팅방 생성하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 3: 기존 채팅방 새 참여자 초대 */}
      {modalMode === "invite" && activeConversation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  새 참여자 초대
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  '{activeConversation.title}' 대화방에 학과 구성원을 추가로 초대합니다.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => refreshApprovedMembers()}
                  title="회원 목록 새로고침"
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-orange-600 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${approvedMembersLoading ? "animate-spin text-orange-600" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1.5 rounded-lg bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold mb-1">
                  초대할 구성원 선택 ({inviteSelectedIds.length}명 선택됨)
                </label>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                  {approvedMembersError ? (
                    <div className="p-4 text-center text-xs text-rose-500">
                      회원 목록 조회 오류: {approvedMembersError}
                    </div>
                  ) : approvedMembersLoading ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      승인 회원 목록을 불러오는 중...
                    </div>
                  ) : availableUsers.filter((u) => !activeConversation.memberIds.includes(u.id)).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      초대 가능한 다른 승인 회원이 아직 없습니다.
                    </div>
                  ) : (
                    availableUsers
                      .filter((u) => !activeConversation.memberIds.includes(u.id))
                      .map((u) => {
                        const checked = inviteSelectedIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setInviteSelectedIds((prev) =>
                                prev.includes(u.id)
                                  ? prev.filter((id) => id !== u.id)
                                  : [...prev, u.id]
                              );
                            }}
                            className={`w-full text-left p-3 flex items-center justify-between transition ${
                              checked
                                ? "bg-orange-50 "
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div>
                              <span className="font-bold text-slate-900">
                                {u.name}
                              </span>{" "}
                              <span className="text-xs text-slate-500">
                                ({ROLE_LABELS[u.role] || "구성원"}
                                {u.careerTrack ? ` · ${u.careerTrack}` : ""})
                              </span>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                checked
                                  ? "bg-orange-600 border-orange-600 text-white"
                                  : "border-slate-300 "
                              }`}
                            >
                              {checked && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={inviteSelectedIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold transition"
                >
                  선택한 {inviteSelectedIds.length}명 초대하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 4: 교수 상담 신청 (학생 -> 교수) */}
      {consultationModalOpen && selectedProfessorForConsultation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  교수 상담 신청
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConsultationModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 교수 정보 요약 */}
            <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-100 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent-soft text-accent font-extrabold text-sm flex items-center justify-center shrink-0">
                {getAvatarInitials(selectedProfessorForConsultation.name, selectedProfessorForConsultation.role) ||
                  selectedProfessorForConsultation.avatarInitials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900">
                    {selectedProfessorForConsultation.name} 교수님
                  </span>
                  <span className="text-xs text-orange-700 font-bold">
                    {selectedProfessorForConsultation.specialty ||
                      "교육학과 전임교원"}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  동국대학교 사범대학 교육학과
                  {selectedProfessorForConsultation.specialty
                    ? ` · ${selectedProfessorForConsultation.specialty}`
                    : ""}
                </p>
              </div>
            </div>

            {/* 상담 신청 폼 */}
            <form onSubmit={handleSubmitConsultation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  상담 유형 선택 *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      "학업 상담",
                      "진로 상담",
                      "복수전공 상담",
                      "대학원 진학 상담",
                      "기타",
                    ] as ConsultationType[]
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setConsultationType(type)}
                      className={`p-2 rounded-xl font-bold border transition text-center ${
                        consultationType === type
                          ? "border-orange-600 bg-orange-50  text-orange-700  shadow-2xs"
                          : "border-slate-200  text-slate-600  hover:border-slate-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    희망 날짜 (학생 제안) *
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    희망 시간대 (학생 제안) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 14:00 또는 수요일 오후"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  상담 목적 또는 질문 내용 *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="교수님께 여쭙고 싶은 내용이나 상담 목적을 구체적으로 적어주세요."
                  value={consultationPurpose}
                  onChange={(e) => setConsultationPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200 text-[11px] text-slate-600 leading-relaxed">
                <span className="font-bold text-orange-800">💡 안내: </span>
                교수님이 신청서를 확인하시고 상담 진행 방식(대면 또는 채팅)을 선택하여 승인하시면, 1:1 대화방이 즉시 개설됩니다.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConsultationModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConsultation}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-raise transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingConsultation ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      접수 처리 중...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      상담 신청서 제출
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. 상담 신청 전 확인 모달 */}
      {/* ========================================================= */}
      {isConfirmConsultationOpen && selectedProfessorForConsultation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  상담을 신청하시겠습니까?
                </h3>
                <p className="text-xs text-slate-500">
                  신청 내용을 확인하신 후 신청하기를 눌러주세요.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">상담 교수</span>
                <span className="font-bold text-slate-900">
                  {selectedProfessorForConsultation.name} 교수님
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">상담 유형</span>
                <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold">
                  {consultationType}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">희망 날짜</span>
                <span className="font-bold text-slate-900">{preferredDate}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">희망 시간</span>
                <span className="font-bold text-slate-900">{preferredTime}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-500 font-semibold block mb-1">상담 목적 및 질문</span>
                <p className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {consultationPurpose}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmittingConsultation}
                onClick={() => setIsConfirmConsultationOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isSubmittingConsultation}
                onClick={handleActualSubmitConsultation}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingConsultation ? "신청 저장 중..." : "신청하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. 교수용: 일정 변경 모달 */}
      {/* ========================================================= */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {!isRescheduleConfirmStep ? (
              <form onSubmit={handleNextRescheduleStep} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <h3 className="text-base font-extrabold text-slate-900">
                      상담 일정 변경
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRescheduleTarget(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <p className="text-slate-600">
                    상담 대상:{" "}
                    <strong className="text-slate-900">{rescheduleTarget.studentName} 학생</strong> (
                    {rescheduleTarget.consultationType})
                  </p>
                  <p className="text-slate-600">
                    현재 확정 일정:{" "}
                    <strong className="text-orange-600">
                      {rescheduleTarget.preferredDate} · {rescheduleTarget.preferredTime}
                    </strong>
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      변경할 날짜 *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={rescheduleNewDate}
                      onChange={(e) => setRescheduleNewDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      변경할 시간 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 15:00 또는 오후 3시"
                      value={rescheduleNewTime}
                      onChange={(e) => setRescheduleNewTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      변경 사유 (선택)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 학과 일정 조정으로 시간 변경"
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRescheduleTarget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    변경 내용 확인
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    상담 일정을 변경하시겠습니까?
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200">
                      <span className="block text-[11px] font-bold text-rose-700 mb-1">
                        변경 전 일정
                      </span>
                      <p className="font-extrabold text-slate-800">
                        {rescheduleTarget.preferredDate}
                      </p>
                      <p className="text-xs text-slate-600">
                        {rescheduleTarget.preferredTime}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-300">
                      <span className="block text-[11px] font-bold text-emerald-800 mb-1">
                        변경 후 일정
                      </span>
                      <p className="font-extrabold text-emerald-950">
                        {rescheduleNewDate}
                      </p>
                      <p className="text-xs text-emerald-800">
                        {rescheduleNewTime}
                      </p>
                    </div>
                  </div>

                  {rescheduleReason.trim() && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 block mb-0.5">
                        변경 사유
                      </span>
                      <p className="text-slate-800">{rescheduleReason.trim()}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSubmittingReschedule}
                    onClick={() => setIsRescheduleConfirmStep(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    이전으로
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingReschedule}
                    onClick={handleConfirmReschedule}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingReschedule ? "일정 저장 중..." : "일정 변경 확정"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. 상담 취소 모달 */}
      {/* ========================================================= */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-slate-900">
                  상담을 취소하시겠습니까?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="text-slate-600">
                상담 정보:{" "}
                <strong className="text-slate-900">
                  {isCurrentUserProfessor ? `${cancelTarget.studentName} 학생` : `${cancelTarget.professorName} 교수님`}
                </strong>{" "}
                · {cancelTarget.consultationType}
              </p>
              <p className="text-slate-600">
                예정 일시:{" "}
                <strong className="text-slate-900">
                  {cancelTarget.preferredDate} · {cancelTarget.preferredTime}
                </strong>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">
                취소 사유 입력 <span className="text-rose-500">* (필수)</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {[
                  "개인 일정 변경",
                  "부득이한 사정",
                  "학사 및 학과 일정 중복",
                  "기타 사유",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCancelReasonInput(chip)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold transition cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                required
                maxLength={500}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="취소 사유를 직접 작성해 주세요. (공백 제외 필수, 최대 500자)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>공백만 입력된 경우 취소할 수 없습니다.</span>
                <span className={cancelReasonInput.length > 500 ? "text-rose-600 font-bold" : ""}>
                  {cancelReasonInput.length} / 500자
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isSubmittingCancel || !cancelReasonInput.trim()}
                onClick={handleConfirmCancel}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingCancel ? "취소 처리 중..." : "상담 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
