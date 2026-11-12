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
import { useApp } from "@/context/AppContext";
import {
  subscribeToUserCalendarEvents,
  saveUserCalendarEventToFirestore,
  deleteUserCalendarEventFromFirestore,
  getFirebaseInstances,
} from "@/lib/firebase";

export type EventCategory =
  | "assignment" // 과제·팀플
  | "exam"       // 시험
  | "class"      // 수업·특강
  | "personal"   // 개인·약속
  | "official";  // 학사·공지

export interface CalendarEvent {
  id: string;
  userId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (선택)
  time?: string; // HH:mm 또는 ""
  isAllDay?: boolean;
  category: EventCategory;
  location?: string;
  memo?: string;
  isOfficial?: boolean; // 공지사항 연동 여부
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 모바일 및 모든 접속 기기에서 예시/더미 일정을 원천 차단하기 위한 필터 함수
 */
export const isSampleCalendarEvent = (ev: CalendarEvent): boolean => {
  if (!ev) return true;
  if (typeof ev.id === "string" && ev.id.startsWith("sample-")) return true;
  if (typeof ev.title === "string") {
    const trimmed = ev.title.trim();
    if (trimmed.includes("[예시]")) return true;
    if (trimmed === "교육공학 프로젝트 발표 준비") return true;
    if (trimmed === "교육방법론 과제 제출 마감") return true;
    if (trimmed === "학과 멘토링 모임") return true;
  }
  return false;
};

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
  title?: string;
}

