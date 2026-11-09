"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { ConsultationRequest, ConsultationType } from "@/types";
import { calculateGraduationAudit } from "@/lib/graduationCurriculum";
import { ROLE_LABELS } from "@/components/common/Cards";
import { formatChatMemberHakbun } from "@/lib/chatReadReceipts";
import { saveUserCalendarEventToFirestore } from "@/lib/firebase";
import EditableCalendar, { CalendarEvent } from "@/components/calendar/EditableCalendar";
import {
  Avatar,
  Badge,
  CountBadge,
  Panel,
  SectionHeader,
  textLinkClass,
} from "@/components/ui";
import {
  MessageSquare,
  Users,
  CheckSquare,
  ArrowRight,
  Sparkles,
  GraduationCap,
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  Check,
  X,
  Plus,
} from "lucide-react";

const CONSULTATION_TYPES: ConsultationType[] = [
  "학업 상담",
  "진로 상담",
  "복수전공 상담",
  "대학원 진학 상담",
  "기타",
];

export default function HomePage() {
  const router = useRouter();
  const {
    currentUser,
    currentRole,
    authUserProfile,
    users,
    approvedMembers,
    approvedProfessors,
    realUsersForAdmin,
    consultations,
    handleCreateConsultation,
    handleUpdateConsultationStatus,
    handleCancelConsultation,
    handleConnectConsultationChat,
    sendMessage,
    startOrOpenDirectChat,
    conversations,
    alumniProfiles,
    studentProgress,
    graduationCatalog,
    myAdvisorInfo,
  } = useApp();

  const [isUpdatingConsultation, setIsUpdatingConsultation] = useState(false);
  const [consultNoticeBanner, setConsultNoticeBanner] = useState<string | null>(null);

  // 학생용 홈 인라인 상담 요청 폼 상태
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [selectedProfId, setSelectedProfId] = useState("");
  const [reqType, setReqType] = useState<ConsultationType>("진로 상담");
  const [reqDate, setReqDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reqTime, setReqTime] = useState("14:00");
  const [reqPurpose, setReqPurpose] = useState("");
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // 읽지 않은 채팅 목록
  const unreadConversations = conversations.filter((conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return (member?.unreadCount || 0) > 0;
  });

  // 추천 졸업생 (프로필 공개에 동의한 졸업생 중 상위 3명)
  const recommendedAlumni = alumniProfiles
    .filter((a) => a.privacy?.showProfileInDirectory !== false)
    .slice(0, 3);

  // 재학생 모드 판별 (관리자, 교수진, 졸업생은 false)
  const isStudent =
    (currentUser.role === "student" || currentRole === "student") &&
    currentUser.role !== "admin" &&
    currentRole !== "admin" &&
    currentUser.role !== "professor" &&
    currentRole !== "professor" &&
    currentUser.role !== "alumni" &&
    currentRole !== "alumni";

  // 교수 모드 판별
  const isProfessor =
    currentUser.role === "professor" || currentRole === "professor";

  // 대기 중인 상담 요청 목록 (최신순)
  const pendingConsultations = React.useMemo(
    () => (consultations || []).filter((c) => c.status === "pending"),
    [consultations]
  );

  // 수락된 예정 상담 일정 목록 (날짜·시간순)
  const acceptedConsultations = React.useMemo(
    () =>
      (consultations || [])
        .filter((c) => c.status === "accepted")
        .sort((a, b) => {
          const dCmp = (a.preferredDate || "").localeCompare(b.preferredDate || "");
          if (dCmp !== 0) return dCmp;
          return (a.preferredTime || "").localeCompare(b.preferredTime || "");
        }),
    [consultations]
  );

  // 대면 상담 수락 시 캘린더 일정(로컬 스토리지 + Firestore) 자동 생성 및 해당 날짜 선택
  const registerFaceToFaceCalendarEvent = async (c: ConsultationRequest) => {
    const profId = authUserProfile?.uid || authUserProfile?.id || currentUser.id || c.professorId;
    const eventId = `consult-cal-${c.id}`;
    const profEvent: CalendarEvent = {
      id: eventId,
      userId: profId,
      title: `[대면 상담] ${c.studentName} 학생 (${c.consultationType})`,
      date: c.preferredDate,
      time: c.preferredTime || "",
      isAllDay: !c.preferredTime,
      category: "personal",
      location: "교수 연구실 (대면 상담)",
      memo: `상담 목적: ${c.purpose}`,
    };

    try {
      const keys = [
        "dongguk_custom_calendar_events_v1",
        profId ? `dongguk_custom_calendar_events_v2_${profId}` : "",
      ].filter(Boolean);

      keys.forEach((key) => {
        const raw = window.localStorage.getItem(key);
        const list: CalendarEvent[] = raw ? JSON.parse(raw) : [];
        const next = [profEvent, ...list.filter((item) => item.id !== eventId)];
        window.localStorage.setItem(key, JSON.stringify(next));
      });
    } catch {
      // ignore localStorage errors
    }

    try {
      if (profId) {
        await saveUserCalendarEventToFirestore(profId, profEvent);
      }
      if (c.studentId) {
        const studentEvent: CalendarEvent = {
          ...profEvent,
          userId: c.studentId,
          title: `[대면 상담] ${c.professorName} 교수님 (${c.consultationType})`,
        };
        await saveUserCalendarEventToFirestore(c.studentId, studentEvent).catch(() => {});
      }
    } catch {
      // ignore firestore sync warning
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("dongguk-calendar-select-date", {
          detail: { date: c.preferredDate },
        })
      );
    }
  };

  // 교수용: 상담 수락 처리 (비대면 -> 대화창 즉시 연결 / 대면 -> 상담 일정 및 캘린더 일정 생성)
  const handleProfessorAcceptConsultation = async (
    c: ConsultationRequest,
    method: "대면" | "채팅"
  ) => {
    try {
      setIsUpdatingConsultation(true);

      if (method === "채팅") {
        // 비대면(채팅) 상담 수락: 1:1 대화방 생성/연결 후 대화창으로 즉시 이동
        const convId = await handleConnectConsultationChat(c, "채팅");
        await handleUpdateConsultationStatus(c.id, "accepted", undefined, convId, "채팅");
        try {
          await sendMessage(
            convId,
            `[비대면 상담 수락 안내]\n안녕하세요 ${c.studentName} 학생, 신청하신 '${c.consultationType}' 비대면 상담이 수락되었습니다.\n• 희망 일시: ${c.preferredDate} · ${c.preferredTime}\n• 상담 내용: ${c.purpose}\n\n이 대화창에서 편하게 상담을 진행해 주세요.`
          );
        } catch {
          // ignore initial message warning
        }
        router.push(`/chat?convId=${encodeURIComponent(convId)}`);
        return;
      }

      // 대면 상담 수락: 상태를 accepted("대면")로 변경하고 해당 날짜에 상담 일정 생성
      await handleUpdateConsultationStatus(c.id, "accepted", undefined, undefined, "대면");
      await registerFaceToFaceCalendarEvent(c);
      setConsultNoticeBanner(
        `${c.studentName} 학생의 대면 상담을 수락했습니다. [${c.preferredDate} · ${c.preferredTime}] 상담 일정이 등록되었습니다!`
      );
    } catch (err: any) {
      alert(`상담 수락 처리 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsUpdatingConsultation(false);
    }
  };

  // 교수용: 상담 거절 처리
  const handleProfessorRejectConsultation = async (c: ConsultationRequest) => {
    const reason = window.prompt(
      "상담 거절(미승인) 사유를 입력해 주세요 (선택 사항):",
      "해당 일시에는 학과 일정으로 상담이 어렵습니다."
    );
    if (reason === null) return;
    try {
      setIsUpdatingConsultation(true);
      await handleUpdateConsultationStatus(
        c.id,
        "rejected",
        reason || "일정상 상담이 어렵습니다."
      );
      setConsultNoticeBanner(`${c.studentName} 학생의 상담 요청이 거절 처리되었습니다.`);
    } catch (err: any) {
      alert(`상담 거절 처리 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsUpdatingConsultation(false);
    }
  };

  // 교수용: 상담 완료 처리
  const handleCompleteConsultation = async (c: ConsultationRequest) => {
    try {
      setIsUpdatingConsultation(true);
      await handleUpdateConsultationStatus(
        c.id,
        "completed",
        c.rescheduleNote,
        c.conversationId,
        c.consultationMethod
      );
      setConsultNoticeBanner(`${c.studentName} 학생과의 상담 일정이 완료 처리되었습니다.`);
    } catch (err: any) {
      alert(`상담 완료 처리 오류: ${err?.message || err}`);
    } finally {
      setIsUpdatingConsultation(false);
    }
  };

  // 상담 일정에서 대화창으로 바로 연결
  const handleOpenConsultationChatRoom = async (c: ConsultationRequest) => {
    try {
      if (c.conversationId) {
        router.push(`/chat?convId=${encodeURIComponent(c.conversationId)}`);
        return;
      }
      const convId = await handleConnectConsultationChat(c, c.consultationMethod || "채팅");
      router.push(`/chat?convId=${encodeURIComponent(convId)}`);
    } catch {
      router.push("/chat");
    }
  };

  // 학생용: 홈 화면에서 바로 상담 요청 제출
  const handleStudentSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProfId = selectedProfId || myAdvisorInfo.professor?.id || approvedProfessors[0]?.id;
    const targetProf =
      approvedProfessors.find((p) => p.id === targetProfId) || myAdvisorInfo.professor;
    if (!targetProf) {
      alert("상담을 신청할 교수님을 선택해 주세요.");
      return;
    }
    if (!reqDate.trim() || !reqTime.trim() || !reqPurpose.trim()) {
      alert("희망 날짜, 시간, 상담 내용을 모두 입력해 주세요.");
      return;
    }
    try {
      setIsSubmittingReq(true);
      await handleCreateConsultation({
        professorId: targetProf.id,
        professorName: targetProf.name,
        consultationType: reqType,
        preferredDate: reqDate.trim(),
        preferredTime: reqTime.trim(),
        purpose: reqPurpose.trim(),
      });
      setReqPurpose("");
      setIsRequestFormOpen(false);
      setConsultNoticeBanner(
        `${targetProf.name} 교수님께 상담 요청이 접수되었습니다. 교수님이 수락하시면 상담 일정 또는 대화창으로 연결됩니다.`
      );
    } catch (err: any) {
      alert(`상담 신청 오류: ${err?.message || err}`);
    } finally {
      setIsSubmittingReq(false);
    }
  };

  // 교수 계정용: 나의 지도학생 목록 동적 추출
  const myAdviseeStudents = React.useMemo(() => {
    if (!isProfessor) return [];
    const profIds = new Set(
      [
        currentUser?.id,
        (currentUser as any)?.uid,
        authUserProfile?.id,
        authUserProfile?.uid,
      ].filter(Boolean)
    );

    const map = new Map<string, any>();

    // 1) 승인된 회원 목록 (Firestore publicProfiles & users)
    if (Array.isArray(approvedMembers)) {
      approvedMembers.forEach((m: any) => {
        const mRole = m.role || "student";
        const advId = m.advisorProfessorId;
        if (mRole === "student" && advId && profIds.has(advId)) {
          const key = m.id || m.uid;
          if (key) map.set(key, m);
        }
      });
    }

    // 2) 관리자/실제 사용자 목록
    if (Array.isArray(realUsersForAdmin)) {
      realUsersForAdmin.forEach((u: any) => {
        const uRole = u.role || "student";
        const advId = u.advisorProfessorId;
        if (uRole === "student" && advId && profIds.has(advId)) {
          const key = u.id || u.uid;
          if (key) map.set(key, u);
        }
      });
    }

    // 3) 목데이터 및 로컬 users 상태
    if (Array.isArray(users)) {
      users.forEach((u: any) => {
        const uRole = u.role || "student";
        const advId = u.advisorProfessorId;
        if (uRole === "student" && advId && profIds.has(advId)) {
          const key = u.id || u.uid;
          if (key) map.set(key, u);
        }
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "ko-KR")
    );
  }, [isProfessor, currentUser, authUserProfile, approvedMembers, realUsersForAdmin, users]);

  const handleStartChatWithStudent = async (studentId: string) => {
    try {
      const convId = await startOrOpenDirectChat(studentId, "지도학생 상담");
      router.push(`/chat?convId=${encodeURIComponent(convId)}`);
    } catch {
      router.push("/chat");
    }
  };

  // 상담 요청 위젯 (기존 진로·복수전공 게시판 위치 대체)
  const renderConsultationRequestsSection = () => (
    <Panel as="section">
      <SectionHeader
        title={
          isProfessor
            ? `학생 상담 요청 (${pendingConsultations.length}건)`
            : `교수님 상담 요청 (${pendingConsultations.length}건)`
        }
        icon={<GraduationCap className="w-5 h-5 text-accent" />}
        action={
          isStudent ? (
            <button
              type="button"
              onClick={() => {
                if (!selectedProfId) {
                  setSelectedProfId(
                    myAdvisorInfo.professor?.id || approvedProfessors[0]?.id || ""
                  );
                }
                setIsRequestFormOpen((prev) => !prev);
              }}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs inline-flex items-center gap-1 transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isRequestFormOpen ? "닫기" : "상담 요청하기"}
            </button>
          ) : (
            <Link href="/chat" className={textLinkClass}>
              대화창 이동 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )
        }
      />

      {consultNoticeBanner && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2">
          <span className="font-semibold">{consultNoticeBanner}</span>
          <button
            type="button"
            onClick={() => setConsultNoticeBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 학생 전용: 인라인 상담 요청 작성 폼 */}
      {isStudent && isRequestFormOpen && (
        <form
          onSubmit={handleStudentSubmitConsultation}
          className="mt-3 p-4 rounded-2xl bg-surface-2 border border-line space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-ink mb-1">담당 교수님 선택</label>
              <select
                value={selectedProfId || myAdvisorInfo.professor?.id || ""}
                onChange={(e) => setSelectedProfId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink"
              >
                {approvedProfessors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} 교수님 {myAdvisorInfo.professor?.id === p.id ? "(지도교수)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-ink mb-1">상담 분야</label>
              <select
                value={reqType}
                onChange={(e) => setReqType(e.target.value as ConsultationType)}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink"
              >
                {CONSULTATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-ink mb-1">희망 날짜</label>
              <input
                type="date"
                required
                value={reqDate}
                onChange={(e) => setReqDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block font-bold text-ink mb-1">희망 시간</label>
              <input
                type="text"
                required
                value={reqTime}
                onChange={(e) => setReqTime(e.target.value)}
                placeholder="예: 14:00 또는 오후 2시"
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-ink mb-1">상담 요청 내용</label>
            <textarea
              rows={2}
              required
              value={reqPurpose}
              onChange={(e) => setReqPurpose(e.target.value)}
              placeholder="상담받고 싶은 주제나 질문을 간략히 적어주세요."
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsRequestFormOpen(false)}
              className="px-3 py-1.5 rounded-xl border border-line text-ink-2 font-semibold"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmittingReq}
              className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingReq ? "전송 중..." : "상담 요청 등록"}
            </button>
          </div>
        </form>
      )}

      {pendingConsultations.length === 0 ? (
        <div className="p-5 rounded-2xl bg-surface-2 text-center text-xs text-ink-3 mt-3">
          {isProfessor
            ? "현재 대기 중인 학생 상담 요청이 없습니다."
            : "현재 승인 대기 중인 상담 요청이 없습니다."}
        </div>
      ) : (
        <div className="space-y-3 mt-3">
          {pendingConsultations.map((c) => {
            const hakbunBadge =
              formatChatMemberHakbun({ studentIdOrYear: c.studentIdOrYear }) ||
              c.studentIdOrYear ||
              "재학생";
            return (
              <div
                key={c.id}
                className="p-4 rounded-2xl border border-orange-200 bg-orange-50/40 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-sm text-ink">
                      {isProfessor ? `${c.studentName} 학생` : `${c.professorName} 교수님`}
                    </span>
                    {isProfessor && (
                      <Badge tone="neutral">{hakbunBadge}</Badge>
                    )}
                    <Badge tone="brand">{c.consultationType}</Badge>
                  </div>
                  <span className="inline-flex items-center gap-1 text-ink-2 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    {c.preferredDate} · {c.preferredTime}
                  </span>
                </div>

                <p className="p-2.5 rounded-xl bg-white border border-orange-100 text-ink-2 leading-relaxed">
                  {c.purpose}
                </p>

                {isProfessor ? (
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={isUpdatingConsultation}
                      onClick={() => handleProfessorRejectConsultation(c)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingConsultation}
                      onClick={() => handleProfessorAcceptConsultation(c, "채팅")}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      비대면 상담 수락
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingConsultation}
                      onClick={() => handleProfessorAcceptConsultation(c, "대면")}
                      className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      대면 상담 수락
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold text-amber-700">
                      ● 교수님 수락 대기 중
                    </span>
                    {c.studentId === currentUser.id && (
                      <button
                        type="button"
                        onClick={() => handleCancelConsultation(c.id)}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        요청 취소
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );

  // 예정된 상담 일정 위젯
  const renderConsultationScheduleSection = () => (
    <Panel as="section">
      <SectionHeader
        title={`상담 일정 (${acceptedConsultations.length}건)`}
        icon={<CalendarIcon className="w-5 h-5 text-accent" />}
        action={
          <Link href="/chat" className={textLinkClass}>
            전체 상담 보기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      />

      {acceptedConsultations.length === 0 ? (
        <div className="p-5 rounded-2xl bg-surface-2 text-center text-xs text-ink-3 mt-3">
          현재 예정된 상담 일정이 없습니다.
        </div>
      ) : (
        <div className="space-y-2.5 mt-3">
          {acceptedConsultations.map((c) => {
            const isChatMethod = c.consultationMethod === "채팅";
            return (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl border border-line bg-surface-2 hover:bg-surface-3 transition space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge tone={isChatMethod ? "info" : "success"}>
                      {isChatMethod ? "💬 비대면 상담" : "🏫 대면 상담"}
                    </Badge>
                    <Badge tone="brand">{c.consultationType}</Badge>
                    <span className="font-bold text-ink text-sm">
                      {isProfessor ? `${c.studentName} 학생` : `${c.professorName} 교수님`}
                    </span>
                  </div>
                  <span className="font-bold text-accent tabular">
                    {c.preferredDate} · {c.preferredTime}
                  </span>
                </div>

                <p className="text-ink-2 line-clamp-2">{c.purpose}</p>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("dongguk-calendar-select-date", {
                            detail: { date: c.preferredDate },
                          })
                        );
                      }
                    }}
                    className="text-[11px] font-semibold text-ink-3 hover:text-accent inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    캘린더에서 날짜 보기
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenConsultationChatRoom(c)}
                      className="px-3 py-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      대화창 연결
                    </button>
                    {isProfessor && (
                      <button
                        type="button"
                        disabled={isUpdatingConsultation}
                        onClick={() => handleCompleteConsultation(c)}
                        className="px-2.5 py-1 rounded-xl border border-line bg-white hover:bg-slate-50 text-ink-2 font-semibold text-xs transition cursor-pointer"
                      >
                        완료
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );

  // 교수 전용: 나의 지도학생 위젯
  const renderMyAdviseeStudentsSection = () => (
    <Panel as="section">
      <SectionHeader
        title={`나의 지도학생 (${myAdviseeStudents.length}명)`}
        icon={<GraduationCap className="w-5 h-5 text-accent" />}
        action={
          <Link href="/chat" className={textLinkClass}>
            지도학생 상담 및 대화 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      />

      {myAdviseeStudents.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-line text-center space-y-1 bg-surface-2 mt-3">
          <p className="text-sm font-bold text-ink">배정된 지도학생이 없습니다.</p>
          <p className="text-xs text-ink-3">
            학과사무실 또는 관리자 센터에서 지도학생이 배정되면 이곳에 실시간으로 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3">
          {myAdviseeStudents.map((student) => {
            const pendingConsults = (consultations || []).filter(
              (c) =>
                (c.studentId === student.id || c.studentEmail === student.email) &&
                c.status === "pending"
            );

            return (
              <div
                key={student.id}
                className="p-4 rounded-2xl border border-line bg-surface-2 hover:bg-surface-3 transition flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={student.name} role="student" size="md" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="font-bold text-sm text-ink truncate">
                        {student.name}
                      </span>
                      <Badge tone="brand">
                        {formatChatMemberHakbun(student) || student.studentIdOrYear || "재학생"}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-ink-2 truncate">
                      {student.careerTrack ? student.careerTrack : "진로 탐색 중"}
                      {student.doubleMajor ? ` · 복수전공: ${student.doubleMajor}` : " · 단일전공"}
                    </p>
                    {pendingConsults.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                        상담 요청 대기 {pendingConsults.length}건
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-line text-xs">
                  <span className="text-[11px] text-ink-3 truncate max-w-[130px]">
                    {student.email || "동국대학교 교육학과"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStartChatWithStudent(student.id)}
                    className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs inline-flex items-center gap-1 transition shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    1:1 대화
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );

  return (
    <div className="space-y-6">
      {/* 환영 배너 (사람과 사람을 잇는 '이음' 일러스트 포함) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-amber-500 text-white p-6 sm:p-8 shadow-sm">
        <ConnectionMotif />

        <div className="relative z-10 max-w-2xl space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-white shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            동국대학교 교육학과 전용 종합 플랫폼 · 동국e음
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            반갑습니다, {currentUser.name}님!
            {currentRole === "admin" ? ` (${ROLE_LABELS.admin} 모드)` : ""}
          </h1>
          <p className="text-xs sm:text-sm text-brand-50 leading-relaxed font-medium">
            교육(e)으로 사람과 사람을 잇는 <strong>동국e음</strong>입니다. 학과 공지부터
            졸업요건 자가점검, 진로·복수전공 게시판, 동문 멘토링까지 한곳에서 안전하게 연결하세요.
          </p>
        </div>
      </section>

      {/* 교수 전용: 나의 지도학생 (환영 배너 바로 아래에 배치) */}
      {isProfessor && renderMyAdviseeStudentsSection()}

      {/* 중단 2단 그리드: 직접 일정 수정 캘린더 & 상담 요청/상담 일정/대화/졸업요건 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 직접 일정 수정 가능한 캘린더 */}
        <EditableCalendar className="lg:col-span-7" />

        {/* 우측 패널 */}
        <div className="lg:col-span-5 space-y-6">
          {/* 학생 전용: 나의 지도교수 영역 */}
          {isStudent && (
            <Panel as="section">
              <SectionHeader
                title="나의 지도교수"
                icon={<GraduationCap className="w-5 h-5 text-accent" />}
                action={
                  <span className="text-xs text-ink-3 font-medium">
                    학생 지도 시스템
                  </span>
                }
              />

              {myAdvisorInfo.status === "assigned" && myAdvisorInfo.professor ? (
                <div className="p-4 rounded-2xl border border-line bg-surface-2 flex flex-col gap-3 mt-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={myAdvisorInfo.professor.name}
                      role="professor"
                      size="lg"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-ink">
                          {myAdvisorInfo.professor.name}
                        </span>
                        <span className="text-xs font-semibold text-accent">
                          {myAdvisorInfo.professor.studentIdOrYear || "교육학과 전임교원"}
                        </span>
                      </div>
                      <p className="text-xs text-ink-2">
                        동국대학교 사범대학 교육학과
                      </p>
                      {myAdvisorInfo.professor.specialty && (
                        <p className="text-xs text-ink-3 truncate">
                          전문 분야: {myAdvisorInfo.professor.specialty}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-line text-xs">
                    <Badge
                      tone={myAdvisorInfo.professor.consultationAvailable !== false ? "success" : "neutral"}
                    >
                      {myAdvisorInfo.professor.consultationAvailable !== false
                        ? "● 상담 가능"
                        : "현재 상담 불가"}
                    </Badge>
                    <Link
                      href={`/chat?consultProfessorId=${myAdvisorInfo.professor.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1"
                    >
                      상담 신청
                    </Link>
                  </div>
                </div>
              ) : myAdvisorInfo.status === "invalid_status" ? (
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-center gap-2 mt-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold">지정된 지도교수 계정 상태를 확인할 수 없습니다.</p>
                    <p className="text-amber-700 mt-0.5">
                      학과사무실 또는 관리자에게 지도교수 지정을 문의해 주세요.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-line text-center space-y-1 bg-surface-2 mt-3">
                  <p className="text-sm font-bold text-ink">지도교수 미배정</p>
                  <p className="text-xs text-ink-3">
                    배정된 지도교수님이 없습니다. 학과사무실에 지정을 요청해 주세요.
                  </p>
                </div>
              )}
            </Panel>
          )}

          {/* 읽지 않은 대화 */}
          <Panel as="section">
            <SectionHeader
              title="읽지 않은 대화"
              icon={<MessageSquare className="w-5 h-5 text-accent" />}
              action={
                <Link href="/chat" className={textLinkClass}>
                  대화창 이동 <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />

            {unreadConversations.length === 0 ? (
              <div className="p-5 rounded-2xl bg-surface-2 text-center text-xs text-ink-3 mt-3">
                현재 읽지 않은 새 메시지가 없습니다.
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {unreadConversations.map((conv) => {
                  const myMember = conv.members.find(
                    (m) => m.userId === currentUser.id
                  );
                  return (
                    <Link
                      key={conv.id}
                      href={`/chat?convId=${encodeURIComponent(conv.id)}`}
                      className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-2 hover:bg-surface-3 transition border border-transparent hover:border-line"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-ink truncate group-hover:text-accent transition-colors">
                            {conv.title}
                          </p>
                          <CountBadge count={myMember?.unreadCount || 0} />
                        </div>
                        <p className="text-xs text-ink-2 truncate mt-1">
                          {conv.lastMessageText}
                        </p>
                      </div>
                      <span className="text-xs text-ink-3 shrink-0 tabular">
                        {conv.lastMessageAt}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* 재학생 전용: 나의 졸업요건 자가점검 요약 */}
          {isStudent && (
            <Panel as="section">
              <SectionHeader
                title="졸업요건 자가점검 요약"
                icon={<CheckSquare className="w-5 h-5 text-accent" />}
                action={
                  <Link href="/graduation" className={textLinkClass}>
                    상세 기록하기 <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                }
              />

              <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-2.5 text-xs mt-3">
                {(() => {
                  const homeAudit = calculateGraduationAudit(studentProgress, graduationCatalog);
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-3">적용 기준</span>
                        <span className="font-bold text-ink">
                          {homeAudit.profile.admissionYearLabel} · {studentProgress.majorType}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-3">총 이수 학점</span>
                        <span className="font-bold text-accent tabular">
                          {homeAudit.totalEarnedCredits}학점 / {homeAudit.applicable.cohortRule.totalGraduationCredits}학점
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-3">교육봉사 시간</span>
                        <span className="font-bold text-accent tabular">
                          {homeAudit.volunteeringAudit.effectiveHours}시간 / {homeAudit.volunteeringAudit.targetHours}시간
                        </span>
                      </div>
                    </>
                  );
                })()}
                <p className="text-[11px] text-ink-3 pt-2 border-t border-line">
                  ※ 공식 학사 시스템 연동이 아닌 개인 자가점검 메모입니다.
                </p>
              </div>
            </Panel>
          )}

          {/* 비재학생(교수진·관리자·졸업생) 모드: 기존 게시판/후기 자리에 상담 요청 및 상담 일정 배치 */}
          {!isStudent && (
            <>
              {renderConsultationRequestsSection()}
              {renderConsultationScheduleSection()}
            </>
          )}
        </div>
      </div>

      {/* 재학생 모드: 하단 2열에 상담 요청 및 상담 일정 배치 */}
      {isStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderConsultationRequestsSection()}
          {renderConsultationScheduleSection()}
        </div>
      )}

      {/* 추천 졸업생 동문 프로필 (교수가 아닐 때만 하단에 표시) */}
      {!isProfessor && (
        <Panel as="section">
          <SectionHeader
            title="추천 졸업생 동문 프로필"
            icon={<Users className="w-5 h-5 text-accent" />}
            action={
              <Link href="/alumni" className={textLinkClass}>
                졸업생 전체 탐색 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {recommendedAlumni.map((alumni) => (
              <Link
                key={alumni.id}
                href={`/alumni?alumniId=${encodeURIComponent(alumni.id)}`}
                className="group p-4 rounded-2xl border border-line bg-surface-2 hover:bg-surface-3 transition flex items-start gap-3.5"
              >
                <Avatar name={alumni.displayName} role="alumni" size="md" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                      {alumni.displayName}
                    </span>
                    <Badge tone="brand">{alumni.careerTrack}</Badge>
                  </div>
                  <p className="text-xs font-semibold text-ink-2 truncate">
                    {alumni.currentRoleTitle}
                  </p>
                  <p className="text-xs text-ink-3 truncate">
                    {alumni.doubleMajor} · {alumni.graduationYear}년 졸업
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/**
 * 환영 배너 오른쪽의 '이음' 그림: 사람(점)과 사람을 잇는 선 SVG 애니메이션.
 */
function ConnectionMotif() {
  const links = [
    "M48 178 L142 96",
    "M142 96 L246 150",
    "M246 150 L330 58",
    "M246 150 L372 196",
    "M142 96 L330 58",
    "M48 178 L196 224",
    "M196 224 L246 150",
  ];
  const nodes: [number, number, number][] = [
    [48, 178, 5],
    [142, 96, 7],
    [246, 150, 9],
    [330, 58, 6],
    [372, 196, 5],
    [196, 224, 4],
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 260"
      fill="none"
      className="pointer-events-none absolute top-1/2 -right-8 hidden h-[135%] -translate-y-1/2 text-white sm:block"
    >
      {links.map((d, i) => (
        <path
          key={d}
          d={d}
          pathLength={1}
          stroke="currentColor"
          strokeOpacity={i === 4 ? 0.14 : 0.26}
          strokeWidth={1.5}
          strokeDasharray={i === 4 ? "0.02 0.02" : "1"}
          className={i === 4 ? undefined : "animate-draw [stroke-dashoffset:1]"}
          style={i === 4 ? undefined : { animationDelay: `${i * 90}ms` }}
        />
      ))}
      {nodes.map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r + 7} stroke="currentColor" strokeOpacity={i === 2 ? 0.35 : 0.16} />
          <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity={i === 2 ? 0.95 : 0.4} />
        </g>
      ))}
    </svg>
  );
}
