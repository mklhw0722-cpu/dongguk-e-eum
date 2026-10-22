"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { PostCategory } from "@/types";
import {
  CommunityRoomCard,
  SearchAndFilterBar,
  EmptyStateBox,
  DemoInfoBanner,
  RoleBadge,
} from "@/components/common/Cards";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  ChipGroup,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  SectionHeader,
  Select,
  Textarea,
  useToast,
  type BadgeTone,
} from "@/components/ui";
import {
  MessageCircle,
  ThumbsUp,
  Plus,
  ArrowLeft,
  ChevronRight,
  Send,
} from "lucide-react";

const ROOM_FILTER_TABS = [
  "전체 공유방",
  "진로 트랙별 공유방",
  "복수전공별 공유방",
  "내가 참여한 공유방",
];

const POST_CATEGORIES: ("전체" | PostCategory)[] = [
  "전체",
  "질문/답변",
  "복수전공 후기",
  "진로 경험 공유",
  "자유 정보",
];

/** 게시글 분류별 배지 색 (역할 색과 겹치지 않게) */
const POST_CATEGORY_TONE: Record<PostCategory, BadgeTone> = {
  "질문/답변": "info",
  "복수전공 후기": "brand",
  "진로 경험 공유": "success",
  "자유 정보": "neutral",
};

