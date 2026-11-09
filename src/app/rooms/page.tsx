"use client";

import React, { useState, useEffect } from "react";
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
  Edit3,
} from "lucide-react";

const BOARD_FILTER_TABS = [
  "전체 게시판",
  "진로 트랙별 게시판",
  "복수전공별 게시판",
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
    communityRooms,
    communityPosts,
    alumniProfiles,
    createCommunityRoom,
    createCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
    addCommunityComment,
    deleteCommunityComment,
    likeCommunityPost,
    isFirestoreConnected,
    firebaseProjectId,
  } = useApp();

  const isAdmin = currentUser.role === "admin" || currentRole === "admin";

  const [selectedBoardFilter, setSelectedBoardFilter] =
    useState<string>("전체 게시판");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedPostCat, setSelectedPostCat] = useState<string>("전체");
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // 새 게시글 / 게시글 수정 모달 상태
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [newPostCategory, setNewPostCategory] =
    useState<PostCategory>("복수전공 후기");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");

  // 홈 대시보드 등에서 ?roomId=...&postId=... 로 진입 시 해당 게시판 및 게시글로 바로 이동
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qRoomId = params.get("roomId");
    const qPostId = params.get("postId");
    if (qRoomId) {
      setActiveRoomId(qRoomId);
    }
    if (qPostId) {
      setHighlightedPostId(qPostId);
    }
  }, []);

  useEffect(() => {
    if (!highlightedPostId || !activeRoomId || typeof document === "undefined") return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`post-${highlightedPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [highlightedPostId, activeRoomId]);

  // 관리자 전용 새 게시판 추가 모달 상태
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
    if (selectedBoardFilter === "진로 트랙별 게시판" && room.type !== "career")
      return false;
    if (
      selectedBoardFilter === "복수전공별 게시판" &&
      room.type !== "double_major"
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

  const openNewPostModal = () => {
    setEditingPostId(null);
    setNewPostCategory("복수전공 후기");
    setNewPostTitle("");
    setNewPostContent("");
    setIsPostModalOpen(true);
  };

  const openEditPostModal = (post: {
    id: string;
    category: PostCategory;
    title: string;
    content: string;
  }) => {
    setEditingPostId(post.id);
    setNewPostCategory(post.category);
    setNewPostTitle(post.title);
    setNewPostContent(post.content);
    setIsPostModalOpen(true);
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRoomId = activeRoom?.id || communityRooms[0]?.id;
    if (!targetRoomId || !newPostTitle.trim() || !newPostContent.trim()) return;

    if (editingPostId) {
      updateCommunityPost(editingPostId, {
        category: newPostCategory,
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
      });
    } else {
      createCommunityPost({
        roomId: targetRoomId,
        category: newPostCategory,
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
      });
    }

    setEditingPostId(null);
    setNewPostTitle("");
    setNewPostContent("");
    setIsPostModalOpen(false);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newRoomName.trim() || !newRoomCategoryName.trim()) return;
    createCommunityRoom({
      name: newRoomName.trim(),
      type: newRoomType,
      categoryName: newRoomCategoryName.trim(),
      description:
        newRoomDesc.trim() ||
        `${newRoomCategoryName} 관련 학업·진로 정보를 나누는 게시판입니다.`,
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

  // 게시판 상세 화면일 때
  if (activeRoom) {
    const relatedAlumni = alumniProfiles.filter(
      (a) =>
        a.privacy?.showProfileInDirectory !== false &&
        (activeRoom.relatedAlumniIds.includes(a.id) ||
          a.careerTrack === activeRoom.categoryName ||
          a.doubleMajor === activeRoom.categoryName)
    );
    const boardDisplayName = activeRoom.name.replace(/공유방/g, "게시판");

    return (
      <div className="space-y-6">
        {/* 상단 돌아가기 & 게시판 헤더 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveRoomId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-orange-600"
            >
              <ArrowLeft className="w-4 h-4" /> 전체 게시판 목록으로 돌아가기
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openNewPostModal}
                className="h-9 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-raise transition"
              >
                <Plus className="w-3.5 h-3.5" /> 새 게시글 작성
              </button>
            </div>
          </div>

          <div>
            <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-xs font-bold">
              {activeRoom.type === "career"
                ? "진로 트랙별 게시판"
                : "복수전공별 게시판"}{" "}
              · {activeRoom.categoryName}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
              {boardDisplayName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {activeRoom.description.replace(/공유방/g, "게시판")}
            </p>
          </div>

          {/* 관련 분야 졸업생 멘토 연결 */}
          <div className="pt-3 border-t border-slate-100">
            <div className="p-3.5 rounded-2xl bg-orange-50/50 border border-orange-200/60">
              <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
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
                      className="px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-xs font-semibold text-slate-800 hover:border-orange-500 transition"
                    >
                      {alum.displayName} · {alum.currentRoleTitle} →
                    </Link>
                  ))}
                </div>
              )}
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
                    : "bg-white border border-slate-200 text-slate-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 게시판 내 게시글 및 댓글 목록 */}
        {roomPosts.length === 0 ? (
          <EmptyStateBox
            title="아직 등록된 게시글이 없습니다"
            description="첫 번째 질문이나 복수전공 후기, 진로 경험을 남겨 학우들과 지식을 나눠보세요!"
            actionLabel="첫 게시글 작성하기"
            onAction={openNewPostModal}
          />
        ) : (
          <div className="space-y-4">
            {roomPosts.map((post) => {
              const canDelete =
                post.authorId === currentUser.id || currentRole === "admin";

              return (
                <div
                  id={`post-${post.id}`}
                  key={post.id}
                  className={`bg-white rounded-2xl border p-5 space-y-3 shadow-xs transition ${
                    highlightedPostId === post.id
                      ? "border-orange-500 ring-2 ring-orange-200"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-xs font-bold">
                        {post.category}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {post.authorName}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({post.authorBadge})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 mr-1">
                        {post.createdAt}
                      </span>
                      {canDelete && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditPostModal(post)}
                            title="게시글 수정 (작성자 본인 또는 관리자)"
                            className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-orange-600 hover:bg-orange-50 inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCommunityPost(post.id)}
                            title="게시글 삭제 (작성자 본인 또는 관리자)"
                            className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> 삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">
                    {post.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>

                  <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs">
                    {(() => {
                      const currentUserId = currentUser.id;
                      const isLikedByMe =
                        Boolean(currentUserId) &&
                        Array.isArray(post.likedUserIds) &&
                        post.likedUserIds.includes(currentUserId);

                      return (
                        <button
                          type="button"
                          onClick={() => likeCommunityPost(post.id)}
                          className={`inline-flex items-center gap-1.5 font-bold transition cursor-pointer ${
                            isLikedByMe
                              ? "text-brand-600"
                              : "text-slate-500 hover:text-brand-600"
                          }`}
                          title={isLikedByMe ? "도움이 됐어요 취소" : "도움이 됐어요"}
                        >
                          <ThumbsUp
                            className={`w-4 h-4 transition-transform active:scale-125 ${
                              isLikedByMe
                                ? "fill-brand-600 text-brand-600"
                                : ""
                            }`}
                          />
                          도움이 됐어요 ({post.likes})
                        </button>
                      );
                    })()}
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <MessageCircle className="w-4 h-4" /> 댓글 {post.comments.length}개
                    </span>
                  </div>

                  {/* 댓글 영역 */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2.5">
                    {post.comments.map((cmt) => {
                      const canDeleteComment =
                        cmt.authorId === currentUser.id || currentRole === "admin";
                      return (
                        <div
                          key={cmt.id}
                          className="text-xs border-b border-slate-200/60 last:border-none pb-2 last:pb-0"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-slate-800">
                              {cmt.authorName}{" "}
                              <span className="text-orange-600">
                                ({ROLE_LABELS[cmt.authorRole]})
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">
                                {cmt.createdAt}
                              </span>
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  onClick={() => deleteCommunityComment(post.id, cmt.id)}
                                  title="댓글 삭제 (작성자 본인 또는 관리자)"
                                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 inline-flex items-center gap-0.5 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" /> 삭제
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-600">
                            {cmt.content}
                          </p>
                        </div>
                      );
                    })}

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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleSendComment(post.id);
                          }
                        }}
                        placeholder="질문에 대한 답변이나 코멘트를 남겨보세요..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendComment(post.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
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
            <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">
                  [{boardDisplayName}] {editingPostId ? "게시글 수정" : "새 게시글 작성"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
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
                    placeholder="예: [국어교육 복전] 선수과목 수강 순서 및 학점 팁 공유"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPostModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-raise transition cursor-pointer"
                  >
                    {editingPostId ? "수정 저장" : "게시글 등록"}
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

  // 전체 게시판 목록 화면
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              진로·복수전공 게시판
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            선배들의 복수전공 후기와 진로 준비 경험을 열람하고, 모든 학우들이 자유롭게 글을 읽고 작성할 수 있는 게시판입니다.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCreateRoomOpen(true)}
              className="h-9 px-3.5 rounded-lg bg-ink text-white hover:bg-ink/85 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> 게시판 추가 (관리자)
            </button>
          </div>
        )}
      </div>

      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="진로/복수전공 게시판 검색 (예: 기업 HRD, 교직, 국어교육, 경영학, 법학)..."
        categories={BOARD_FILTER_TABS}
        selectedCategory={selectedBoardFilter}
        onSelectCategory={setSelectedBoardFilter}
      />

      {filteredRooms.length === 0 ? (
        <EmptyStateBox
          title="검색 조건에 맞는 게시판이 없습니다"
          description="다른 카테고리를 선택하거나 검색어를 변경해 보세요."
          actionLabel="전체 게시판 보기"
          onAction={() => {
            setSelectedBoardFilter("전체 게시판");
            setSearchQuery("");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRooms.map((room) => {
            const postsForBoard = communityPosts.filter(
              (p) => p.roomId === room.id
            );
            const count = postsForBoard.length;
            const latestPostDate =
              postsForBoard.length > 0
                ? postsForBoard
                    .map((p) => p.createdAt)
                    .sort((a, b) => b.localeCompare(a))[0]
                : null;
            return (
              <CommunityRoomCard
                key={room.id}
                room={{
                  ...room,
                  name: room.name.replace(/공유방/g, "게시판"),
                  description: room.description.replace(/공유방/g, "게시판"),
                }}
                postCount={count}
                latestPostDate={latestPostDate}
                onSelectRoom={(id) => setActiveRoomId(id)}
              />
            );
          })}
        </div>
      )}

      {/* 최근 올라온 전체 게시판 인기 후기/질문 미리보기 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              전체 게시판 최신 게시글 · 학우들이 쓴 글 ({communityPosts.length}건)
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
              onClick={() => {
                setActiveRoomId(post.roomId);
                setHighlightedPostId(post.id);
              }}
              className="p-4 rounded-xl border border-slate-100 hover:border-orange-400 cursor-pointer transition bg-slate-50/50"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold text-[11px]">
                    {(post.roomName || "").replace(/공유방/g, "게시판")}
                  </span>
                  <span className="font-bold text-indigo-600">
                    [{post.category}]
                  </span>
                  <span className="text-slate-500">
                    작성자: {post.authorName}
                  </span>
                </div>
                <span className="text-slate-400">{post.createdAt}</span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 mb-1">
                {post.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">
                {post.content}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 관리자 전용 새 게시판 추가 모달 */}
      {isAdmin && isCreateRoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">
                새 복수전공·진로 게시판 추가 (관리자)
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateRoomOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold mb-1">게시판 유형</label>
                <select
                  value={newRoomType}
                  onChange={(e) =>
                    setNewRoomType(e.target.value as "career" | "double_major")
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <option value="double_major">복수전공별 게시판</option>
                  <option value="career">진로 트랙별 게시판</option>
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
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">게시판 표시 이름</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="예: 통계학·데이터사이언스 복수전공 게시판"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">게시판 소개</label>
                <textarea
                  rows={3}
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="게시판의 목적과 다루는 주제를 적어주세요."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoomOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-raise transition cursor-pointer"
                >
                  게시판 추가
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
