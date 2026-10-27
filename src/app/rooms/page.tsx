"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { PostCategory } from "@/types";
import {
  CommunityRoomCard,
  SearchAndFilterBar,
  EmptyStateBox,
  DemoInfoBanner,
  ROLE_LABELS,
} from "@/components/common/Cards";
import { FirebaseSetupModal } from "@/components/common/FirebaseSetupModal";
import {
  Compass,
  Users,
  MessageCircle,
  ThumbsUp,
  Plus,
  ArrowLeft,
  BookOpen,
  Sparkles,
  Send,
  X,
  Database,
  Trash2,
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

export default function RoomsPage() {
  const {
    currentUser,
    currentRole,
    users,
    communityRooms,
    communityPosts,
    alumniProfiles,
    toggleJoinRoom,
    createCommunityRoom,
    createCommunityPost,
    deleteCommunityPost,
    addCommunityComment,
    likeCommunityPost,
    isFirestoreConnected,
    firebaseProjectId,
  } = useApp();

  const [selectedRoomFilter, setSelectedRoomFilter] =
    useState<string>("전체 공유방");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedPostCat, setSelectedPostCat] = useState<string>("전체");
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

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
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveRoomId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600"
            >
              <ArrowLeft className="w-4 h-4" /> 전체 공유방 목록으로 돌아가기
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsFirebaseModalOpen(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
                  isFirestoreConnected
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                {isFirestoreConnected
                  ? `실시간 공유 켜짐 (${firebaseProjectId})`
                  : "Firestore 연결 설정"}
              </button>
              <button
                type="button"
                onClick={() => toggleJoinRoom(activeRoom.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  isJoined
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {isJoined ? "참여중 (나가기)" : "+ 공유방 참여하기"}
              </button>
              <button
                type="button"
                onClick={() => setIsPostModalOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 경험·질문 글쓰기
              </button>
            </div>
          </div>

          <div>
            <span className="px-2.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-xs font-bold">
              {activeRoom.type === "career"
                ? "진로 트랙별 공유방"
                : "복수전공별 공유방"}{" "}
              · {activeRoom.categoryName}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5">
              {activeRoom.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              {activeRoom.description}
            </p>
          </div>

          {/* 관련 졸업생 프로필 연결 & 구성원 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3.5 rounded-2xl bg-orange-50/50 dark:bg-slate-800/60 border border-orange-200/60 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-600" /> 연결된 관련 분야 졸업생 멘토
              </p>
              {relatedAlumni.length === 0 ? (
                <p className="text-xs text-slate-500">
                  아직 연결된 졸업생 프로필이 없습니다.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {relatedAlumni.map((alum) => (
                    <Link
                      key={alum.id}
                      href="/alumni"
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-orange-500 transition"
                    >
                      {alum.displayName} · {alum.currentRoleTitle} →
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-orange-600" /> 공유방 참여 구성원 ({roomMembers.length}명)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {roomMembers.map((m) =>
                  m ? (
                    <span
                      key={m.id}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium"
                    >
                      {m.name} ({ROLE_LABELS[m.role]})
                    </span>
                  ) : null
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 게시글 카테고리 탭 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {POST_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedPostCat(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedPostCat === cat
                    ? "bg-orange-600 text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
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
              const canDelete =
                post.authorId === currentUser.id || currentRole === "admin";

              return (
                <div
                  key={post.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-xs font-bold">
                        {post.category}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {post.authorName}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({post.authorBadge})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {post.createdAt}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteCommunityPost(post.id)}
                          title="게시글 삭제 (작성자 본인 또는 관리자)"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {post.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>

                  <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => likeCommunityPost(post.id)}
                      className="inline-flex items-center gap-1.5 font-bold text-orange-600 hover:underline"
                    >
                      <ThumbsUp className="w-4 h-4" /> 도움이 됐어요 ({post.likes})
                    </button>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <MessageCircle className="w-4 h-4" /> 댓글 {post.comments.length}개
                    </span>
                  </div>

                  {/* 댓글 영역 */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 space-y-2.5">
                    {post.comments.map((cmt) => (
                      <div
                        key={cmt.id}
                        className="text-xs border-b border-slate-200/60 dark:border-slate-700/60 last:border-none pb-2 last:pb-0"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {cmt.authorName}{" "}
                            <span className="text-orange-600">
                              ({ROLE_LABELS[cmt.authorRole]})
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {cmt.createdAt}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          {cmt.content}
                        </p>
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={commentInputs[post.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder="질문에 대한 답변이나 코멘트를 남겨보세요..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendComment(post.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> 등록
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 글쓰기 모달 */}
        {isPostModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  [{activeRoom.name}] 새 게시글 작성
                </h2>
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-3 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold mb-1">말머리 분류</label>
                  <select
                    value={newPostCategory}
                    onChange={(e) =>
                      setNewPostCategory(e.target.value as PostCategory)
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="복수전공 후기">복수전공 후기</option>
                    <option value="진로 경험 공유">진로 경험 공유</option>
                    <option value="질문/답변">질문/답변</option>
                    <option value="자유 정보">자유 정보</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">제목</label>
                  <input
                    type="text"
                    required
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder="예: [심리학 복전] 선수과목 수강 순서 및 학점 팁 공유"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">본문 내용</label>
                  <textarea
                    rows={5}
                    required
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="후배들과 학우들에게 도움이 될 경험이나 질문을 작성해 주세요."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPostModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                  >
                    게시글 등록
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <FirebaseSetupModal
          isOpen={isFirebaseModalOpen}
          onClose={() => setIsFirebaseModalOpen(false)}
        />
      </div>
    );
  }

  // 전체 공유방 목록 화면
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              진로 트랙 & 복수전공 공유방 (학우들이 쓴 글)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            선배들의 복수전공 이수 후기와 진로 준비 경험을 축적하고, Firebase Firestore로 모든 학우가 실시간으로 함께 볼 수 있는 공간입니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsFirebaseModalOpen(true)}
            className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition ${
              isFirestoreConnected
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 dark:bg-slate-700 text-white"
            }`}
          >
            <Database className="w-4 h-4" />
            {isFirestoreConnected
              ? `Firestore 실시간 연동 중 (${firebaseProjectId})`
              : "Firestore 클라우드 공유 연결하기"}
          </button>

          <button
            type="button"
            onClick={() => setIsCreateRoomOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> 새 공유방 개설
          </button>
        </div>
      </div>

      <DemoInfoBanner
        title={
          isFirestoreConnected
            ? `🟢 현재 Firebase Firestore (${firebaseProjectId}) 실시간 공유 모드가 켜져 있습니다!`
            : "⚪ 학우들이 쓴 글을 다른 컴퓨터에서도 함께 보려면 [Firestore 클라우드 공유 연결하기]를 눌러주세요."
        }
        description={
          isFirestoreConnected
            ? "지금 공유방에 새 글을 쓰거나 댓글·공감을 누르면 다른 컴퓨터나 팀원 스마트폰에서도 새로고침 없이 즉시 똑같이 보입니다."
            : "Firebase 무료 Spark 요금제(결제 수단 등록 불필요)로 만든 프로젝트의 설정값만 붙여넣으면 모든 컴퓨터가 실시간으로 연결됩니다."
        }
      />

      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="공유방 이름(예: 기업 HRD, 교직, 심리학, 경영학, 컴퓨터공학) 검색..."
        categories={ROOM_FILTER_TABS}
        selectedCategory={selectedRoomFilter}
        onSelectCategory={setSelectedRoomFilter}
      />

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              공유방 전체 최신 게시글 · 학우들이 쓴 글 ({communityPosts.length}건)
            </h2>
          </div>
          {isFirestoreConnected && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              실시간 동기화 중
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {communityPosts.slice(0, 8).map((post) => (
            <div
              key={post.id}
              onClick={() => setActiveRoomId(post.roomId)}
              className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-orange-400 cursor-pointer transition bg-slate-50/50 dark:bg-slate-800/40"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 font-bold text-[11px]">
                    {post.roomName}
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    [{post.category}]
                  </span>
                  <span className="text-slate-500">
                    작성자: {post.authorName}
                  </span>
                </div>
                <span className="text-slate-400">{post.createdAt}</span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-white mb-1">
                {post.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">
                {post.content}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 새 공유방 추가 모달 */}
      {isCreateRoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                새 복수전공·진로 공유방 추가
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateRoomOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold mb-1">공유방 유형</label>
                <select
                  value={newRoomType}
                  onChange={(e) =>
                    setNewRoomType(e.target.value as "career" | "double_major")
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="double_major">복수전공별 공유방</option>
                  <option value="career">진로 트랙별 공유방</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  전공명 또는 트랙명 (확장 가능)
                </label>
                <input
                  type="text"
                  required
                  value={newRoomCategoryName}
                  onChange={(e) => setNewRoomCategoryName(e.target.value)}
                  placeholder="예: 국어국문학, 사회학, 통계학, 교육컨설팅"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">공유방 표시 이름</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="예: 통계학·데이터사이언스 복수전공 공유방"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">공유방 소개</label>
                <textarea
                  rows={3}
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="공유방의 목적과 다루는 주제를 적어주세요."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoomOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                  공유방 개설
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FirebaseSetupModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
      />
    </div>
  );
}
