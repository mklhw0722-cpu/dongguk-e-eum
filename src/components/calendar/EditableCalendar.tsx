"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Clock,
  MapPin,
  FileText,
  X,
  Check,
  Sparkles,
} from "lucide-react";

export type EventCategory =
  | "assignment" // 과제·팀플
  | "exam"       // 시험
  | "class"      // 수업·특강
  | "personal"   // 개인·약속
  | "official";  // 학사·공지

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (선택)
  time?: string; // HH:mm 또는 ""
  isAllDay?: boolean;
  category: EventCategory;
  location?: string;
  memo?: string;
  isOfficial?: boolean; // 공지사항 연동 여부
}

interface NoticeItem {
  id: string;
  title: string;
  eventStartDate?: string;
  eventEndDate?: string;
  category?: string;
  organization?: string;
  createdAt?: string;
}

interface EditableCalendarProps {
  officialNotices?: NoticeItem[];
  className?: string;
}

const CATEGORY_MAP: Record<
  EventCategory,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  assignment: {
    label: "과제·팀플",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
    border: "border-orange-200 dark:border-orange-900/60",
  },
  exam: {
    label: "시험·평가",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    border: "border-rose-200 dark:border-rose-900/60",
  },
  class: {
    label: "수업·특강",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    border: "border-blue-200 dark:border-blue-900/60",
  },
  personal: {
    label: "개인·약속",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    border: "border-emerald-200 dark:border-emerald-900/60",
  },
  official: {
    label: "학사공지",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
    border: "border-indigo-200 dark:border-indigo-900/60",
  },
};

const STORAGE_KEY = "dongguk_custom_calendar_events_v1";

// 헬퍼: YYYY-MM-DD 포맷
const formatDateKey = (year: number, month: number, day: number): string => {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
};

