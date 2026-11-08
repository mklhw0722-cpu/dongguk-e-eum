"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Notice, NoticeCategory } from "@/types";
import { NoticeCard, EmptyStateBox } from "@/components/common/Cards";
import {
  Megaphone,
  Plus,
  ExternalLink,
  Calendar,
  Pin,
  X,
  CheckCircle2,
  RefreshCw,
  Search,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const NOTICE_FILTER_TABS = [
  { label: "전체", value: "전체" },
  { label: "교육학과 공지", value: "교육학과 공지" },
  { label: "사범대·교직", value: "교직 관련 안내" },
  { label: "학사공지", value: "학사 일정" },
  { label: "장학 및 지원", value: "장학 및 지원" },
] as const;

export default function NoticesPage() {
  const {
    notices,
    noticeSyncMeta,
    createNotice,
    syncOfficialNoticesToCloud,
    currentRole,
    isRealAuthActive,
    authUserProfile,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [showAllPinned, setShowAllPinned] = useState(false);

  // Firestore 동기화 버튼 상태
  const [syncingToCloud, setSyncingToCloud] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // 새 공지 작성 폼 상태 (관리자 전용)
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<NoticeCategory>("교육학과 공지");
  const [newSummary, setNewSummary] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [newUrl, setNewUrl] = useState("https://education.dongguk.edu/article/news2/list");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [writeError, setWriteError] = useState<string | null>(null);

  const isAdmin = isRealAuthActive
    ? authUserProfile?.role === "admin" && authUserProfile?.approvalStatus === "approved"
    : currentRole === "admin";

  // 공식 연동 공지 통계
  const officialCount = useMemo(
    () => notices.filter((n) => n.isOfficialSynced).length,
    [notices]
  );

  // 필터링된 공지 목록 (작성일 기준 정렬)
  const filteredNotices = useMemo(() => {
    return notices
      .filter((n) => {
        if (n.isSampleData) return false;

        // 1. 카테고리 탭 필터링
        if (selectedCategory !== "전체") {
          if (selectedCategory === "장학 및 지원") {
            const isJanghak =
              n.category === "장학 및 지원" ||
              (n.subCategoryTag || "").includes("장학");
            if (!isJanghak) return false;
          } else if (n.category !== selectedCategory) {
            return false;
          }
        }

        // 2. 검색어 필터링
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          const matchTitle = n.title.toLowerCase().includes(q);
          const matchSummary = (n.summary || "").toLowerCase().includes(q);
          const matchOrg = (n.organization || "").toLowerCase().includes(q);
          const matchTag = (n.subCategoryTag || "").toLowerCase().includes(q);
          const matchContent = (n.content || "").toLowerCase().includes(q);
          if (!matchTitle && !matchSummary && !matchOrg && !matchTag && !matchContent) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notices, selectedCategory, searchQuery]);

  // 상단 중요 필독 공지와 일반 공지 분리
  const pinnedNotices = useMemo(
    () => filteredNotices.filter((n) => n.isPinned),
    [filteredNotices]
  );

  const regularNotices = useMemo(
    () => filteredNotices.filter((n) => !n.isPinned),
    [filteredNotices]
  );

  const handleSyncCloud = async () => {
    try {
      setSyncingToCloud(true);
      setSyncFeedback(null);
      const count = await syncOfficialNoticesToCloud();
      setSyncFeedback(`✔ 공식 홈페이지 공지 ${count}건을 Firestore 데이터베이스에 성공적으로 동기화했습니다.`);
    } catch (err: any) {
      setSyncFeedback(`오류: ${err?.message || "Firestore 동기화 중 권한 오류가 발생했습니다."}`);
    } finally {
      setSyncingToCloud(false);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setWriteError(null);
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      await createNotice({
        title: newTitle.trim(),
        category: newCategory,
        summary: newSummary.trim() || newContent.trim().slice(0, 80),
        content: newContent.trim(),
        isPinned: newPinned,
        officialUrl: newUrl.trim() || "https://education.dongguk.edu",
        eventStartDate: newEventStart || undefined,
        eventEndDate: newEventEnd || newEventStart || undefined,
      });
      setNewTitle("");
      setNewSummary("");
      setNewContent("");
      setNewPinned(false);
      setNewEventStart("");
      setNewEventEnd("");
      setIsWriteModalOpen(false);
    } catch (err: any) {
      setWriteError(err?.message || "공지 등록 중 오류가 발생했습니다.");
    }
  };

  const formattedLastSync = useMemo(() => {
    if (!noticeSyncMeta?.lastSuccessAt) return "실시간 연동 가동 중";
    try {
      return new Date(noticeSyncMeta.lastSuccessAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return noticeSyncMeta.lastSuccessAt;
    }
  }, [noticeSyncMeta]);

  return (
    <div className="space-y-5">
      {/* 1. 상단 타이틀 & 관리자 액션 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-accent" />
            <h1 className="text-xl sm:text-2xl font-black text-ink">
              공식 공지사항
            </h1>
          </div>
          <p className="text-xs text-ink-3 mt-1">
            동국대학교 본교·사범대학·교육학과 공식 공지를 실시간으로 모아보고 원문 링크로 바로 이동할 수 있습니다.
          </p>
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {isRealAuthActive && (
              <button
                type="button"
                onClick={handleSyncCloud}
                disabled={syncingToCloud}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingToCloud ? "animate-spin" : ""}`} />
                {syncingToCloud ? "동기화 중..." : "Firestore 동기화"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsWriteModalOpen(true)}
              className="h-9 px-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              학과 공지 작성
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-line text-ink-3 text-xs font-semibold self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-accent" />
            공식 연동 및 승인 관리자 전용
          </div>
        )}
      </div>

      {syncFeedback && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{syncFeedback}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-emerald-700 hover:underline text-xs cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* 2. 콤팩트 실시간 공식 연동 상태 바 (기존 거대 녹색 배너 축소) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl bg-surface-2 border border-line text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            실시간 연동 중
          </span>
          <span className="text-ink font-semibold">
            동국대 본교 · 사범대 · 교육학과 공식 공지 ({officialCount}건)
          </span>
        </div>
        <div className="flex items-center gap-3 text-ink-3 text-[11px] flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-600" />
            최근 확인: {formattedLastSync}
          </span>
          <div className="flex items-center gap-2">
            {noticeSyncMeta.sources.map((src) => (
              <a
                key={src.sourceId}
                href={src.boardUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent hover:underline inline-flex items-center gap-0.5"
              >
                {src.name.replace(" 공지", "").replace("사항", "")}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 검색 및 1줄 통합 필터 바 */}
      <div className="p-4 rounded-3xl bg-surface border border-line space-y-3.5 shadow-2xs">
        {/* 검색 인풋 */}
        <div className="relative">
          <Search className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="공지 제목, 키워드(수강신청, 졸업, 장학금, 교직실습 등) 검색..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-line bg-surface-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 transition text-ink"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 1줄 통합 카테고리 탭 & 카운트 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-line text-xs">
          <div className="flex flex-wrap gap-1.5">
            {NOTICE_FILTER_TABS.map((tab) => {
              const active = selectedCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategory(tab.value)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-accent text-white shadow-2xs"
                      : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-ink-3 font-medium self-end sm:self-auto">
            총 <strong className="text-accent font-bold">{filteredNotices.length}</strong>건의 공지
          </div>
        </div>
      </div>

      {/* 4. 공지 목록 영역 */}
      {filteredNotices.length === 0 ? (
        <EmptyStateBox
          title="조건에 맞는 공지사항이 없습니다"
          description="다른 카테고리를 선택하거나 검색어를 초기화해 보세요."
          actionLabel="필터 초기화"
          onAction={() => {
            setSelectedCategory("전체");
            setSearchQuery("");
          }}
        />
      ) : (
        <div className="space-y-5">
          {/* 주요 필독 공지 영역 (상위 3개 콤팩트 노출 및 더보기/접기) */}
          {pinnedNotices.length > 0 && (
            <section className="p-4 sm:p-5 rounded-3xl bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/90 dark:border-amber-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-sm font-black text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                    <Pin className="w-4 h-4 text-amber-600" />
                    주요 필독 공지 ({pinnedNotices.length}건)
                  </h2>
                </div>
                {pinnedNotices.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPinned(!showAllPinned)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                  >
                    {showAllPinned ? (
                      <>
                        접기 (3건만 보기) <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        + 필독 공지 전체 보기 ({pinnedNotices.length}건) <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {(showAllPinned ? pinnedNotices : pinnedNotices.slice(0, 3)).map((notice) => (
                  <NoticeCard
                    key={notice.id}
                    notice={notice}
                    onSelect={(n) => setSelectedNotice(n)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 최신 전체 공지 목록 (작성일 최신순으로 시원하게 표시) */}
          {regularNotices.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-ink">
                  최신 공지 목록 ({regularNotices.length}건)
                </h2>
                <span className="text-xs text-ink-3">최신 작성일순</span>
              </div>
              <div className="space-y-2.5">
                {regularNotices.map((notice) => (
                  <NoticeCard
                    key={notice.id}
                    notice={notice}
                    onSelect={(n) => setSelectedNotice(n)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 5. 공지 상세 보기 모달 */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedNotice.isPinned && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-orange-600 text-white text-xs font-bold">
                    <Pin className="w-3 h-3" /> 중요 공지
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-xs font-bold">
                  {selectedNotice.category === "학사 일정"
                    ? "학사공지"
                    : selectedNotice.category}
                </span>
                {selectedNotice.isOfficialSynced ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    공식 홈페이지 연동 ({selectedNotice.organization})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold">
                    학과 관리자 직접 등록
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {selectedNotice.title}
            </h2>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-200 gap-2">
              <span>
                작성 기관 / 작성자:{" "}
                <strong className="text-slate-700">
                  {selectedNotice.organization || selectedNotice.authorName}
                </strong>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> 작성일: {selectedNotice.createdAt}
              </span>
            </div>

            {selectedNotice.scheduleStatus === "confirmed" && selectedNotice.eventStartDate && (
              <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200 text-xs sm:text-sm text-orange-900 flex items-center gap-2 font-bold">
                <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
                <span>
                  확정된 학사·신청 일정: {selectedNotice.eventStartDate}
                  {selectedNotice.eventEndDate &&
                  selectedNotice.eventEndDate !== selectedNotice.eventStartDate
                    ? ` ~ ${selectedNotice.eventEndDate}`
                    : ""}
                </span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {selectedNotice.content}
            </div>

            <div className="p-4 rounded-2xl border border-orange-200 bg-orange-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-slate-900">
                  공식 홈페이지 원문 바로가기
                </p>
                <p className="text-slate-600 break-all">
                  {selectedNotice.officialUrl}
                </p>
              </div>
              <a
                href={selectedNotice.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
              >
                원문 이동하기 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 관리자 공지 작성 모달 */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-600" />
                학과 관리자 공지 등록
              </h2>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {writeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {writeError}
              </div>
            )}

            <form onSubmit={handleCreateNotice} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  공지 분류 *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as NoticeCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="교육학과 공지">교육학과 공지</option>
                  <option value="교직 관련 안내">교직 관련 안내</option>
                  <option value="학사 일정">학사공지</option>
                  <option value="장학 및 지원">장학 및 지원</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  공지 제목 *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: [학과안내] 2026-2학기 졸업시험 일정 안내"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  공지 본문 내용 *
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="공지 상세 내용을 입력하세요..."
                  rows={5}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    일정 시작일 (선택)
                  </label>
                  <input
                    type="date"
                    value={newEventStart}
                    onChange={(e) => setNewEventStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    일정 종료일 (선택)
                  </label>
                  <input
                    type="date"
                    value={newEventEnd}
                    onChange={(e) => setNewEventEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newPinned}
                  onChange={(e) => setNewPinned(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600"
                />
                <span className="font-bold text-slate-700">
                  중요 공지 (게시판 상단에 고정하기)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                  공지 등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
