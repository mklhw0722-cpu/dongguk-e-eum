"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { canAccessGraduation } from "@/lib/accessGate";
import { calculateGraduationAudit } from "@/lib/graduationCurriculum";
import { ROLE_LABELS } from "@/components/common/Cards";
import { formatUnreadBadge } from "@/lib/chatReadReceipts";
import EditableCalendar from "@/components/calendar/EditableCalendar";
import { ConsultationStatus, ConsultationType, ConsultationRequest } from "@/types";
import {
  Megaphone,
  MessageSquare,
  Compass,
  Users,
  CheckSquare,
  ArrowRight,
  Pin,
  BookOpen,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Calendar,
  AlertCircle,
  Clock,
  X,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Inbox,
  MessageCircle,
  Check,
  Send,
} from "lucide-react";

const CONSULTATION_STATUS_BADGES: Record<
  ConsultationStatus,
  { label: string; style: string }
> = {
  pending: {
    label: "신청 대기",
    style: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  },
  accepted: {
    label: "상담 수락됨",
    style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  },
  reschedule_requested: {
    label: "일정 조정 요청",
    style: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  },
  rejected: {
    label: "상담 거절됨",
    style: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
  },
  completed: {
    label: "상담 완료",
    style: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  },
  cancelled: {
    label: "신청 취소됨",
    style: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
  },
};