export default function EditableCalendar({
  officialNotices = [],
  className = "",
}: EditableCalendarProps) {
  // 현재 보고 있는 달력 기준 날짜
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1~12

  // 선택된 날짜 (기본은 오늘)
  const todayStr = useMemo(
    () => formatDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate()),
    [today]
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // 사용자 일정 상태
  const [userEvents, setUserEvents] = useState<CalendarEvent[]>([]);

  // 모달(추가/수정) 상태
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // 폼 입력 상태
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formEndDate, setFormEndDate] = useState<string>("");
  const [formTime, setFormTime] = useState<string>("");
  const [formIsAllDay, setFormIsAllDay] = useState<boolean>(true);
  const [formCategory, setFormCategory] = useState<EventCategory>("assignment");
  const [formLocation, setFormLocation] = useState<string>("");
  const [formMemo, setFormMemo] = useState<string>("");

  // 1. LocalStorage에서 일정 로드 (없으면 초기 안내 샘플 제공)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setUserEvents(JSON.parse(saved));
      } else {
        // 초기 기본 샘플 일정 등록
        const initialSamples: CalendarEvent[] = [
          {
            id: "sample-1",
            title: "교육공학 프로젝트 발표 준비",
            date: todayStr,
            time: "14:00",
            isAllDay: false,
            category: "assignment",
            location: "학술문화관 세미나실",
            memo: "발표 슬라이드 및 시연 화면 점검하기",
          },
          {
            id: "sample-2",
            title: "교육방법론 과제 제출 마감",
            date: formatDateKey(
              today.getFullYear(),
              today.getMonth() + 1,
              Math.min(today.getDate() + 3, 28)
            ),
            isAllDay: true,
            category: "assignment",
            memo: "이러닝 포털 과제함에 PDF 업로드",
          },
          {
            id: "sample-3",
            title: "학과 멘토링 모임",
            date: formatDateKey(
              today.getFullYear(),
              today.getMonth() + 1,
              Math.min(today.getDate() + 7, 28)
            ),
            time: "18:30",
            isAllDay: false,
            category: "personal",
            location: "혜화관 4층",
          },
        ];
        setUserEvents(initialSamples);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSamples));
      }
    } catch {
      // 로컬스토리지 접근 제한 환경 등 안전 폴백
    }
  }, [today, todayStr]);

  // 일정 변경 시 LocalStorage에 자동 저장
  const saveEvents = (newEvents: CalendarEvent[]) => {
    setUserEvents(newEvents);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newEvents));
    } catch (err) {
      console.error("캘린더 일정 저장 실패:", err);
    }
  };

  // 전체 이벤트 통합 (사용자가 직접 등록한 일정만 관리)
  const allEvents = userEvents;

  // 날짜별 이벤트 매핑 (빠른 조회를 위해)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    allEvents.forEach((ev) => {
      if (!ev.date) return;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [allEvents]);

  // 달력 날짜 계산 (해당 월 1일의 요일과 마지막 날짜)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0(일) ~ 6(토)
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

    const days: Array<{
      day: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // 이전 달 빈칸 채우기
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateKey = formatDateKey(prevYear, prevMonth, d);
      days.push({
        day: d,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
      });
    }

    // 이번 달 날짜
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = formatDateKey(currentYear, currentMonth, d);
      days.push({
        day: d,
        dateKey,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
      });
    }

    // 다음 달 빈칸 채우기 (총 35일 또는 42일로 맞춤)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateKey = formatDateKey(nextYear, nextMonth, d);
      days.push({
        day: d,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  // 월 이동 함수
  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  // 일정 추가 모달 열기
  const handleOpenAddModal = (dateToSet?: string) => {
    setEditingEventId(null);
    setFormTitle("");
    setFormDate(dateToSet || selectedDate || todayStr);
    setFormEndDate("");
    setFormTime("14:00");
    setFormIsAllDay(true);
    setFormCategory("assignment");
    setFormLocation("");
    setFormMemo("");
    setIsModalOpen(true);
  };

  // 일정 수정 모달 열기
  const handleOpenEditModal = (event: CalendarEvent) => {
    
    setEditingEventId(event.id);
    setFormTitle(event.title);
    setFormDate(event.date);
    setFormEndDate(event.endDate || "");
    setFormTime(event.time || "14:00");
    setFormIsAllDay(event.isAllDay ?? !event.time);
    setFormCategory(event.category);
    setFormLocation(event.location || "");
    setFormMemo(event.memo || "");
    setIsModalOpen(true);
  };

  // 모달 폼 저장 (추가 또는 수정)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("일정 제목을 입력해 주세요.");
      return;
    }
    if (!formDate) {
      alert("날짜를 선택해 주세요.");
      return;
    }

    if (editingEventId) {
      // 수정
      const updated = userEvents.map((ev) =>
        ev.id === editingEventId
          ? {
              ...ev,
              title: formTitle.trim(),
              date: formDate,
              endDate: formEndDate || undefined,
              time: formIsAllDay ? undefined : formTime,
              isAllDay: formIsAllDay,
              category: formCategory,
              location: formLocation.trim() || undefined,
              memo: formMemo.trim() || undefined,
            }
          : ev
      );
      saveEvents(updated);
    } else {
      // 신규 추가
      const newEvent: CalendarEvent = {
        id: `event-${Date.now()}`,
        title: formTitle.trim(),
        date: formDate,
        endDate: formEndDate || undefined,
        time: formIsAllDay ? undefined : formTime,
        isAllDay: formIsAllDay,
        category: formCategory,
        location: formLocation.trim() || undefined,
        memo: formMemo.trim() || undefined,
      };
      saveEvents([...userEvents, newEvent]);
    }

    setSelectedDate(formDate);
    setIsModalOpen(false);
  };

  // 일정 삭제
  const handleDeleteEvent = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("이 일정을 정말 삭제하시겠습니까?")) return;
    const filtered = userEvents.filter((ev) => ev.id !== id);
    saveEvents(filtered);
    if (editingEventId === id) {
      setIsModalOpen(false);
    }
  };

  // 선택된 날짜의 이벤트 목록
  const selectedDateEvents = useMemo(() => {
    return (eventsByDate[selectedDate] || []).sort((a, b) => {
      // 시간순 정렬 (종일은 위로)
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.time || "").localeCompare(b.time || "");
    });
  }, [eventsByDate, selectedDate]);

  return (
    <section className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs transition-colors ${className}`}>
      {/* 캘린더 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-orange-600">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                나의 학업 & 일정 캘린더
                <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-900">
                  직접 수정 가능
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            원하는 날짜를 클릭해 새 일정을 등록하고, 언제든 수정·삭제할 수 있어요.
          </p>
        </div>

        {/* 상단 버튼들 */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          

          <button
            type="button"
            onClick={() => handleOpenAddModal(selectedDate)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>일정 추가</span>
          </button>
        </div>
      </div>

      {/* 월 이동 컨트롤러 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
            {currentYear}년 {currentMonth}월
          </span>
          <button
            type="button"
            onClick={goToToday}
            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevMonth}
            aria-label="이전 달"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="다음 달"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 달력 그리드 */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center py-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
          <span className="text-rose-500">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-blue-500">토</span>
        </div>

        {/* 날짜 셀 그리드 */}
        <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200 dark:bg-slate-800">
          {calendarDays.map((cell, idx) => {
            const isSelected = cell.dateKey === selectedDate;
            const dayEvents = eventsByDate[cell.dateKey] || [];
            const isWeekend = idx % 7 === 0 || idx % 7 === 6;

            return (
              <button
                key={cell.dateKey + idx}
                type="button"
                onClick={() => setSelectedDate(cell.dateKey)}
                onDoubleClick={() => handleOpenAddModal(cell.dateKey)}
                className={`min-h-[64px] sm:min-h-[76px] p-1.5 text-left flex flex-col justify-between transition group relative ${
                  cell.isCurrentMonth
                    ? "bg-white dark:bg-slate-900 hover:bg-orange-50/40 dark:hover:bg-orange-950/20"
                    : "bg-slate-50/80 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600"
                } ${
                  isSelected
                    ? "ring-2 ring-orange-500 dark:ring-orange-500 z-10 bg-orange-50/30 dark:bg-orange-950/30"
                    : ""
                }`}
              >
                {/* 상단 날짜 번호 */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                      cell.isToday
                        ? "bg-orange-600 text-white"
                        : isSelected
                        ? "text-orange-600 font-extrabold"
                        : idx % 7 === 0
                        ? "text-rose-500"
                        : idx % 7 === 6
                        ? "text-blue-500"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {cell.day}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400 sm:hidden">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* 등록된 일정 뱃지 (화면 크기에 따라 축약 또는 뱃지) */}
                <div className="mt-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const cat = CATEGORY_MAP[ev.category] || CATEGORY_MAP.assignment;
                    return (
                      <div
                        key={ev.id}
                        title={ev.title}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium border hidden sm:block ${cat.bg} ${cat.text} ${cat.border}`}
                      >
                        {ev.time && !ev.isAllDay ? `${ev.time} ` : ""}
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <span className="hidden sm:inline-block text-[9px] font-bold text-slate-400 px-1">
                      +{dayEvents.length - 2}개 더
                    </span>
                  )}

                  {/* 모바일 화면에서는 컬러 점(dot) 표시 */}
                  <div className="flex sm:hidden gap-1 flex-wrap mt-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cat = CATEGORY_MAP[ev.category] || CATEGORY_MAP.assignment;
                      return (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${cat.dot}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 상세 & 일정 목록 */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-600"></span>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {selectedDate} 일정 ({selectedDateEvents.length}개)
            </h3>
            {selectedDate === todayStr && (
              <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[10px] font-bold">
                오늘
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleOpenAddModal(selectedDate)}
            className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            이 날에 새 일정 등록
          </button>
        </div>

        {selectedDateEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 space-y-2">
            <p>등록된 일정이 없습니다.</p>
            <button
              type="button"
              onClick={() => handleOpenAddModal(selectedDate)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:border-orange-400 hover:text-orange-600 transition"
            >
              <Plus className="w-3.5 h-3.5" /> 새 일정 만들기
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDateEvents.map((ev) => {
              const cat = CATEGORY_MAP[ev.category] || CATEGORY_MAP.assignment;
              return (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 hover:border-orange-300 dark:hover:border-orange-700 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cat.bg} ${cat.text} ${cat.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                        {cat.label}
                      </span>
                      {ev.isAllDay ? (
                        <span className="text-[11px] text-slate-500 font-medium">
                          종일
                        </span>
                      ) : (
                        ev.time && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {ev.time}
                          </span>
                        )
                      )}
                      {ev.location && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {ev.location}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {ev.title}
                    </p>

                    {ev.memo && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{ev.memo}</span>
                      </p>
                    )}
                  </div>

                  {/* 수정 / 삭제 액션 버튼 */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(ev)}
                      title="일정 수정"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteEvent(ev.id, e)}
                      title="일정 삭제"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 일정 추가 / 수정 팝업 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-orange-600">
                  {editingEventId ? (
                    <Pencil className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {editingEventId ? "일정 수정하기" : "새 일정 등록하기"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 입력 폼 */}
            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              {/* 분류 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  분류 선택
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["assignment", "exam", "class", "personal"] as EventCategory[]).map(
                    (catKey) => {
                      const item = CATEGORY_MAP[catKey];
                      const isSelected = formCategory === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setFormCategory(catKey)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition text-center ${
                            isSelected
                              ? `${item.bg} ${item.text} border-orange-500 ring-2 ring-orange-500/30`
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 일정 제목 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  일정 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 교육공학 팀플 모임, 중간고사 등"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* 날짜 및 시간 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    날짜 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      시간
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsAllDay}
                        onChange={(e) => setFormIsAllDay(e.target.checked)}
                        className="accent-orange-600 rounded"
                      />
                      <span>하루 종일</span>
                    </label>
                  </div>
                  <input
                    type="time"
                    disabled={formIsAllDay}
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      formIsAllDay ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800" : ""
                    }`}
                  />
                </div>
              </div>

              {/* 장소 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  장소 (선택)
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="예: 학술문화관 302호, 혜화관 카페"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  메모 (선택)
                </label>
                <textarea
                  rows={2}
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  placeholder="준비물이나 참고할 내용을 자유롭게 적어보세요."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* 버튼 액션 */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEventId)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 삭제
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {editingEventId ? "수정 완료" : "일정 등록"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