export default function RoomsPage() {
  const {
    currentUser,
    users,
    communityRooms,
    communityPosts,
    alumniProfiles,
    toggleJoinRoom,
    createCommunityRoom,
    createCommunityPost,
    addCommunityComment,
    likeCommunityPost,
  } = useApp();
  const toast = useToast();

  const [selectedRoomFilter, setSelectedRoomFilter] =
    useState<string>("전체 공유방");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedPostCat, setSelectedPostCat] = useState<string>("전체");

  // 목록 ↔ 공유방 상세를 오갈 때 화면 맨 위부터 보이도록 (UI 전용)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeRoomId]);

  // 새 게시글 모달 상태
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newPostCategory, setNewPostCategory] =
    useState<PostCategory>("복수전공 후기");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");

  // 새 복수전공/진로 공유방 추가 모달 (확장 구조)
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomType, setNewRoomType] = useState<"career" | "double_major">(
    "double_major"
  );
  const [newRoomCategoryName, setNewRoomCategoryName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");

  // 댓글 입력 상태
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {}
  );

  const activeRoom = communityRooms.find((r) => r.id === activeRoomId) || null;

  const filteredRooms = communityRooms.filter((room) => {
    if (selectedRoomFilter === "진로 트랙별 공유방" && room.type !== "career")
      return false;
    if (
      selectedRoomFilter === "복수전공별 공유방" &&
      room.type !== "double_major"
    )
      return false;
    if (
      selectedRoomFilter === "내가 참여한 공유방" &&
      !room.memberIds.includes(currentUser.id)
    )
      return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      room.name.toLowerCase().includes(q) ||
      room.categoryName.toLowerCase().includes(q) ||
      room.description.toLowerCase().includes(q)
    );
  });

  const roomPosts = communityPosts.filter((p) => {
    if (activeRoom && p.roomId !== activeRoom.id) return false;
    if (selectedPostCat !== "전체" && p.category !== selectedPostCat)
      return false;
    return true;
  });

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRoomId = activeRoom?.id || communityRooms[0]?.id;
    if (!targetRoomId || !newPostTitle.trim() || !newPostContent.trim()) return;
    createCommunityPost({
      roomId: targetRoomId,
      category: newPostCategory,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
    });
    setNewPostTitle("");
    setNewPostContent("");
    setIsPostModalOpen(false);
    toast({ title: "게시글을 등록했어요" });
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !newRoomCategoryName.trim()) return;
    createCommunityRoom({
      name: newRoomName.trim(),
      type: newRoomType,
      categoryName: newRoomCategoryName.trim(),
      description:
        newRoomDesc.trim() ||
        `${newRoomCategoryName} 관련 학업·진로 정보를 축적하는 공유방입니다.`,
    });
    setNewRoomName("");
    setNewRoomCategoryName("");
    setNewRoomDesc("");
    setIsCreateRoomOpen(false);
    toast({ title: "공유방을 개설했어요" });
  };

  const handleSendComment = (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;
    addCommunityComment(postId, text);
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  };

  // 공유방 상세 화면일 때
  if (activeRoom) {
    const isJoined = activeRoom.memberIds.includes(currentUser.id);
    const roomMembers = activeRoom.memberIds
      .map((uid) => users.find((u) => u.id === uid))
      .filter(Boolean);
    const relatedAlumni = alumniProfiles.filter(
      (a) =>
        activeRoom.relatedAlumniIds.includes(a.id) ||
        a.careerTrack === activeRoom.categoryName ||
        a.doubleMajor === activeRoom.categoryName
    );

    return (
      <div className="space-y-6">
        {/* 상단 돌아가기 & 공유방 헤더 */}
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft />}
            onClick={() => setActiveRoomId(null)}
            className="-ml-3"
          >
            전체 공유방 목록으로 돌아가기
          </Button>

          <PageHeader
            meta={
              <Badge tone={activeRoom.type === "career" ? "brand" : "info"}>
                {activeRoom.type === "career"
                  ? "진로 트랙별 공유방"
                  : "복수전공별 공유방"}{" "}
                · {activeRoom.categoryName}
              </Badge>
            }
            title={activeRoom.name}
            description={activeRoom.description}
            actions={
              <>
                {isJoined ? (
                  <Button
                    variant="secondary"
                    onClick={() => toggleJoinRoom(activeRoom.id)}
                  >
                    참여중 (나가기)
                  </Button>
                ) : (
                  <Button
                    variant="soft"
                    icon={<Plus />}
                    onClick={() => toggleJoinRoom(activeRoom.id)}
                  >
                    공유방 참여하기
                  </Button>
                )}
                <Button icon={<Plus />} onClick={() => setIsPostModalOpen(true)}>
                  경험·질문 글쓰기
                </Button>
              </>
            }
          />
        </div>

        {/* 관련 졸업생 프로필 연결 & 구성원 목록 */}
        <Panel
          as="section"
          aria-label="관련 졸업생과 공유방 구성원"
          className="divide-y divide-line"
        >
          <div className="pb-4">
            <h2 className="mb-2.5 text-sm font-semibold text-ink">
              연결된 관련 분야 졸업생 멘토
            </h2>
            {relatedAlumni.length === 0 ? (
              <p className="text-sm text-ink-3">
                아직 연결된 졸업생 프로필이 없습니다.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {relatedAlumni.map((alum) => (
                  <li key={alum.id} className="max-w-full">
                    <Link
                      href="/alumni"
                      className="inline-flex max-w-full items-center gap-2 rounded-lg bg-surface-2 py-1.5 pr-2.5 pl-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-3"
                    >
                      <Avatar name={alum.displayName} role="alumni" size="xs" />
                      <span className="truncate">
                        {alum.displayName} · {alum.currentRoleTitle}
                      </span>
                      <ChevronRight
                        className="size-3.5 shrink-0 text-ink-3"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-4">
            <h2 className="mb-2.5 text-sm font-semibold text-ink">
              공유방 참여 구성원 ({roomMembers.length}명)
            </h2>
            <ul className="flex flex-wrap gap-2">
              {roomMembers.map((m) =>
                m ? (
                  <li
                    key={m.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-surface-2 py-1.5 pr-2.5 pl-1.5"
                  >
                    <Avatar name={m.name} role={m.role} size="xs" />
                    <span className="text-sm font-medium text-ink">{m.name}</span>
                    <RoleBadge role={m.role} />
                  </li>
                ) : null
              )}
            </ul>
          </div>
        </Panel>

        {/* 게시글 분류 */}
        <div className="space-y-3">
          <ChipGroup label="게시글 분류" labelHidden scroll>
            {POST_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                selected={selectedPostCat === cat}
                onClick={() => setSelectedPostCat(cat)}
              >
                {cat}
              </Chip>
            ))}
          </ChipGroup>
          <p className="tabular text-sm text-ink-3" aria-live="polite">
            게시글 {roomPosts.length}건
          </p>
        </div>

        {/* 공유방 내 게시글 및 댓글 목록 */}
        {roomPosts.length === 0 ? (
          <EmptyStateBox
            title="아직 등록된 게시글이 없습니다"
            description="첫 번째 질문이나 복수전공 후기, 진로 경험을 남겨 후배들과 지식을 나눠보세요!"
            actionLabel="첫 게시글 작성하기"
            onAction={() => setIsPostModalOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {roomPosts.map((post) => {
              const commentValue = commentInputs[post.id] || "";
              return (
                <article
                  key={post.id}
                  aria-labelledby={`post-${post.id}-title`}
                  className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
                >
                  <Badge tone={POST_CATEGORY_TONE[post.category] ?? "neutral"} dot>
                    {post.category}
                  </Badge>

                  <h3
                    id={`post-${post.id}-title`}
                    className="mt-2 text-base font-semibold text-ink"
                  >
                    {post.title}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Avatar name={post.authorName} role={post.authorRole} size="xs" />
                    <span className="text-xs font-semibold text-ink">
                      {post.authorName}
                    </span>
                    <span className="text-xs text-ink-3">{post.authorBadge}</span>
                    <span className="tabular text-xs text-ink-3">
                      · {post.createdAt}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink-2">
                    {post.content}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ThumbsUp />}
                      onClick={() => likeCommunityPost(post.id)}
                      className="-ml-2"
                    >
                      도움이 됐어요 <span className="tabular">({post.likes})</span>
                    </Button>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                      <MessageCircle className="size-3.5" aria-hidden="true" />
                      댓글 {post.comments.length}개
                    </span>
                  </div>

                  {/* 댓글 영역 */}
                  <div className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3.5">
                    {post.comments.length > 0 && (
                      <ul className="divide-y divide-line">
                        {post.comments.map((cmt) => (
                          <li key={cmt.id} className="py-2.5 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-xs font-semibold text-ink">
                                {cmt.authorName}
                              </span>
                              <RoleBadge role={cmt.authorRole} />
                              <span className="tabular ml-auto text-xs text-ink-3">
                                {cmt.createdAt}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-ink-2">{cmt.content}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendComment(post.id);
                      }}
                    >
                      <Input
                        type="text"
                        aria-label={`댓글 입력: ${post.title}`}
                        value={commentValue}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder="질문에 대한 답변이나 코멘트를 남겨보세요..."
                        className="min-w-0 flex-1"
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        icon={<Send />}
                        disabled={!commentValue.trim()}
                      >
                        등록
                      </Button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* 글쓰기 모달 */}
        <Modal
          open={isPostModalOpen}
          onClose={() => setIsPostModalOpen(false)}
          title={`[${activeRoom.name}] 새 게시글 작성`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsPostModalOpen(false)}>
                취소
              </Button>
              <Button type="submit" form="room-post-form">
                게시글 등록
              </Button>
            </>
          }
        >
          <form id="room-post-form" onSubmit={handleCreatePost} className="space-y-4">
            <Field label="말머리 분류">
              <Select
                value={newPostCategory}
                onChange={(e) => setNewPostCategory(e.target.value as PostCategory)}
              >
                <option value="복수전공 후기">복수전공 후기</option>
                <option value="진로 경험 공유">진로 경험 공유</option>
                <option value="질문/답변">질문/답변</option>
                <option value="자유 정보">자유 정보</option>
              </Select>
            </Field>

            <Field label="제목" required>
              <Input
                type="text"
                required
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="예: [심리학 복전] 선수과목 수강 순서 및 학점 팁 공유"
              />
            </Field>

            <Field label="본문 내용" required>
              <Textarea
                rows={5}
                required
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="후배들과 학우들에게 도움이 될 경험이나 질문을 작성해 주세요."
              />
            </Field>
          </form>
        </Modal>
      </div>
    );
  }

  // 전체 공유방 목록 화면
  return (
    <div className="space-y-6">
      <PageHeader
        title="진로 트랙 & 복수전공 공유방"
        description="일반 실시간 채팅방과 달리, 선배들의 복수전공 이수 후기와 진로 준비 경험을 지속적으로 축적하는 아카이브 공간입니다."
        actions={
          <Button icon={<Plus />} onClick={() => setIsCreateRoomOpen(true)}>
            새 복수전공/진로 공유방 개설
          </Button>
        }
      />

      <DemoInfoBanner
        title="일반 대화창 vs 진로·복수전공 공유방 구분 안내"
        description="빠른 실시간 대화는 [대화창] 메뉴를 이용하고, 이곳 [공유방]에서는 진로 트랙(7종) 및 복수전공별 게시글·질문답변·이수 후기를 체계적으로 모아볼 수 있습니다. 복수전공 목록은 예시이며 관리자가 자유롭게 추가·확장할 수 있습니다."
      />

      <div className="space-y-3">
        <SearchAndFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="공유방 이름(예: 기업 HRD, 교직, 심리학, 경영학, 컴퓨터공학) 검색..."
          categories={ROOM_FILTER_TABS}
          selectedCategory={selectedRoomFilter}
          onSelectCategory={setSelectedRoomFilter}
        />
        <p className="tabular text-sm text-ink-3" aria-live="polite">
          공유방 {filteredRooms.length}곳
        </p>
      </div>

      {filteredRooms.length === 0 ? (
        <EmptyStateBox
          title="검색 조건에 맞는 공유방이 없습니다"
          description="다른 카테고리를 선택하거나 새 복수전공 공유방을 개설해 보세요."
          actionLabel="전체 공유방 보기"
          onAction={() => {
            setSelectedRoomFilter("전체 공유방");
            setSearchQuery("");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filteredRooms.map((room) => {
            const count = communityPosts.filter(
              (p) => p.roomId === room.id
            ).length;
            return (
              <CommunityRoomCard
                key={room.id}
                room={room}
                isJoined={room.memberIds.includes(currentUser.id)}
                postCount={count}
                onToggleJoin={toggleJoinRoom}
                onSelectRoom={(id) => setActiveRoomId(id)}
              />
            );
          })}
        </div>
      )}

      {/* 최근 올라온 전체 공유방 인기 후기/질문 미리보기 */}
      <Panel as="section" aria-labelledby="rooms-recent-title">
        <SectionHeader
          title={
            <span id="rooms-recent-title">
              공유방 전체 최신 게시글 · 복수전공 후기
            </span>
          }
        />

        <ul className="-mx-2 mt-2 divide-y divide-line">
          {communityPosts.slice(0, 5).map((post) => (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => setActiveRoomId(post.roomId)}
                className="block w-full rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge tone="neutral">{post.roomName}</Badge>
                    <span className="truncate text-xs font-medium text-ink-2">
                      {post.category}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-ink-3">
                    {post.createdAt}
                  </span>
                </span>
                <span className="mt-1.5 block text-[15px] font-semibold text-ink">
                  {post.title}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-sm text-ink-2">
                  {post.content}
                </span>
                <span className="tabular mt-1 block text-xs text-ink-3">
                  {post.authorName} · 도움이 됐어요 {post.likes} · 댓글{" "}
                  {post.comments.length}개
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {/* 새 공유방 추가 모달 */}
      <Modal
        open={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        title="새 복수전공·진로 공유방 추가"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateRoomOpen(false)}>
              취소
            </Button>
            <Button type="submit" form="room-create-form">
              공유방 개설
            </Button>
          </>
        }
      >
        <form id="room-create-form" onSubmit={handleCreateRoom} className="space-y-4">
          <Field label="공유방 유형">
            <Select
              value={newRoomType}
              onChange={(e) =>
                setNewRoomType(e.target.value as "career" | "double_major")
              }
            >
              <option value="double_major">복수전공별 공유방</option>
              <option value="career">진로 트랙별 공유방</option>
            </Select>
          </Field>

          <Field label="전공명 또는 트랙명 (확장 가능)" required>
            <Input
              type="text"
              required
              value={newRoomCategoryName}
              onChange={(e) => setNewRoomCategoryName(e.target.value)}
              placeholder="예: 국어국문학, 사회학, 통계학, 교육컨설팅"
            />
          </Field>

          <Field label="공유방 표시 이름" required>
            <Input
              type="text"
              required
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="예: 통계학·데이터사이언스 복수전공 공유방"
            />
          </Field>

          <Field label="공유방 소개">
            <Textarea
              rows={3}
              value={newRoomDesc}
              onChange={(e) => setNewRoomDesc(e.target.value)}
              placeholder="공유방의 목적과 다루는 주제를 적어주세요."
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