export default function HomePage() {
  const router = useRouter();
  const {
    currentUser,
    currentRole,
    notices,
    conversations,
    communityRooms,
    communityPosts,
    alumniProfiles,
    studentProgress,
    graduationCatalog,
    mentoringRequests,
    approvalRequests,
    approvedProfessors,
    myAdvisorInfo,
    consultations,
    handleCreateConsultation,
    handleUpdateConsultationStatus,
    handleCancelConsultation,
    handleConnectConsultationChat,
  } = useApp();

  // 교수 상담 신청 모달 상태
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [selectedProfessorForConsultation, setSelectedProfessorForConsultation] = useState<any>(null);
  const [consultationType, setConsultationType] = useState<ConsultationType>("학업 상담");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [consultationPurpose, setConsultationPurpose] = useState("");
  const [isSubmittingConsultation, setIsSubmittingConsultation] = useState(false);
  const [consultationActionFeedback, setConsultationActionFeedback] = useState<string | null>(null);

  // 교수용: 일정 조정 모달 상태
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [targetConsultationForReschedule, setTargetConsultationForReschedule] = useState<ConsultationRequest | null>(null);
  const [rescheduleNoteInput, setRescheduleNoteInput] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 교수용: 신청 목록 필터
  const [professorConsultationFilter, setProfessorConsultationFilter] = useState<
    "all" | "pending" | "accepted" | "reschedule_requested" | "closed"
  >("all");

  // 읽지 않은 채팅 목록
  const unreadConversations = conversations.filter((conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return (member?.unreadCount || 0) > 0;
  });

  // 내가 참여한 공유방
  const myJoinedRooms = communityRooms.filter((r) =>
    r.memberIds.includes(currentUser.id)
  );

  // 최근 복수전공 후기
  const doubleMajorReviews = communityPosts
    .filter((p) => p.category === "복수전공 후기")
    .slice(0, 3);

  // 추천 졸업생 (상위 3명)
  const recommendedAlumni = alumniProfiles.slice(0, 3);

  // 학생용 상담 목록
  const myStudentConsultations = consultations.filter(
    (c) => c.studentId === currentUser.id || c.studentEmail === currentUser.email
  );

  // 교수용 상담 목록
  const myProfessorConsultations = consultations.filter(
    (c) => c.professorId === currentUser.id
  );

  // 교수용 필터 적용 목록
  const filteredProfessorConsultations = myProfessorConsultations.filter((c) => {
    if (professorConsultationFilter === "all") return true;
    if (professorConsultationFilter === "pending") return c.status === "pending";
    if (professorConsultationFilter === "accepted") return c.status === "accepted";
    if (professorConsultationFilter === "reschedule_requested") return c.status === "reschedule_requested";
    if (professorConsultationFilter === "closed")
      return c.status === "completed" || c.status === "rejected" || c.status === "cancelled";
    return true;
  });

  // 상담 신청 제출 핸들러 (학생용)
  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfessorForConsultation) return;

    if (!preferredDate.trim()) {
      alert("희망 날짜를 선택해 주세요.");
      return;
    }
    if (!preferredTime.trim()) {
      alert("희망 시간대를 입력해 주세요 (예: 14:00 또는 수요일 오후).");
      return;
    }
    if (!consultationPurpose.trim()) {
      alert("상담 목적이나 질문 내용을 작성해 주세요.");
      return;
    }

    try {
      setIsSubmittingConsultation(true);
      await handleCreateConsultation({
        professorId: selectedProfessorForConsultation.id,
        professorName: selectedProfessorForConsultation.name,
        consultationType,
        preferredDate: preferredDate.trim(),
        preferredTime: preferredTime.trim(),
        purpose: consultationPurpose.trim(),
      });

      setConsultationActionFeedback(
        `${selectedProfessorForConsultation.name} 교수님께 상담 신청서가 성공적으로 접수되었습니다!`
      );
      setTimeout(() => setConsultationActionFeedback(null), 4000);
      setConsultationModalOpen(false);
      setPreferredDate("");
      setPreferredTime("");
      setConsultationPurpose("");
    } catch (err: any) {
      alert(`상담 신청 접수 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsSubmittingConsultation(false);
    }
  };

  // 상담 신청 취소 핸들러 (학생용)
  const handleCancelStudentConsultation = async (consultationId: string) => {
    if (!confirm("해당 교수 상담 신청을 취소하시겠습니까?")) return;
    try {
      await handleCancelConsultation(consultationId);
      setConsultationActionFeedback("상담 신청이 취소되었습니다.");
      setTimeout(() => setConsultationActionFeedback(null), 3000);
    } catch (e: any) {
      alert(`신청 취소 실패: ${e?.message || e}`);
    }
  };

  // 승인된 상담 1:1 대화방 이동 핸들러 (학생/교수 공통)
  const handleGoToConsultationChat = async (c: ConsultationRequest) => {
    try {
      const chatId = await handleConnectConsultationChat(c);
      router.push(`/chat?id=${chatId}`);
    } catch (e: any) {
      alert(`대화방 연결 실패: ${e?.message || e}`);
    }
  };

  // 상담 수락 핸들러 (교수용)
  const handleProfessorAccept = async (c: ConsultationRequest) => {
    try {
      setIsUpdatingStatus(true);
      await handleUpdateConsultationStatus(c.id, "accepted");
      await handleConnectConsultationChat(c);
      setConsultationActionFeedback(
        `${c.studentName} 학생의 상담 신청을 수락했습니다. 1:1 대화방이 연결되었습니다.`
      );
      setTimeout(() => setConsultationActionFeedback(null), 4000);
    } catch (e: any) {
      alert(`상담 수락 처리 오류: ${e?.message || e}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 일정 조정 제안 제출 핸들러 (교수용)
  const handleProfessorSubmitReschedule = async () => {
    if (!targetConsultationForReschedule) return;
    if (!rescheduleNoteInput.trim()) {
      alert("학생에게 전달할 일정 조정 제안 메모나 시간을 입력해 주세요.");
      return;
    }
    try {
      setIsUpdatingStatus(true);
      await handleUpdateConsultationStatus(
        targetConsultationForReschedule.id,
        "reschedule_requested",
        rescheduleNoteInput.trim()
      );
      setConsultationActionFeedback(
        `${targetConsultationForReschedule.studentName} 학생에게 일정 조정 요청이 전달되었습니다.`
      );
      setTimeout(() => setConsultationActionFeedback(null), 4000);
      setRescheduleModalOpen(false);
      setTargetConsultationForReschedule(null);
      setRescheduleNoteInput("");
    } catch (e: any) {
      alert(`일정 조정 저장 실패: ${e?.message || e}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 상담 거절 핸들러 (교수용)
  const handleProfessorReject = async (c: ConsultationRequest) => {
    const reason = prompt("상담 거절 사유를 입력해 주세요 (선택 사항):", "일정상 상담이 어렵습니다.");
    if (reason === null) return;
    try {
      setIsUpdatingStatus(true);
      await handleUpdateConsultationStatus(c.id, "rejected", reason || undefined);
      setConsultationActionFeedback(`${c.studentName} 학생의 상담이 거절 처리되었습니다.`);
      setTimeout(() => setConsultationActionFeedback(null), 3000);
    } catch (e: any) {
      alert(`상담 거절 처리 오류: ${e?.message || e}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 상담 완료 처리 핸들러 (교수용)
  const handleProfessorComplete = async (c: ConsultationRequest) => {
    if (!confirm(`${c.studentName} 학생과의 상담을 완료 처리하시겠습니까?`)) return;
    try {
      setIsUpdatingStatus(true);
      await handleUpdateConsultationStatus(c.id, "completed");
      setConsultationActionFeedback("상담이 완료되었습니다.");
      setTimeout(() => setConsultationActionFeedback(null), 3000);
    } catch (e: any) {
      alert(`완료 처리 오류: ${e?.message || e}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 역할별 맞춤형 바로가기 구성
  const roleShortcuts = {
    student: [
      {
        title: "나의 졸업요건 자가점검",
        desc: "전공·교양·복수전공 학점과 교육봉사 시간을 직접 기록하고 점검하세요.",
        href: "/graduation",
        icon: CheckSquare,
        badge: "재학생 필수",
      },
      {
        title: "진로·복수전공 공유방",
        desc: "교직, HRD, 에듀테크 및 심리·경영·컴공 복수전공 선배 후기를 확인하세요.",
        href: "/rooms",
        icon: Compass,
        badge: "정보 아카이브",
      },
      {
        title: "졸업생 동문 멘토 찾기",
        desc: "관심 직무에 재직 중인 교육학과 선배에게 1:1 대화나 멘토링을 요청하세요.",
        href: "/alumni",
        icon: Users,
        badge: "동문 네트워크",
      },
    ],
    alumni: [
      {
        title: "내 졸업생 프로필·멘토링 관리",
        desc: `현재 도착한 멘토링 요청 ${mentoringRequests.length}건을 확인하고 직무 정보를 공유하세요.`,
        href: "/alumni",
        icon: Briefcase,
        badge: "동문 전용",
      },
      {
        title: "후배들과 진로·복전 경험 나누기",
        desc: "내가 겪은 복수전공 팁과 취업 준비 과정을 공유방에 남겨주세요.",
        href: "/rooms",
        icon: Compass,
        badge: "경험 공유",
      },
      {
        title: "재학생과 1:1 / 그룹 대화",
        desc: "멘토링 요청을 보낸 후배들과 실시간 대화창에서 소통하세요.",
        href: "/chat",
        icon: MessageSquare,
        badge: "메신저",
      },
    ],
    professor: [
      {
        title: "학생 검색 및 면담 대화 요청",
        desc: "재학생·졸업생을 검색해 1:1 면담을 요청하거나 연구/수업 단체방을 개설하세요.",
        href: "/chat",
        icon: MessageSquare,
        badge: "교수진 전용",
      },
      {
        title: "진로 트랙별 공유방 참여",
        desc: "학생들의 진로 고민 질문에 코멘트를 남기고 연구실 소식을 전하세요.",
        href: "/rooms",
        icon: Compass,
        badge: "학업·진로 지도",
      },
      {
        title: "학과 공지 및 학사 안내 확인",
        desc: "학과 주요 행사와 교직·학사 공지 현황을 살펴보세요.",
        href: "/notices",
        icon: Megaphone,
        badge: "학과 소식",
      },
    ],
    admin: [
      {
        title: "신규 가입 승인 및 역할 관리",
        desc: `현재 승인 대기 중인 가입 신청 ${
          approvalRequests.filter((r) => r.status === "pending").length
        }건을 검토하고 처리하세요.`,
        href: "/admin",
        icon: ShieldCheck,
        badge: "관리자 전용",
      },
      {
        title: "학과 공지사항 작성 및 고정",
        desc: "새로운 교육학과 공지나 교직 안내를 등록하고 상단에 고정하세요.",
        href: "/notices",
        icon: Megaphone,
        badge: "공지 관리",
      },
      {
        title: "복수전공 공유방 개설·신고 관리",
        desc: "새로운 복수전공 공유방을 추가하거나 신고된 게시글을 관리하세요.",
        href: "/admin",
        icon: UserCheck,
        badge: "커뮤니티 운영",
      },
    ],
  }[currentRole];

  return (
    <div className="space-y-6">
      {/* 상담 액션 피드백 배너 */}
      {consultationActionFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{consultationActionFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setConsultationActionFeedback(null)}
            className="p-1 hover:bg-emerald-700 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* 환영 배너 */}
      <section className="rounded-3xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              동국대학교 교육학과 전용 소통 플랫폼 · 동국e음
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              반갑습니다, {currentUser.name}님! ({ROLE_LABELS[currentRole]} 모드)
            </h1>
            <p className="text-xs sm:text-sm text-orange-50 max-w-2xl leading-relaxed">
              교육(e)으로 사람과 사람을 잇는 <strong>동국e음</strong>입니다. 학과 공지부터
              졸업요건 자가점검, 복수전공·진로 트랙 공유방, 동문 멘토링까지 한곳에서 연결하세요.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <Link
              href="/chat"
              className="px-4 py-2.5 rounded-xl bg-white text-orange-700 font-bold text-xs sm:text-sm shadow-xs hover:bg-orange-50 transition inline-flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              대화창 열기
              {unreadConversations.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-600 text-white text-[10px]">
                  {unreadConversations.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* 역할별 맞춤 바로가기 3종 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {ROLE_LABELS[currentRole]} 맞춤 바로가기
          </h2>
          <span className="text-xs text-slate-500">
            현재 선택된 역할: {ROLE_LABELS[currentRole]}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roleShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-orange-400 transition flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[11px] font-bold">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base mb-1 group-hover:text-orange-600 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-orange-600">
                  <span>바로 이동하기</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 중단 2단 그리드: 최근 학과 공지 & 읽지 않은 채팅 + 졸업요건 바로가기 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 직접 일정 수정 가능한 캘린더 (기존 홈화면 공지란 대체) */}
        <EditableCalendar
          className="lg:col-span-7"
          officialNotices={notices}
        />

        {/* 우측: 지도교수 & 읽지 않은 채팅 & 나의 졸업요건 확인 바로가기 */}
        <div className="lg:col-span-5 space-y-6">
          {/* 학생 전용: 나의 지도교수 영역 */}
          {(currentUser.role === "student" || currentRole === "student") && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-orange-600" />
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    나의 지도교수
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-semibold">
                  교육학과 학생 지도 시스템
                </span>
              </div>

              {myAdvisorInfo.status === "assigned" && myAdvisorInfo.professor ? (
                <div className="p-4 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-gradient-to-r from-orange-50/50 via-white to-orange-50/30 dark:from-slate-800/60 dark:to-slate-800/30 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {myAdvisorInfo.professor.avatarInitials || myAdvisorInfo.professor.name.slice(0, 2)}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {myAdvisorInfo.professor.name}
                        </span>
                        <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                          {myAdvisorInfo.professor.studentIdOrYear || "교육학과 전임교원"}
                        </span>
                        {((myAdvisorInfo.professor as any).id === "u-prof-1" || (myAdvisorInfo.professor as any).email?.includes("@sample.dgu.edu")) && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            테스트 계정
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        소속: 동국대학교 사범대학 교육학과
                      </p>
                      {myAdvisorInfo.professor.specialty && (
                        <p className="text-xs text-slate-500 truncate">
                          전문 분야: {myAdvisorInfo.professor.specialty}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-orange-100 dark:border-orange-900/30">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        myAdvisorInfo.professor.consultationAvailable !== false
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {myAdvisorInfo.professor.consultationAvailable !== false
                        ? "● 상담 가능"
                        : "현재 상담 불가"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfessorForConsultation(myAdvisorInfo.professor);
                        setConsultationModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition"
                    >
                      상담 신청
                    </button>
                  </div>
                </div>
              ) : myAdvisorInfo.status === "invalid_status" ? (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold">지정된 지도교수 계정의 이용 상태를 확인할 수 없습니다.</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      교수 계정 권한이 변경되었거나 이용 정지 상태일 수 있습니다. 학과사무실(관리자)에 문의해 주세요.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1 bg-slate-50/50 dark:bg-slate-800/20">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">지도교수 미등록</p>
                  <p className="text-xs text-slate-400">
                    아직 배정된 지도교수님이 없습니다. 학과사무실 또는 관리자에게 지도교수 지정을 요청해 주세요.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* 읽지 않은 채팅 */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  읽지 않은 대화
                </h2>
              </div>
              <Link
                href="/chat"
                className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
              >
                대화창 이동 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {unreadConversations.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500">
                현재 읽지 않은 새 메시지가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {unreadConversations.map((conv) => {
                  const myMember = conv.members.find(
                    (m) => m.userId === currentUser.id
                  );
                  return (
                    <Link
                      key={conv.id}
                      href="/chat"
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 hover:border-orange-400 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {conv.title}
                          </p>
                          <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-bold">
                            +{formatUnreadBadge(myMember?.unreadCount || 0)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                          {conv.lastMessageText}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {conv.lastMessageAt}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* 나의 졸업요건 확인 바로가기 (재학생/관리자 전용) */}
          {canAccessGraduation(currentUser) && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-orange-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  나의 졸업요건 자가점검 요약
                </h2>
              </div>
              <Link
                href="/graduation"
                className="text-xs font-semibold text-orange-600 hover:underline"
              >
                상세 기록하기 →
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-2 text-xs">
              {(() => {
                const homeAudit = calculateGraduationAudit(studentProgress, graduationCatalog);
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">적용 기준 정보</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {homeAudit.profile.admissionYearLabel} · {studentProgress.majorType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">내가 기록한 총 이수 학점</span>
                      <span className="font-bold text-orange-600">
                        {homeAudit.totalEarnedCredits}학점 / {homeAudit.applicable.cohortRule.totalGraduationCredits}학점
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">내가 기록한 교육봉사 시간</span>
                      <span className="font-bold text-orange-600">
                        {homeAudit.volunteeringAudit.effectiveHours}시간 / {homeAudit.volunteeringAudit.targetHours}시간
                      </span>
                    </div>
                  </>
                );
              })()}
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                ※ 공식 학사 시스템 연동 결과가 아닌 학생 개인의 자가점검 메모입니다.
              </p>
            </div>
          </section>
          )}
        </div>
      </div>

      {/* 내가 참여한 진로 공유방 & 최근 등록된 복수전공 후기 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 내가 참여한 진로 공유방 */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                내가 참여 중인 공유방 ({myJoinedRooms.length})
              </h2>
            </div>
            <Link
              href="/rooms"
              className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
            >
              전체 공유방 탐색 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myJoinedRooms.slice(0, 4).map((room) => (
              <Link
                key={room.id}
                href="/rooms"
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-400 transition bg-slate-50/50 dark:bg-slate-800/40"
              >
                <span className="inline-block px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[10px] font-bold mb-1.5">
                  {room.type === "career" ? "진로 트랙" : "복수전공"} · {room.categoryName}
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {room.name}
                </h3>
                <p className="text-[11px] text-slate-500 line-clamp-1">
                  참여 인원 {room.memberIds.length}명
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* 최근 등록된 복수전공 후기 */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                최근 등록된 복수전공 후기
              </h2>
            </div>
            <Link
              href="/rooms"
              className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
            >
              후기 더보기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {doubleMajorReviews.map((post) => (
              <Link
                key={post.id}
                href="/rooms"
                className="block p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-orange-300 bg-slate-50/60 dark:bg-slate-800/40 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    [{post.roomName}]
                  </span>
                  <span>
                    {post.authorName} ({post.authorBadge})
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {post.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* 교수 전용: 학생 상담 신청 관리함 */}
      {(currentUser.role === "professor" || currentRole === "professor") && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <Inbox className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                학생 상담 신청 관리함
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-xs font-bold">
                총 {myProfessorConsultations.length}건
              </span>
            </div>

            {/* 필터 탭 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: "all", label: "전체" },
                { key: "pending", label: "대기중" },
                { key: "accepted", label: "수락됨" },
                { key: "reschedule_requested", label: "일정 조정" },
                { key: "closed", label: "완료/거절" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setProfessorConsultationFilter(tab.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    professorConsultationFilter === tab.key
                      ? "bg-orange-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredProfessorConsultations.length > 0 ? (
            <div className="space-y-3">
              {filteredProfessorConsultations.map((c) => {
                const st = CONSULTATION_STATUS_BADGES[c.status];
                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-orange-300 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          {c.studentName}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">
                          {c.studentIdOrYear}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold text-xs">
                          {c.consultationType}
                        </span>
                        {st && (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.style}`}>
                            {st.label}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        신청일: {c.createdAt.slice(0, 10)}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span>학생 제안 희망 일정: {c.preferredDate} · {c.preferredTime}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">상담 목적: </span>
                        {c.purpose}
                      </div>
                      {c.rescheduleNote && (
                        <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-300 font-semibold">
                          <span>교수님 전달 메모: </span>
                          <span>{c.rescheduleNote}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
                      {c.status === "pending" && (
                        <>
                          <button
                            type="button"
                            disabled={isUpdatingStatus}
                            onClick={() => handleProfessorAccept(c)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> 상담 수락
                          </button>
                          <button
                            type="button"
                            disabled={isUpdatingStatus}
                            onClick={() => {
                              setTargetConsultationForReschedule(c);
                              setRescheduleNoteInput(c.rescheduleNote || "");
                              setRescheduleModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> 일정 조정 제안
                          </button>
                          <button
                            type="button"
                            disabled={isUpdatingStatus}
                            onClick={() => handleProfessorReject(c)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition disabled:opacity-50"
                          >
                            거절
                          </button>
                        </>
                      )}

                      {(c.status === "accepted" || c.status === "reschedule_requested") && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleGoToConsultationChat(c)}
                            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            1:1 대화방 열기
                          </button>
                          <button
                            type="button"
                            disabled={isUpdatingStatus}
                            onClick={() => handleProfessorComplete(c)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition disabled:opacity-50"
                          >
                            상담 완료 처리
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
              <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                접수된 상담 신청 내역이 없습니다.
              </p>
              <p className="text-xs text-slate-400">
                학생들이 교수 상담을 신청하면 이곳에 실시간으로 표시됩니다.
              </p>
            </div>
          )}
        </section>
      )}

      {/* 학생 전용: 나의 상담 신청 내역 */}
      {(currentUser.role === "student" || currentRole === "student") && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                나의 상담 신청 내역
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              신청 건수: {myStudentConsultations.length}건
            </span>
          </div>

          {myStudentConsultations.length > 0 ? (
            <div className="space-y-3">
              {myStudentConsultations.map((c) => {
                const st = CONSULTATION_STATUS_BADGES[c.status];
                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-orange-300 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          {c.professorName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold text-xs">
                          {c.consultationType}
                        </span>
                        {st && (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.style}`}>
                            {st.label}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        신청일: {c.createdAt.slice(0, 10)}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span>희망 제안 일정: {c.preferredDate} · {c.preferredTime}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">신청 질문/내용: </span>
                        {c.purpose}
                      </div>
                      {c.rescheduleNote && (
                        <div className="mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200 space-y-0.5">
                          <p className="font-bold flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                            교수님의 일정 조정 메모
                          </p>
                          <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                            {c.rescheduleNote}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {c.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleCancelStudentConsultation(c.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition"
                        >
                          신청 취소
                        </button>
                      )}

                      {c.status === "accepted" && (
                        <button
                          type="button"
                          onClick={() => handleGoToConsultationChat(c)}
                          className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          1:1 대화방으로 이동
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1 bg-slate-50/40 dark:bg-slate-800/20">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                아직 신청한 교수 상담 내역이 없습니다.
              </p>
              <p className="text-xs text-slate-400">
                지도교수 또는 교수 상담 목록에서 [상담 신청] 버튼을 눌러 학업 및 진로 상담을 요청해 보세요.
              </p>
            </div>
          )}
        </section>
      )}

      {/* 교수 상담 영역 */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              교수 상담
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            교육학과 승인 전임교원
          </span>
        </div>

        {approvedProfessors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedProfessors.map((prof) => (
              <div
                key={prof.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-300 transition flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                        {prof.avatarInitials || prof.name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {prof.name}
                          </span>
                          {(prof.id === "u-prof-1" || (prof as any).email?.includes("@sample.dgu.edu")) && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                              테스트 계정
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          동국대학교 사범대학 교육학과
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        prof.consultationAvailable !== false
                          ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {prof.consultationAvailable !== false ? "● 상담 가능" : "상담 불가"}
                    </span>
                  </div>

                  {prof.specialty && (
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 line-clamp-1">
                      전문 분야: {prof.specialty}
                    </p>
                  )}
                  {prof.bio && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {prof.bio}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {prof.studentIdOrYear || "교육학과 전임교원"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProfessorForConsultation(prof);
                      setConsultationModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-2xs transition"
                  >
                    상담 신청
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
            <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              현재 등록된 교수님이 없습니다
            </p>
            <p className="text-xs text-slate-400">
              교수 계정이 가입 후 관리자 승인을 받으면 이곳에 자동으로 표시됩니다.
            </p>
          </div>
        )}
      </section>

      {/* 추천 졸업생 멘토 */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              추천 졸업생 동문 프로필
            </h2>
          </div>
          <Link
            href="/alumni"
            className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
          >
            졸업생 전체 탐색 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedAlumni.map((alumni) => (
            <Link
              key={alumni.id}
              href="/alumni"
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-400 transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {alumni.displayName}
                </span>
                <span className="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[11px] font-bold">
                  {alumni.careerTrack}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {alumni.currentRoleTitle}
              </p>
              <p className="text-xs text-slate-500">
                복수전공: {alumni.doubleMajor} · {alumni.graduationYear}년 졸업
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* 교수 상담 신청 모달 (1단계 연동 안내 및 2단계 신청 폼 가이드) */}
      {consultationModalOpen && selectedProfessorForConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  교수 상담 신청
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConsultationModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 교수 정보 요약 */}
            <div className="p-3.5 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                {selectedProfessorForConsultation.avatarInitials || selectedProfessorForConsultation.name.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {selectedProfessorForConsultation.name}
                  </span>
                  <span className="text-xs text-orange-700 dark:text-orange-300 font-bold">
                    {selectedProfessorForConsultation.specialty || "교육학과 전임교원"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  동국대학교 사범대학 교육학과
                  {selectedProfessorForConsultation.specialty ? ` · ${selectedProfessorForConsultation.specialty}` : ""}
                </p>
              </div>
            </div>

            {/* 상담 신청 폼 */}
            <form onSubmit={handleSubmitConsultation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  상담 유형 선택 *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      "학업 상담",
                      "진로 상담",
                      "복수전공 상담",
                      "대학원 진학 상담",
                      "기타",
                    ] as ConsultationType[]
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setConsultationType(type)}
                      className={`p-2 rounded-xl font-bold border transition text-center ${
                        consultationType === type
                          ? "border-orange-600 bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 shadow-2xs"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    희망 날짜 (학생 제안) *
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    희망 시간대 (학생 제안) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 14:00 또는 수요일 오후"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  상담 목적 또는 질문 내용 *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="교수님께 여쭙고 싶은 내용이나 상담 목적을 구체적으로 적어주세요."
                  value={consultationPurpose}
                  onChange={(e) => setConsultationPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className="font-bold text-orange-800 dark:text-orange-300">💡 안내: </span>
                희망 일시는 확정된 예약이 아닌 학생이 제안하는 시간이며, 교수님의 일정 확인 후 수락되거나 조정 메모가 전달될 수 있습니다.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setConsultationModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConsultation}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingConsultation ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      접수 처리 중...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      상담 신청서 제출
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 교수용: 일정 조정 제안 모달 */}
      {rescheduleModalOpen && targetConsultationForReschedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  일정 조정 제안
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1 border border-slate-100 dark:border-slate-800">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                신청 학생: {targetConsultationForReschedule.studentName} ({targetConsultationForReschedule.studentIdOrYear})
              </p>
              <p className="text-slate-500">
                학생 제안 희망 일정: {targetConsultationForReschedule.preferredDate} · {targetConsultationForReschedule.preferredTime}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                조정 제안 메모 또는 변경 가능 시간 *
              </label>
              <textarea
                rows={3}
                placeholder="예: 제안하신 시간에는 수업이 있어 11월 12일(목) 16:00에 교수 연구실에서 면담 가능합니다."
                value={rescheduleNoteInput}
                onChange={(e) => setRescheduleNoteInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRescheduleModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleProfessorSubmitReschedule}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
              >
                {isUpdatingStatus ? "전송 중..." : "일정 조정 요청 전송"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
