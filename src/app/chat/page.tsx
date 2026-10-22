"use client";

import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { ROLE_LABELS, DemoInfoBanner, RoleBadge } from "@/components/common/Cards";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  ChipGroup,
  Chip,
  CountBadge,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  Select,
  cn,
  useToast,
} from "@/components/ui";
import {
  Send,
  UserPlus,
  Info,
  PlusCircle,
  Check,
  ChevronLeft,
  MessageSquare,
} from "lucide-react";

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
  } = useApp();
  const toast = useToast();

  const [activeConvId, setActiveConvId] = useState<string>(
    conversations[0]?.id || ""
  );
  const [messageInput, setMessageInput] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  // 모바일(lg 미만)에서는 대화 목록과 대화 화면 중 하나만 보여 준다. (UI 전용 상태)
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  // 모달 상태: "direct" (사용자 검색 및 1:1 대화 시작) | "group" (단체 채팅방 개설) | null
  const [modalMode, setModalMode] = useState<"direct" | "group" | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupCategory, setGroupCategory] = useState("수업/스터디 모임");

  const messageScrollRef = useRef<HTMLDivElement>(null);

  const activeConversation =
    conversations.find((c) => c.id === activeConvId) || conversations[0];

  const activeMessages = messages.filter(
    (m) => m.conversationId === activeConversation?.id
  );

  // 대화를 바꾸거나 새 메시지가 오면 가장 아래(최신)로 이동
  useEffect(() => {
    const el = messageScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConversation?.id, activeMessages.length, mobileView]);

  const handleSelectConversation = (convId: string) => {
    setActiveConvId(convId);
    markConversationRead(convId);
    setMobileView("thread");
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !messageInput.trim()) return;
    sendMessage(activeConversation.id, messageInput);
    setMessageInput("");
  };

  const filteredConversations = conversations.filter((c) => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.lastMessageText.toLowerCase().includes(q)
    );
  });

  // 대화 상대 검색용 사용자 목록 (본인 제외)
  const searchableUsers = users.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.studentIdOrYear.toLowerCase().includes(q) ||
      (u.doubleMajor && u.doubleMajor.toLowerCase().includes(q)) ||
      (u.careerTrack && u.careerTrack.toLowerCase().includes(q))
    );
  });

  const handleStartDirect = (targetUserId: string) => {
    const tag =
      currentUser.role === "professor"
        ? "교수-학생 면담"
        : "학과 구성원 1:1 대화";
    const convId = startOrOpenDirectChat(targetUserId, tag);
    setActiveConvId(convId);
    markConversationRead(convId);
    setMobileView("thread");
    setModalMode(null);
  };

  const toggleSelectGroupUser = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;
    const convId = createGroupConversation(
      groupTitle.trim() || "교육학과 새 단체 채팅방",
      selectedUserIds,
      groupCategory
    );
    setActiveConvId(convId);
    setMobileView("thread");
    setSelectedUserIds([]);
    setGroupTitle("");
    setModalMode(null);
    toast({ title: "단체 채팅방을 개설했어요" });
  };

  const activeMembers =
    activeConversation?.memberIds
      .map((uid) => users.find((u) => u.id === uid))
      .filter(Boolean) || [];

  const roleFilterOptions = [
    { key: "all", label: "전체 구성원" },
    { key: "student", label: "재학생" },
    { key: "alumni", label: "졸업생" },
    { key: "professor", label: "교수진" },
  ];

  return (
    <div className="space-y-6">
      {/* 상단 타이틀 및 새 대화 버튼 */}
      <PageHeader
        title="동국e음 학과 전용 대화창"
        description="교수님의 재학생 면담 요청, 선후배 1:1 멘토링 대화, 학술제·스터디 단체 채팅방을 지원합니다."
        actions={
          <>
            <Button
              variant="dark"
              icon={<UserPlus />}
              onClick={() => {
                setUserSearchQuery("");
                setRoleFilter("all");
                setModalMode("direct");
              }}
            >
              사용자 검색 · 1:1 대화 시작
            </Button>
            <Button
              variant="primary"
              icon={<PlusCircle />}
              onClick={() => {
                setUserSearchQuery("");
                setSelectedUserIds([]);
                setGroupTitle("");
                setModalMode("group");
              }}
            >
              단체 채팅방 개설
            </Button>
          </>
        }
      />

      <DemoInfoBanner
        title="로컬 데모 메신저 안내 (실제 외부 기기 전송 미구현)"
        description="1차 프로토타입에서는 대화방 개설과 메시지 전송이 현재 브라우저 상태에 즉시 반영됩니다. 실제 다른 사용자의 기기로 푸시 알림이나 실시간 소켓 메시지가 전송되지는 않습니다."
      />

      {/* 메인 메신저: 왼쪽 대화 목록 + 오른쪽 대화 화면 */}
      <Panel
        padding="none"
        className="flex h-[calc(100dvh-10rem)] min-h-[480px] overflow-hidden lg:h-[calc(100dvh-17.5rem)] lg:min-h-[520px]"
      >
        {/* 좌측: 대화방 목록 (모바일에서는 목록 보기일 때만) */}
        <section
          aria-label="대화방 목록"
          className={cn(
            "min-h-0 w-full flex-col border-line lg:flex lg:w-80 lg:shrink-0 lg:border-r",
            mobileView === "list" ? "flex" : "hidden"
          )}
        >
          <div className="border-b border-line p-3">
            <SearchInput
              value={convSearch}
              onValueChange={setConvSearch}
              label="대화방 검색"
              placeholder="대화방 이름 또는 메시지 검색..."
            />
          </div>

          <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {filteredConversations.map((conv) => {
              const isSelected = conv.id === activeConversation?.id;
              const myMember = conv.members.find(
                (m) => m.userId === currentUser.id
              );
              const unread = myMember?.unreadCount || 0;
              const others = conv.memberIds
                .filter((id) => id !== currentUser.id)
                .flatMap((id) => {
                  const u = users.find((x) => x.id === id);
                  return u
                    ? [{ name: u.name, initials: u.avatarInitials, role: u.role }]
                    : [];
                });

              return (
                <button
                  key={conv.id}
                  type="button"
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                    isSelected ? "bg-accent-soft" : "hover:bg-surface-2"
                  )}
                >
                  <span className="flex w-12 shrink-0 items-center pt-0.5">
                    {conv.isGroup ? (
                      <AvatarStack people={others} max={2} size="xs" />
                    ) : (
                      <Avatar
                        name={others[0]?.name ?? conv.title}
                        initials={others[0]?.initials}
                        role={others[0]?.role}
                        size="md"
                      />
                    )}
                  </span>

                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-ink">
                        {conv.title}
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-3">
                        {conv.lastMessageAt}
                      </span>
                    </span>
                    <span className="flex">
                      <Badge tone={conv.isGroup ? "info" : "neutral"}>
                        {conv.isGroup
                          ? `단체 (${conv.memberIds.length}명)`
                          : conv.categoryTag || "1:1 대화"}
                      </Badge>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-ink-3">
                        {conv.lastMessageText}
                      </span>
                      {unread > 0 && (
                        <span className="flex shrink-0 items-center">
                          <span className="sr-only">안읽음</span>
                          <CountBadge count={unread} />
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredConversations.length === 0 && (
              <div className="p-4">
                <EmptyState compact title="검색 결과가 없어요" />
              </div>
            )}
          </div>
        </section>

        {/* 우측: 활성 대화 화면 (모바일에서는 대화 보기일 때만) */}
        <section
          aria-label="대화 화면"
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col lg:flex",
            mobileView === "thread" ? "flex" : "hidden"
          )}
        >
          {activeConversation ? (
            <>
              {/* 대화방 상단 헤더 */}
              <div className="flex items-center gap-2 border-b border-line px-3 py-3 sm:px-4">
                <IconButton
                  label="대화 목록으로"
                  className="lg:hidden"
                  onClick={() => setMobileView("list")}
                >
                  <ChevronLeft />
                </IconButton>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-bold text-ink">
                      {activeConversation.title}
                    </h2>
                    <Badge className="shrink-0">
                      참여자 {activeConversation.memberIds.length}명
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-ink-3">
                    참여 중:{" "}
                    {activeMembers
                      .map((m) => `${m?.name}(${ROLE_LABELS[m!.role]})`)
                      .join(", ")}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Info />}
                  aria-expanded={showMemberPanel}
                  aria-controls="chat-member-panel"
                  onClick={() => setShowMemberPanel((prev) => !prev)}
                  className="shrink-0 max-sm:w-8 max-sm:px-0"
                >
                  {/* 좁은 화면에서는 아이콘만 보이고 문구는 화면 낭독기에만 읽힌다 */}
                  <span className="max-sm:sr-only">
                    참여자 정보 {showMemberPanel ? "닫기" : "보기"}
                  </span>
                </Button>
              </div>

              {/* 참여자 상세 정보 접이식 패널 */}
              {showMemberPanel && (
                <div
                  id="chat-member-panel"
                  className="border-b border-line bg-surface-2 px-4 py-3"
                >
                  <p className="mb-1 text-xs font-semibold text-ink-3">
                    채팅방 참여 구성원 프로필
                  </p>
                  <ul className="max-h-48 divide-y divide-line overflow-y-auto">
                    {activeMembers.map((member) =>
                      member ? (
                        <li
                          key={member.id}
                          className="flex items-center gap-3 py-2.5"
                        >
                          <Avatar
                            name={member.name}
                            initials={member.avatarInitials}
                            role={member.role}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                              <span className="truncate">{member.name}</span>
                              <RoleBadge role={member.role} />
                            </p>
                            <p className="truncate text-xs text-ink-3">
                              {member.studentIdOrYear}
                              {member.doubleMajor ? ` · ${member.doubleMajor}` : ""}
                            </p>
                          </div>
                          {member.careerTrack && (
                            <Badge className="shrink-0">{member.careerTrack}</Badge>
                          )}
                        </li>
                      ) : null
                    )}
                  </ul>
                </div>
              )}

              {/* 메시지 스트림 */}
              <div
                ref={messageScrollRef}
                role="log"
                aria-label={`${activeConversation.title} 메시지`}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              >
                {activeMessages.map((msg) => {
                  if (msg.isSystemMessage) {
                    return (
                      <div key={msg.id} className="flex justify-center py-1">
                        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-3">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  const isMe = msg.senderId === currentUser.id;
                  const sender = users.find((u) => u.id === msg.senderId);

                  if (isMe) {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="flex max-w-[75%] items-end gap-1.5">
                          <span className="tabular shrink-0 text-xs text-ink-3">
                            {msg.createdAt}
                          </span>
                          <p className="rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-white">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start gap-2">
                      <Avatar
                        name={sender?.name || "구성원"}
                        initials={sender?.avatarInitials}
                        role={sender?.role}
                        size="sm"
                      />
                      <div className="min-w-0 max-w-[75%] space-y-1">
                        <p className="text-xs text-ink-3">
                          {sender?.name || "구성원"} ·{" "}
                          {sender ? ROLE_LABELS[sender.role] : ""} (
                          {sender?.studentIdOrYear})
                        </p>
                        <div className="flex items-end gap-1.5">
                          <p className="rounded-2xl rounded-bl-md bg-surface-2 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">
                            {msg.content}
                          </p>
                          <span className="tabular shrink-0 text-xs text-ink-3">
                            {msg.createdAt}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 메시지 입력 폼 */}
              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 border-t border-line bg-surface p-3 sm:p-4"
              >
                <Input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  aria-label={`${currentUser.name}(${ROLE_LABELS[currentUser.role]})님으로 메시지 입력`}
                  placeholder={`${currentUser.name}(${ROLE_LABELS[currentUser.role]})님으로 메시지 입력...`}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="submit"
                  icon={<Send />}
                  disabled={!messageInput.trim()}
                  className="shrink-0"
                >
                  전송
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                compact
                icon={<MessageSquare />}
                title="좌측에서 대화방을 선택하거나 새로운 대화를 시작하세요."
              />
            </div>
          )}
        </section>
      </Panel>

      {/* 모달 1: 사용자 검색 및 1:1 대화 시작 (교수->재학생 검색 요청, 재학생->졸업생 요청 등) */}
      <Modal
        open={modalMode === "direct"}
        onClose={() => setModalMode(null)}
        size="lg"
        title="학과 구성원 검색 및 1:1 대화 요청"
        description="교수님의 특정 학생 면담 요청, 재학생과 졸업생 간 멘토링 대화를 바로 시작할 수 있습니다."
      >
        <div className="sticky top-0 z-10 space-y-3 bg-surface pb-3">
          <SearchInput
            value={userSearchQuery}
            onValueChange={setUserSearchQuery}
            label="구성원 검색"
            placeholder="이름, 학번(예: 22학번), 복수전공(예: 심리학), 진로 검색..."
          />
          <ChipGroup label="구성원 분류" labelHidden scroll>
            {roleFilterOptions.map((tab) => (
              <Chip
                key={tab.key}
                selected={roleFilter === tab.key}
                onClick={() => setRoleFilter(tab.key)}
              >
                {tab.label}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        {searchableUsers.length > 0 ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {searchableUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 p-3.5">
                <Avatar
                  name={u.name}
                  initials={u.avatarInitials}
                  role={u.role}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-ink">
                      {u.name}
                    </span>
                    <RoleBadge role={u.role} />
                  </div>
                  <p className="text-xs text-ink-3">
                    {u.studentIdOrYear}
                    {u.doubleMajor ? ` · 복전: ${u.doubleMajor}` : ""}
                    {u.careerTrack ? ` · 진로: ${u.careerTrack}` : ""}
                  </p>
                </div>

                <Button
                  variant="soft"
                  size="sm"
                  aria-label={`${u.name}에게 대화 요청`}
                  onClick={() => handleStartDirect(u.id)}
                  className="shrink-0"
                >
                  대화 요청
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact title="검색 결과가 없어요" />
        )}
      </Modal>

      {/* 모달 2: 단체 채팅방 개설 */}
      <Modal
        open={modalMode === "group"}
        onClose={() => setModalMode(null)}
        size="lg"
        title="단체 채팅방 개설"
        description="여러 명의 재학생·졸업생·교수진을 선택해 스터디나 프로젝트 단체방을 만드세요."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalMode(null)}>
              취소
            </Button>
            <Button
              type="submit"
              form="group-create-form"
              disabled={selectedUserIds.length === 0}
            >
              채팅방 생성하기
            </Button>
          </>
        }
      >
        <form
          id="group-create-form"
          onSubmit={handleCreateGroup}
          className="space-y-4"
        >
          <Field label="단체 채팅방 이름" required>
            <Input
              type="text"
              required
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="예: 교육공학 팀프로젝트 3조 / 임용 교육학 논술 스터디"
            />
          </Field>

          <Field label="대화방 성격 태그">
            <Select
              value={groupCategory}
              onChange={(e) => setGroupCategory(e.target.value)}
            >
              <option value="수업/스터디 모임">수업/스터디 모임</option>
              <option value="학술제/연구 분과">학술제/연구 분과</option>
              <option value="진로 멘토링 그룹">진로 멘토링 그룹</option>
              <option value="학과 자치/소모임">학과 자치/소모임</option>
            </Select>
          </Field>

          <Field
            as="div"
            label={
              <>
                초대할 구성원 선택{" "}
                <span className="tabular font-medium text-ink-3">
                  ({selectedUserIds.length}명 선택됨)
                </span>
              </>
            }
          >
            <ul className="divide-y divide-line rounded-xl border border-line">
              {users
                .filter((u) => u.id !== currentUser.id)
                .map((u) => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleSelectGroupUser(u.id)}
                        className={cn(
                          "flex w-full items-center gap-3 p-3 text-left transition-colors",
                          checked ? "bg-accent-soft" : "hover:bg-surface-2"
                        )}
                      >
                        <Avatar
                          name={u.name}
                          initials={u.avatarInitials}
                          role={u.role}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-ink">{u.name}</span>{" "}
                          <span className="text-xs text-ink-3">
                            ({ROLE_LABELS[u.role]} · {u.studentIdOrYear})
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-md border",
                            checked
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-line-strong bg-surface"
                          )}
                        >
                          {checked && <Check className="size-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
