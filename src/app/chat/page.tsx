"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { ROLE_LABELS, DemoInfoBanner } from "@/components/common/Cards";
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
  RefreshCw,
} from "lucide-react";
import {
  subscribeToChatMessages,
  FirestoreChatMessage,
  PublicChatUser,
} from "@/lib/firebase";
import { UserRole, User } from "@/types";

export default function ChatPage() {
  const {
    currentUser,
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
  } = useApp();

  const [activeConvId, setActiveConvId] = useState<string>(
    conversations[0]?.id || ""
  );
  const [messageInput, setMessageInput] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 실시간 Firestore 메시지 및 통신 오류 상태
  const [realMessages, setRealMessages] = useState<FirestoreChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  // 모달 상태: "direct" (사용자 검색 및 1:1 대화 시작) | "group" (단체 채팅방 개설) | "invite" (기존 방 새 참여자 초대) | null
  const [modalMode, setModalMode] = useState<"direct" | "group" | "invite" | null>(
    null
  );
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [inviteSelectedIds, setInviteSelectedIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupCategory, setGroupCategory] = useState("수업/스터디 모임");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 대화방 목록 변경 시 기본 활성 방 유지
  useEffect(() => {
    if (conversations.length > 0 && !conversations.some((c) => c.id === activeConvId)) {
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
      return;
    }

    const unsub = subscribeToChatMessages(
      activeConversation.id,
      50,
      (msgs) => {
        setRealMessages(msgs);
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

  // 새 메시지 수신 또는 전송 시 대화창 맨 아래로 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  const handleSelectConversation = (convId: string) => {
    setActiveConvId(convId);
    markConversationRead(convId);
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

  const filteredConversations = conversations.filter((c) => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.lastMessageText.toLowerCase().includes(q)
    );
  });

  // 대화 상대 검색용 사용자 목록 (본인 제외, 개인정보 보호: 학번/이메일 검색 제외, 이름 및 역할/전공/진로만 검색)
  const searchableUsers = availableUsers.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      (u.doubleMajor && u.doubleMajor.toLowerCase().includes(q)) ||
      (u.careerTrack && u.careerTrack.toLowerCase().includes(q))
    );
  });

  // 1:1 대화 요청 실행
  const handleStartDirect = async (targetUserId: string) => {
    const tag =
      currentUser.role === "professor"
        ? "교수-학생 면담"
        : "학과 구성원 1:1 대화";
    try {
      const convId = await startOrOpenDirectChat(targetUserId, tag);
      setActiveConvId(convId);
      markConversationRead(convId);
      setModalMode(null);
    } catch (err: any) {
      alert(err?.message || "대화방을 생성할 수 없습니다.");
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

    try {
      await leaveChat(activeConversation.id);
      const remaining = conversations.filter((c) => c.id !== activeConversation.id);
      setActiveConvId(remaining[0]?.id || "");
      setShowMemberPanel(false);
    } catch (err: any) {
      alert(err?.message || "대화방 나가기 중 오류가 발생했습니다.");
    }
  };

  // 현재 활성 대화방의 참여자 상세 목록
  const activeMembers =
    activeConversation?.memberIds
      .map((uid) => {
        if (uid === currentUser.id) return currentUser;
        return (
          availableUsers.find((u) => u.id === uid) || {
            id: uid,
            name: "학과 구성원",
            role: "student" as UserRole,
            avatarInitials: "학",
            email: "",
            approvalStatus: "approved" as const,
            joinedAt: "",
            bio: "",
            doubleMajor: "",
            careerTrack: undefined,
          }
        );
      })
      .filter(Boolean) || [];

  return (
    <div className="space-y-4">
      {/* 상단 타이틀 및 새 대화 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              동국e음 학과 전용 대화창
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
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
            className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition shadow-xs"
          >
            <UserPlus className="w-4 h-4" /> 사용자 검색 · 1:1 대화 시작
          </button>
          <button
            type="button"
            onClick={() => {
              setUserSearchQuery("");
              setSelectedUserIds([]);
              setGroupTitle("");
              setModalMode("group");
              refreshApprovedMembers();
            }}
            className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition shadow-xs"
          >
            <PlusCircle className="w-4 h-4" /> 단체 채팅방 개설
          </button>
        </div>
      </div>

      {/* 상태 배너: 실제 Firestore 동기화 연결 상태 안내 */}
      {isRealAuthActive && authUserProfile?.approvalStatus === "approved" ? (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold">
              Firestore 실시간 채팅 연동 활성화
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 text-xs hidden sm:inline">
              · 승인된 회원 목록과 주고받는 메시지가 실시간으로 자동 동기화됩니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => refreshApprovedMembers()}
            title="회원 목록 새로고침"
            className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <DemoInfoBanner
          title="로컬 데모 메신저 모드"
          description="현재 데모 계정으로 체험 중입니다. 우측 상단 로그인 메뉴에서 실제 Firebase 계정으로 로그인하시면 실제 학과 구성원과 실시간 대화를 나누실 수 있습니다."
        />
      )}

      {/* 통신 에러 배너 */}
      {(chatError || approvedMembersError) && (
        <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">{chatError || approvedMembersError}</p>
            {approvedMembersError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                Firebase Console의 Firestore Database ➔ Rules(규칙) 탭에서 최신 보안 규칙이 정상 배포되었는지 확인해 주세요.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 메인 메신저 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs min-h-[580px]">
        {/* 좌측: 대화방 목록 */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder="대화방 이름 또는 메시지 검색..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[260px] lg:max-h-[520px]">
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
                      isSelected
                        ? "bg-orange-50/80 dark:bg-orange-950/30 border-l-4 border-orange-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      {conv.isGroup ? <Users className="w-4 h-4" /> : conv.title.slice(0, 1)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h2 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {conv.title}
                        </h2>
                        {conv.categoryTag && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                            {conv.categoryTag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {conv.lastMessageText || "대화를 시작해 보세요."}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-slate-400">
                        {conv.lastMessageAt}
                      </span>
                      {unread > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold">
                          안읽음 {unread}
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
        <div className="lg:col-span-8 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-950/30">
          {activeConversation ? (
            <>
              {/* 대화방 상단 헤더 */}
              <div className="bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      {activeConversation.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                      참여자 {activeConversation.memberIds.length}명
                    </span>
                    {activeConversation.isGroup && (
                      <span className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-xs font-bold">
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

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowMemberPanel((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition"
                  >
                    <Info className="w-3.5 h-3.5 text-orange-600" />
                    참여자 {showMemberPanel ? "닫기" : "관리"}
                  </button>
                </div>
              </div>

              {/* 참여자 상세 정보 접이식 패널 */}
              {showMemberPanel && (
                <div className="bg-orange-50/70 dark:bg-slate-900 border-b border-orange-200 dark:border-slate-800 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-orange-600" /> 채팅방 참여 구성원 ({activeMembers.length}명)
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenInviteModal}
                        className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> 새 참여자 초대
                      </button>
                      <button
                        type="button"
                        onClick={handleLeaveCurrentChat}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" /> 방 나가기
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeMembers.map((member) =>
                      member ? (
                        <div
                          key={member.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {member.name}{" "}
                              <span className="text-orange-600 font-semibold">
                                ({ROLE_LABELS[member.role] || "구성원"})
                              </span>
                            </p>
                            <p className="text-slate-500 text-[11px]">
                              {member.doubleMajor ? `복전: ${member.doubleMajor}` : ""}
                            </p>
                          </div>
                          {member.careerTrack && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                              {member.careerTrack}
                            </span>
                          )}
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* 메시지 스트림 */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
                {displayMessages.map((msg: any) => {
                  if (msg.isSystemMessage) {
                    return (
                      <div key={msg.id} className="text-center my-2">
                        <span className="inline-block px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  const isMe = msg.senderId === currentUser.id;
                  const sender = availableUsers.find((u) => u.id === msg.senderId);
                  const senderDisplayName =
                    msg.senderName || sender?.name || "구성원";
                  const senderDisplayRole = msg.senderRole
                    ? ROLE_LABELS[msg.senderRole as UserRole]
                    : sender
                    ? ROLE_LABELS[sender.role]
                    : "";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isMe ? "items-end" : "items-start"
                      }`}
                    >
                      {!isMe && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 ml-1">
                          {senderDisplayName}
                          {senderDisplayRole ? ` · ${senderDisplayRole}` : ""}
                        </span>
                      )}
                      <div className="flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%]">
                        {isMe && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {msg.createdAt}
                          </span>
                        )}
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                            isMe
                              ? "bg-orange-600 text-white rounded-br-xs"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs"
                          }`}
                        >
                          {msg.content}
                        </div>
                        {!isMe && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {msg.createdAt}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* 메시지 입력 폼 */}
              <form
                onSubmit={handleSend}
                className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={`${currentUser.name}(${ROLE_LABELS[currentUser.role]})님으로 메시지 입력...`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || isSending}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shrink-0 transition"
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  학과 구성원 검색 및 1:1 대화 요청
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  교수님의 특정 학생 면담 요청, 재학생과 졸업생 간 멘토링 대화를 바로 시작할 수 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => refreshApprovedMembers()}
                  title="회원 목록 새로고침"
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${approvedMembersLoading ? "animate-spin text-orange-600" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
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
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl">
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
                  <p className="font-semibold text-slate-600 dark:text-slate-300">대화 가능한 다른 승인 회원이 아직 없습니다.</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    본인 계정({currentUser.name} 님)은 자기 자신에게 대화할 수 없어 목록에서 제외됩니다.<br />
                    관리자가 다른 회원의 가입을 승인하거나, 관리자 계정과 1:1 대화를 진행할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => refreshApprovedMembers()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition mt-1"
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
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {u.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[10px] font-bold">
                          {ROLE_LABELS[u.role] || "구성원"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {u.doubleMajor ? `복전: ${u.doubleMajor}` : ""}
                        {u.doubleMajor && u.careerTrack ? " · " : ""}
                        {u.careerTrack ? `진로: ${u.careerTrack}` : ""}
                        {!u.doubleMajor && !u.careerTrack && u.bio ? u.bio : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartDirect(u.id)}
                      className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shrink-0 transition"
                    >
                      대화 요청
                    </button>
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
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
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${approvedMembersLoading ? "animate-spin text-orange-600" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
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
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">대화방 성격 태그</label>
                <select
                  value={groupCategory}
                  onChange={(e) => setGroupCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="수업/스터디 모임">수업/스터디 모임</option>
                  <option value="학술제/연구 분과">학술제/연구 분과</option>
                  <option value="진로 멘토링 그룹">진로 멘토링 그룹</option>
                  <option value="학과 자치/소모임">학과 자치/소모임</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  초대할 구성원 선택 ({selectedUserIds.length}명 선택됨)
                </label>
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  {approvedMembersError ? (
                    <div className="p-4 text-center text-xs text-rose-500">
                      회원 목록 조회 오류: {approvedMembersError}
                    </div>
                  ) : approvedMembersLoading ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      승인 회원 목록을 불러오는 중...
                    </div>
                  ) : availableUsers.filter((u) => u.id !== currentUser.id).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 space-y-1.5">
                      <p className="font-semibold text-slate-600 dark:text-slate-300">초대 가능한 다른 승인 회원이 아직 없습니다.</p>
                      <p className="text-[11px] text-slate-500">본인 계정을 제외한 다른 정회원이 승인되면 선택할 수 있습니다.</p>
                      <button
                        type="button"
                        onClick={() => refreshApprovedMembers()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-200 font-semibold"
                      >
                        <RefreshCw className="w-3 h-3" /> 다시 조회
                      </button>
                    </div>
                  ) : (
                    availableUsers
                      .filter((u) => u.id !== currentUser.id)
                      .map((u) => {
                        const checked = selectedUserIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleSelectGroupUser(u.id)}
                            className={`w-full text-left p-3 flex items-center justify-between transition ${
                              checked
                                ? "bg-orange-50 dark:bg-orange-950/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">
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
                                  : "border-slate-300 dark:border-slate-600"
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
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={selectedUserIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold transition"
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
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
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${approvedMembersLoading ? "animate-spin text-orange-600" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
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
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl">
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
                                ? "bg-orange-50 dark:bg-orange-950/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">
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
                                  : "border-slate-300 dark:border-slate-600"
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
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
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
    </div>
  );
}
