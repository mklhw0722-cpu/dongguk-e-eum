"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Notice, NoticeCategory } from "@/types";
import {
  NoticeCard,
  EmptyStateBox,
} from "@/components/common/Cards";
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
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
} from "lucide-react";

const NOTICE_FILTER_TABS = [
  { label: "전체 공지", value: "전체" },
  { label: "교육학과 공지", value: "교육학과 공지" },
  { label: "학사 일정·학사공지", value: "학사 일정" },
  { label: "교직 관련 안내", value: "교직 관련 안내" },
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
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

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

  const filteredNotices = useMemo(() => {
    return notices
      .filter((n) => {
        if (n.isSampleData) return false;
        const matchCat =
          selectedCategory === "전체" || n.category === selectedCategory;
        const matchSource =
          selectedSourceFilter === "전체" ||
          (selectedSourceFilter === "official_only" && n.isOfficialSynced) ||
          (selectedSourceFilter === "admin_only" && !n.isOfficialSynced) ||
          n.sourceId === selectedSourceFilter;

        const q = searchQuery.trim().toLowerCase();
        const matchSearch =
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q) ||
          (n.organization || "").toLowerCase().includes(q) ||
          (n.subCategoryTag || "").toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q);
        return matchCat && matchSource && matchSearch;
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [notices, selectedCategory, selectedSourceFilter, searchQuery]);

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
    if (!noticeSyncMeta?.lastSuccessAt) return "미확인";
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
    <div className="space-y-6">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              학교·사범대학·교육학과 공식 공지사항
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            동국대학교·사범대학·교육학과 공식 홈페이지의 최신 공지를 자동 연동하여 한눈에 확인하고 원문으로 바로 이동할 수 있습니다.
          </p>
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {isRealAuthActive && (
              <button
                type="button"
                onClick={handleSyncCloud}
                disabled={syncingToCloud}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs transition"
              >
                <RefreshCw className={`w-4 h-4 ${syncingToCloud ? "animate-spin" : ""}`} />
                {syncingToCloud ? "동기화 중..." : "Firestore에 공식 공지 동기화"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsWriteModalOpen(true)}
              className="h-9 px-3.5 rounded-lg bg-ink text-white hover:bg-ink/85 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              학과 관리자 공지 등록
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            공지 등록·수정은 승인된 학과 관리자 전용입니다
          </div>
        )}
      </div>

      {syncFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2">
          <span>{syncFeedback}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-emerald-700 hover:underline text-xs"
          >
            닫기
          </button>
        </div>
      )}

      {/* 공식 홈페이지 자동 연동 상태 배너 */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              공식 홈페이지 자동 연동 가동 중
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              총 {officialCount}건의 동국대·사범대·교육학과 공식 공지가 연동되어 있습니다
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-emerald-700" />
            <span>마지막 성공 시각: {formattedLastSync}</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          • <strong>저작권 및 robots.txt 준수</strong>: 각 홈페이지의 <code>robots.txt</code> 허용 범위 내에서 공지 제목·작성일·작성기관·분류·원문 링크만 수집하며, 본문이나 첨부파일을 무단 복제하지 않습니다. ({noticeSyncMeta.scheduleNote})
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
          {noticeSyncMeta.sources.map((src) => (
            <a
              key={src.sourceId}
              href={src.boardUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-200/80 hover:border-orange-400 text-xs transition"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  {src.name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{src.organization}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] shrink-0">
                {src.fetchedCount}건 <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* 검색 및 카테고리·출처 필터 바 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="공지 제목, 작성기관, 키워드(수강신청, 졸업, 장학금, 교직실습 등) 검색..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white transition"
          />
        </div>

        {/* 카테고리 필터 탭 */}
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-400">분야별 공지</div>
          <div className="flex flex-wrap gap-2">
            {NOTICE_FILTER_TABS.map((tab) => {
              const active = selectedCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategory(tab.value)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-orange-600 text-white shadow-xs scale-102"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 출처 세부 필터 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-500 dark:text-slate-400 mr-1">출처:</span>
            {[
              { label: "전체 출처", value: "전체" },
              { label: "교육학과 공지", value: "edu_dept_news2" },
              { label: "사범대학 공지", value: "edu_college_notice" },
              { label: "학교 학사공지", value: "dgu_haksa" },
            ].map((src) => (
              <button
                key={src.value}
                type="button"
                onClick={() => setSelectedSourceFilter(src.value)}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  selectedSourceFilter === src.value
                    ? "bg-slate-900 dark:bg-slate-700 text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            총 <strong className="text-orange-600 font-bold">{filteredNotices.length}</strong>건의 공지사항
          </div>
        </div>
      </div>

      {/* 공지 목록 */}
      {filteredNotices.length === 0 ? (
        <EmptyStateBox
          title="조건에 맞는 공지사항이 없습니다"
          description="다른 카테고리를 선택하거나 검색어를 초기화해 보세요."
          actionLabel="필터 초기화"
          onAction={() => {
            setSelectedCategory("전체");
            setSelectedSourceFilter("전체");
            setSearchQuery("");
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredNotices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              onSelect={(n) => setSelectedNotice(n)}
            />
          ))}
        </div>
      )}

      {/* 공지 상세 보기 모달 */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedNotice.isPinned && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-orange-600 text-white text-xs font-bold">
                    <Pin className="w-3 h-3" /> 중요 고정
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-xs font-bold">
                  {selectedNotice.category === "학사 일정"
                    ? "학사 일정·학사공지"
                    : selectedNotice.category}
                </span>
                {selectedNotice.isOfficialSynced ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    공식 홈페이지 연동 ({selectedNotice.organization})
                  </span>
                ) : selectedNotice.isSampleData ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
                    예시 데이터
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
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-slate-900">
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
                className="h-9 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-raise transition cursor-pointer shrink-0"
              >
                공식 홈페이지 원문 이동 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 공지 작성 모달 */}
      {isWriteModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">
                학과 관리자 공지사항 직접 등록
              </h2>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {writeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {writeError}
              </div>
            )}

            <form onSubmit={handleCreateNotice} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold mb-1">공지 분류</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as NoticeCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <option value="교육학과 공지">교육학과 공지</option>
                  <option value="학사 일정">학사 일정·학사공지</option>
                  <option value="교직 관련 안내">교직 관련 안내</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">공지 제목</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 2026학년도 2학기 교육학과 학술제 참가 신청 안내"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">한 줄 요약</label>
                <input
                  type="text"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="목록에 표시될 짧은 요약 문구"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">본문 안내 내용</label>
                <textarea
                  rows={4}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="상세 공지 내용을 입력하세요..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">
                    캘린더 시작일 (선택 · 확정 시 입력)
                  </label>
                  <input
                    type="date"
                    value={newEventStart}
                    onChange={(e) => setNewEventStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    캘린더 종료일 (선택)
                  </label>
                  <input
                    type="date"
                    value={newEventEnd}
                    onChange={(e) => setNewEventEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">관련 공식 출처 링크 URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPinned}
                  onChange={(e) => setNewPinned(e.target.checked)}
                  className="rounded text-orange-600"
                />
                <span className="font-semibold">중요 공지로 게시판 상단에 고정하기</span>
              </label>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-raise transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> 공지 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
