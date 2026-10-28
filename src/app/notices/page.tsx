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
  { label: "학교 공지", value: "학교 공지" },
  { label: "교육학과 공지", value: "교육학과 공지" },
  { label: "학사 일정·학사공지", value: "학사 일정" },
  { label: "장학 및 지원", value: "장학 및 지원" },
  { label: "교직 관련 안내", value: "교직 관련 안내" },
] as const;

export default function NoticesPage() {
  const {
    notices,
    noticeSyncMeta,
    createNotice,
    syncOfficialNoticesToCloud,
    updateNoticeSchedule,
    currentRole,
    isRealAuthActive,
    authUserProfile,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("전체");
  const [hideSampleNotices, setHideSampleNotices] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

  // 캘린더 탭 상태 ("confirmed" | "needs_review")
  const [calendarTab, setCalendarTab] = useState<"confirmed" | "needs_review">("confirmed");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");

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

  // 확정 일정 공지 목록 (절대 게시글 작성일(createdAt)을 행사일로 사용하지 않고, scheduleStatus === "confirmed" 및 eventStartDate가 있는 공지만 포함)
  const confirmedScheduleNotices = useMemo(() => {
    return notices
      .filter((n) => n.scheduleStatus === "confirmed" && Boolean(n.eventStartDate))
      .sort((a, b) => (a.eventStartDate || "").localeCompare(b.eventStartDate || ""));
  }, [notices]);

  // 날짜 불확실 · 관리자 검토 필요 공지 목록 (scheduleStatus === "needs_review")
  const reviewNeededNotices = useMemo(() => {
    return notices
      .filter((n) => n.scheduleStatus === "needs_review")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [notices]);

  const filteredNotices = useMemo(() => {
    return notices
      .filter((n) => {
        if (hideSampleNotices && n.isSampleData) return false;
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
        // 공식 연동 공지 및 관리자 실제 공지를 예시 데이터보다 우선 표시
        if (Boolean(a.isSampleData) !== Boolean(b.isSampleData)) {
          return a.isSampleData ? 1 : -1;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [notices, selectedCategory, selectedSourceFilter, hideSampleNotices, searchQuery]);

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

  const handleConfirmSchedule = async (noticeId: string) => {
    if (!editStartDate) return;
    await updateNoticeSchedule(noticeId, {
      scheduleStatus: "confirmed",
      eventStartDate: editStartDate,
      eventEndDate: editEndDate || editStartDate,
    });
    setEditingScheduleId(null);
    setEditStartDate("");
    setEditEndDate("");
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
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs transition"
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

      {/* 📅 공식 공지 기반 학사·학과·교직 일정 캘린더 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                공식 공지 연동 학사·신청 일정 캘린더
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              신청 기간·행사 일시가 명확히 확인된 공지만 캘린더에 표시하며, 게시글 작성일을 행사일로 오인하지 않습니다.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCalendarTab("confirmed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                calendarTab === "confirmed"
                  ? "bg-orange-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              확정 일정 ({confirmedScheduleNotices.length})
            </button>
            <button
              type="button"
              onClick={() => setCalendarTab("needs_review")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                calendarTab === "needs_review"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              일정 검토 필요 ({reviewNeededNotices.length})
            </button>
          </div>
        </div>

        {calendarTab === "confirmed" ? (
          confirmedScheduleNotices.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
              현재 제목에서 확정된 신청 기간·행사 일정이 없습니다. [일정 검토 필요] 탭에서 원문 일정을 확인해 보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {confirmedScheduleNotices.map((item) => (
                <div
                  key={`cal-${item.id}`}
                  className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/40 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-orange-600 text-white text-xs font-extrabold">
                        <Calendar className="w-3 h-3" />
                        {item.eventStartDate}
                        {item.eventEndDate && item.eventEndDate !== item.eventStartDate
                          ? ` ~ ${item.eventEndDate}`
                          : ""}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">
                        {item.organization || item.authorName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNotice(item)}
                      className="text-left text-xs sm:text-sm font-bold text-slate-900 hover:text-orange-600 line-clamp-2"
                    >
                      {item.title}
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-orange-200/60 text-[11px]">
                    <span className="text-slate-500">
                      분류: <strong className="text-slate-700">{item.category}</strong> (작성일: {item.createdAt})
                    </span>
                    <a
                      href={item.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-orange-700 hover:underline inline-flex items-center gap-1"
                    >
                      원문 확인 <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">날짜 자동 등록 보류 안내 (게시글 작성일 오인 방지)</p>
                <p className="text-amber-800 mt-0.5">
                  아래 공지는 제목에 &lsquo;신청·모집·접수·특강·설문·시행&rsquo; 키워드가 포함되어 있으나 제목만으로 정확한 기간을 단정할 수 없어 자동 캘린더 등록을 보류한 항목입니다.
                  {isAdmin && " 관리자는 원문 확인 후 아래에서 일정을 확정하여 캘린더에 등록할 수 있습니다."}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {reviewNeededNotices.map((item) => (
                <div
                  key={`rev-${item.id}`}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                        일정 검토 필요
                      </span>
                      <span className="font-semibold text-orange-700">[{item.category}]</span>
                      <span className="text-slate-500">
                        {item.organization || item.authorName} · 게시일 {item.createdAt}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 truncate">{item.title}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <a
                      href={item.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-orange-400 font-semibold inline-flex items-center gap-1"
                    >
                      원문에서 기간 확인 <ExternalLink className="w-3 h-3" />
                    </a>
                    {isAdmin && (
                      editingScheduleId === item.id ? (
                        <div className="flex items-center gap-1.5 flex-wrap bg-white p-1.5 rounded-lg border border-orange-300">
                          <input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => setEditStartDate(e.target.value)}
                            className="px-2 py-1 rounded border border-slate-200 text-xs"
                          />
                          <span>~</span>
                          <input
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="px-2 py-1 rounded border border-slate-200 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmSchedule(item.id)}
                            className="px-2.5 py-1 rounded bg-orange-600 text-white font-bold"
                          >
                            확정
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingScheduleId(null)}
                            className="px-2 py-1 rounded bg-slate-100 text-slate-600"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingScheduleId(item.id);
                            setEditStartDate(item.createdAt);
                            setEditEndDate(item.createdAt);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold"
                        >
                          일정 입력·확정
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 검색 및 카테고리·출처 필터 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="공지 제목, 출처(교육학과, 사범대학, 학사공지), 키워드(교직, 다전공, 장학, 수강신청) 검색..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* 카테고리 필터 탭 */}
        <div className="flex flex-wrap gap-1.5">
          {NOTICE_FILTER_TABS.map((tab) => {
            const active = selectedCategory === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedCategory(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  active
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 출처 세부 필터 & 예시 데이터 숨김 옵션 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-500 mr-1">출처 구분:</span>
            {[
              { label: "전체 출처", value: "전체" },
              { label: "공식 홈페이지 연동만", value: "official_only" },
              { label: "교육학과 학부공지", value: "edu_dept_news2" },
              { label: "사범대학 공지", value: "edu_college_notice" },
              { label: "학교 학사공지", value: "dgu_haksa" },
              { label: "학교 장학공지", value: "dgu_janghak" },
              { label: "학교 일반공지", value: "dgu_general" },
            ].map((src) => (
              <button
                key={src.value}
                type="button"
                onClick={() => setSelectedSourceFilter(src.value)}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  selectedSourceFilter === src.value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 text-slate-600 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={hideSampleNotices}
              onChange={(e) => setHideSampleNotices(e.target.checked)}
              className="rounded text-orange-600"
            />
            <span>예시 데이터 숨기기</span>
          </label>
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
            setHideSampleNotices(false);
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
                className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
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
                  <option value="학교 공지">학교 공지</option>
                  <option value="학사 일정">학사 일정·학사공지</option>
                  <option value="장학 및 지원">장학 및 지원</option>
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
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold inline-flex items-center gap-1"
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