const CATEGORY_MAP: Record<
  EventCategory,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  assignment: {
    label: "과제·팀플",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
    border: "border-orange-200",
  },
  exam: {
    label: "시험·평가",
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-500",
    border: "border-rose-200",
  },
  class: {
    label: "수업·특강",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    border: "border-blue-200",
  },
  personal: {
    label: "개인·약속",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
  },
  official: {
    label: "학사공지",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
    border: "border-indigo-200",
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
  title,
}: EditableCalendarProps) {
  const { currentUser, currentRole, consultations } = useApp();

  // 교수, 졸업생, 관리자로 로그인했을 때는 '나의 캘린더'로 심플하게 표시
  const isNonStudent =
    currentUser?.role === "professor" ||
    currentRole === "professor" ||
    currentUser?.role === "alumni" ||
    currentRole === "alumni" ||
    currentUser?.role === "admin" ||
    currentRole === "admin";

  const calendarTitle =
    title || (isNonStudent ? "나의 캘린더" : "나의 학업 & 일정 캘린더");

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

  // 1. LocalStorage에서 일정 로드 및 기존 잔존 예시(더미) 데이터 완전 정제
  useEffect(() => {
    try {
      const isAdmin = currentUser?.role === "admin" || currentRole === "admin";
      const keysToClean = [
        STORAGE_KEY,
        currentUser?.id ? `dongguk_custom_calendar_events_v2_${currentUser.id}` : null,
      ].filter(Boolean) as string[];

      let initialLoaded: CalendarEvent[] = [];

      for (const key of keysToClean) {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              // 예시 데이터 필터링 제거 및 백상아 교수 잔여 일정 완전 정제
              const clean = parsed.filter((item: CalendarEvent) => {
                if (isSampleCalendarEvent(item)) return false;
                if (item.id?.includes("c-req-1") || item.id?.includes("c-req-2")) return false;
                if (item.title?.includes("백상아") || item.memo?.includes("백상아")) return false;
                // 타인의 상담 일정 필터링: 관리자 계정은 대면 상담 일정 일체 미포함, 일반 회원은 본인 참여 일정만 포함
                if (item.id?.startsWith("consult-cal-") || item.title?.includes("[대면 상담]")) {
                  if (isAdmin) return false;
                  if (item.userId && currentUser?.id && item.userId !== currentUser.id) return false;
                }
                return true;
              });
              if (clean.length !== parsed.length) {
                localStorage.setItem(key, JSON.stringify(clean));
              }
              if (clean.length > 0 && initialLoaded.length === 0) {
                initialLoaded = clean;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // 모바일이든 신규 접속이든 예시 일정 절대 자동 주입 금지 (순수 사용자 일정만 표시)
      setUserEvents(initialLoaded);
    } catch {
      // 로컬스토리지 접근 제한 환경 등 안전 폴백
    }
  }, [currentUser?.id, currentUser?.role, currentRole]);

  // 2. 로그인 사용자 대상 Firestore 실시간 연동 (모바일·PC 실시간 동기화)
  useEffect(() => {
    if (!currentUser?.id) return;
    const { db } = getFirebaseInstances();
    if (!db) return;
    const isAdmin = currentUser?.role === "admin" || currentRole === "admin";

    const unsubscribe = subscribeToUserCalendarEvents(
      currentUser.id,
      (cloudEvents) => {
        // 클라우드 일정 중 예시/더미 데이터 및 관리자 계정의 타인 상담 일정 제외
        const clean = cloudEvents.filter((ev) => {
          if (isSampleCalendarEvent(ev)) return false;
          if (isAdmin && (ev.id?.startsWith("consult-cal-") || ev.title?.includes("[대면 상담]"))) {
            return false;
          }
          return true;
        });
        setUserEvents(clean);

        // 로컬스토리지 캐시 동기화
        try {
          const userKey = `dongguk_custom_calendar_events_v2_${currentUser.id}`;
          localStorage.setItem(userKey, JSON.stringify(clean));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        } catch {
          // ignore
        }

        // 만약 클라우드에 예시 일정이 등록되어 있거나 관리자 계정에 상담 일정이 남아있다면 백그라운드 자동 정리
        const samples = cloudEvents.filter((ev) => {
          if (isSampleCalendarEvent(ev)) return true;
          if (isAdmin && (ev.id?.startsWith("consult-cal-") || ev.title?.includes("[대면 상담]"))) {
            return true;
          }
          return false;
        });
        samples.forEach((sample) => {
          deleteUserCalendarEventFromFirestore(currentUser.id, sample.id).catch(() => {});
        });
      },
      (err) => {
        console.warn("캘린더 일정 실시간 동기화 오류:", err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role, currentRole]);

  // 일정 변경 시 LocalStorage에 자동 저장
  const saveEvents = (newEvents: CalendarEvent[]) => {
    const clean = newEvents.filter((ev) => !isSampleCalendarEvent(ev));
    setUserEvents(clean);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      if (currentUser?.id) {
        localStorage.setItem(`dongguk_custom_calendar_events_v2_${currentUser.id}`, JSON.stringify(clean));
      }
    } catch (err) {
      console.error("캘린더 일정 저장 실패:", err);
    }
  };

  // 대면 상담 수락 시 해당 날짜로 달력 자동 이동 이벤트 리스너
  useEffect(() => {
    const handleSelectDate = (e: Event) => {
      const customEv = e as CustomEvent<{ date?: string }>;
      const targetDate = customEv.detail?.date;
      if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        const [y, m] = targetDate.split("-").map(Number);
        if (y && m) {
          setCurrentYear(y);
          setCurrentMonth(m);
        }
        setSelectedDate(targetDate);
      }
    };
    window.addEventListener("dongguk-calendar-select-date", handleSelectDate);
    return () => window.removeEventListener("dongguk-calendar-select-date", handleSelectDate);
  }, []);

  // 전체 이벤트 통합 (사용자가 직접 등록한 일정 + 승인된 대면 상담 일정 자동 연동)
  const allEvents = useMemo(() => {
    const isAdmin = currentUser?.role === "admin" || currentRole === "admin";
    const myId = currentUser?.id;
    const isProf = currentUser?.role === "professor" || currentRole === "professor";

    // 관리자 계정은 타인의 대면 상담 일정을 userEvents에서 철저히 배제
    const filteredUserEvents = userEvents.filter((ev) => {
      if (ev.title?.includes("백상아") || ev.memo?.includes("백상아")) return false;
      if (ev.id?.startsWith("consult-cal-") || ev.title?.includes("[대면 상담]")) {
        if (isAdmin) return false;
        if (ev.userId && myId && ev.userId !== myId) return false;
      }
      return true;
    });

    const existingIds = new Set(filteredUserEvents.map((ev) => ev.id));

    // consultEvents: 관리자 계정일 때는 빈 배열 반환 (타인의 상담 일정 절대 캘린더 미노출)
    const consultEvents: CalendarEvent[] = (consultations || [])
      .filter((c) => {
        if (isAdmin) return false; // 관리자 계정에서는 타인의 상담 일정 절대 미노출
        if (c.status !== "accepted" || c.consultationMethod === "채팅" || !c.preferredDate) return false;
        if (
          c.id === "c-req-1" ||
          c.id === "c-req-2" ||
          c.professorId === "u-prof-1" ||
          c.professorName?.includes("백상아")
        ) {
          return false;
        }
        // 상담 당사자(교수 본인 또는 신청 학생 본인)의 캘린더에만 노출 (관리자 등 제3자 캘린더에는 미노출)
        if (!myId) return false;
        return c.professorId === myId || c.studentId === myId;
      })
      .map((c) => ({
        id: `consult-cal-${c.id}`,
        userId: currentUser?.id,
        title: isProf
          ? `[대면 상담] ${c.studentName} 학생 (${c.consultationType})`
          : `[대면 상담] ${c.professorName} 교수님 (${c.consultationType})`,
        date: c.preferredDate,
        time: c.preferredTime || "",
        isAllDay: !c.preferredTime,
        category: "personal" as EventCategory,
        location: "교수 연구실 (대면 상담)",
        memo: `상담 목적: ${c.purpose}`,
      }))
      .filter((ev) => !existingIds.has(ev.id));

    return [...filteredUserEvents, ...consultEvents].filter(
      (ev) => !ev.title?.includes("백상아") && !ev.memo?.includes("백상아")
    );
  }, [userEvents, consultations, currentUser?.id, currentUser?.role, currentRole]);

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
      const updatedEvent: CalendarEvent = {
        id: editingEventId,
        userId: currentUser?.id,
        title: formTitle.trim(),
        date: formDate,
        endDate: formEndDate || undefined,
        time: formIsAllDay ? undefined : formTime,
        isAllDay: formIsAllDay,
        category: formCategory,
        location: formLocation.trim() || undefined,
        memo: formMemo.trim() || undefined,
      };
      const updated = userEvents.map((ev) =>
        ev.id === editingEventId ? updatedEvent : ev
      );
      saveEvents(updated);

      if (currentUser?.id) {
        saveUserCalendarEventToFirestore(currentUser.id, updatedEvent).catch((err) =>
          console.warn("Firestore 일정 업데이트 실패:", err)
        );
      }
    } else {
      // 신규 추가
      const newEvent: CalendarEvent = {
        id: `event-${Date.now()}`,
        userId: currentUser?.id,
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

      if (currentUser?.id) {
        saveUserCalendarEventToFirestore(currentUser.id, newEvent).catch((err) =>
          console.warn("Firestore 신규 일정 등록 실패:", err)
        );
      }
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

    if (currentUser?.id) {
      deleteUserCalendarEventFromFirestore(currentUser.id, id).catch((err) =>
        console.warn("Firestore 일정 삭제 실패:", err)
      );
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
    <section className={`bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs transition-colors ${className}`}>
      {/* 캘린더 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {calendarTitle}
              </h2>
            </div>
          </div>
        </div>


      </div>

      {/* 월 이동 컨트롤러 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-black text-slate-900">
            {currentYear}년 {currentMonth}월
          </span>
          <button
            type="button"
            onClick={goToToday}
            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevMonth}
            aria-label="이전 달"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="다음 달"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 달력 그리드 */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center py-2 border-b border-slate-200 text-xs font-bold text-slate-500 bg-white">
          <span className="text-rose-500">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-blue-500">토</span>
        </div>

        {/* 날짜 셀 그리드 */}
        <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200">
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
                    ? "bg-white hover:bg-orange-50/40"
                    : "bg-slate-50/80 text-slate-400"
                } ${
                  isSelected
                    ? "ring-2 ring-orange-500 z-10 bg-orange-50/30"
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
                        : "text-slate-700"
                    }`}
                  >
                    {cell.day}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-extrabold text-orange-600 sm:hidden">
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
      <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-600"></span>
            <h3 className="text-sm font-extrabold text-slate-900">
              {selectedDate} 일정 ({selectedDateEvents.length}개)
            </h3>
            {selectedDate === todayStr && (
              <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold">
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
          <div className="py-6 text-center text-xs text-slate-400">
            <p>등록된 일정이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDateEvents.map((ev) => {
              const cat = CATEGORY_MAP[ev.category] || CATEGORY_MAP.assignment;
              return (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-3 hover:border-orange-300 transition"
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

                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      {ev.title}
                    </p>

                    {ev.memo && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
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
                      className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteEvent(ev.id, e)}
                      title="일정 삭제"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                  {editingEventId ? (
                    <Pencil className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingEventId ? "일정 수정하기" : "새 일정 등록하기"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 입력 폼 */}
            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              {/* 분류 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  일정 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 교육공학 팀플 모임, 중간고사 등"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* 날짜 및 시간 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    날짜 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
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
                    className={`w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      formIsAllDay ? "opacity-50 cursor-not-allowed bg-slate-100" : ""
                    }`}
                  />
                </div>
              </div>

              {/* 장소 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  장소 (선택)
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="예: 학술문화관 302호, 혜화관 카페"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  메모 (선택)
                </label>
                <textarea
                  rows={2}
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  placeholder="준비물이나 참고할 내용을 자유롭게 적어보세요."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* 버튼 액션 */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEventId)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
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
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-raise transition cursor-pointer"
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
