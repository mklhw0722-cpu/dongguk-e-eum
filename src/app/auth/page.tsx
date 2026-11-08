"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import {
  MajorPlanType,
  StudentAcademicProfile,
  TeachingTrackStatus,
  UserRole,
} from "@/types";
import { formatAdmissionYearLabel } from "@/lib/graduationCurriculum";
import { ROLE_LABELS } from "@/components/common/Cards";
import {
  UserCheck,
  ShieldAlert,
  Clock,
  XCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Mail,
  KeyRound,
  ShieldCheck,
  LogOut,
  Sparkles,
  GraduationCap,
  Briefcase,
  BookOpen,
} from "lucide-react";
import { Panel, Badge, Button, cn } from "@/components/ui";

type AuthScreenTab =
  | "login"
  | "signup"
  | "reset"
  | "pending"
  | "bootstrap_admin"
  | "rejected_or_supplement";

export default function AuthPage() {
  const {
    currentRole,
    switchRole,
    rawFirebaseUser,
    authUserProfile,
    isRealAuthActive,
    handleLogin,
    handleSignUp,
    handleLogout,
    handleResetPassword,
    handleClaimInitialAdmin,
    isFirestoreConnected,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AuthScreenTab>(
    isRealAuthActive && authUserProfile?.approvalStatus === "pending"
      ? "pending"
      : "login"
  );

  // 로그인 폼 상태
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSentNotice, setResetSentNotice] = useState(false);

  // 회원가입 폼 상태
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupStudentId, setSignupStudentId] = useState("");
  const [signupNote, setSignupNote] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // 신입학 재학생 전용 학사정보 입력 상태
  const [signupAdmissionYear, setSignupAdmissionYear] = useState<number>(2024);
  const [signupMajorPlanType, setSignupMajorPlanType] = useState<MajorPlanType>("single");
  const [signupDoubleMajorDept, setSignupDoubleMajorDept] = useState("");
  const [signupTeachingStatus, setSignupTeachingStatus] =
    useState<TeachingTrackStatus>("educational_major");
  const [signupIsEnglishTrack, setSignupIsEnglishTrack] = useState(false);

  // 최초 관리자 등록 상태
  const [adminClaimLoading, setAdminClaimLoading] = useState(false);
  const [adminClaimFeedback, setAdminClaimFeedback] = useState<string | null>(null);

  const onLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await handleLogin(loginEmail.trim(), loginPassword);
      setLoginEmail("");
      setLoginPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("user-not-found") || msg.includes("invalid-credential")) {
        setLoginError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (msg.includes("wrong-password")) {
        setLoginError("비밀번호가 일치하지 않습니다.");
      } else {
        setLoginError(msg);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const onResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError("비밀번호를 재설정할 이메일 주소를 입력해 주세요.");
      return;
    }
    setResetError(null);
    setResetLoading(true);
    try {
      await handleResetPassword(resetEmail.trim());
      setResetSentNotice(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("user-not-found")) {
        setResetError("등록되지 않은 이메일 주소입니다. 가입 여부를 확인해 주세요.");
      } else if (msg.includes("invalid-email")) {
        setResetError("올바른 이메일 주소 형식이 아닙니다.");
      } else {
        setResetError(msg);
      }
    } finally {
      setResetLoading(false);
    }
  };

  const onSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (signupPassword.length < 6) {
      setSignupError("비밀번호는 최소 6자리 이상이어야 합니다.");
      return;
    }

    if (
      selectedRole === "student" &&
      signupMajorPlanType !== "single" &&
      !signupDoubleMajorDept.trim()
    ) {
      setSignupError("복수전공을 선택한 경우 복수전공 학과명을 입력해 주세요.");
      return;
    }

    const admissionYearLabel = formatAdmissionYearLabel(signupAdmissionYear);
    const studentAcademicProfile: StudentAcademicProfile | undefined =
      selectedRole === "student"
        ? {
            admissionYearNumber: signupAdmissionYear,
            admissionYearLabel,
            majorPlanType: "single",
            hasDoubleMajor: false,
            doubleMajorDepartment: "",
            teachingTrackStatus: "educational_major",
            isEnglishTrack: false,
            specialConditionMemo: "",
            adminVerifiedSpecialCondition: false,
            updatedAt: new Date().toISOString().slice(0, 10),
          }
        : undefined;

    const resolvedStudentIdOrYear =
      selectedRole === "student"
        ? admissionYearLabel
        : signupStudentId.trim() || "학번 미기재";

    setSignupLoading(true);
    try {
      await handleSignUp({
        email: signupEmail.trim(),
        password: signupPassword,
        name: signupName.trim(),
        studentIdOrYear: resolvedStudentIdOrYear,
        role: selectedRole,
        verificationNote: signupNote.trim() || "소속 확인 신청",
        academicProfile: studentAcademicProfile,
        doubleMajor:
          selectedRole === "student"
            ? signupMajorPlanType === "single"
              ? "단일전공(교육학)"
              : signupDoubleMajorDept.trim()
            : undefined,
      });
      setSignupPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("email-already-in-use")) {
        setSignupError("이미 가입된 이메일 주소입니다. 로그인해 주세요.");
      } else {
        setSignupError(msg);
      }
    } finally {
      setSignupLoading(false);
    }
  };

  const onClaimAdminSubmit = async () => {
    setAdminClaimFeedback(null);
    setAdminClaimLoading(true);
    try {
      await handleClaimInitialAdmin();
      setAdminClaimFeedback("축하합니다! 현재 계정이 시스템 최초 관리자로 승인 등록되었습니다.");
    } catch (err: unknown) {
      setAdminClaimFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setAdminClaimLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-600" />
            <h1 className="text-xl sm:text-2xl font-black text-ink">
              동국e음 회원 인증 및 가입 신청
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-ink-3 mt-1">
            동국대학교 교육학과 승인 회원 전용 플랫폼입니다. 계정 로그인 및 관리자 소속 승인 절차를 지원합니다.
          </p>
        </div>
      </div>

      {/* 현재 로그인 세션 상태 표시 (로그인 상태일 때) */}
      {isRealAuthActive && authUserProfile && (
        <Panel padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border-line">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-ink">
                현재 로그인: {authUserProfile.name} ({authUserProfile.email})
              </span>
              <Badge tone={authUserProfile.approvalStatus === "approved" ? "success" : "warning"}>
                {authUserProfile.approvalStatus === "approved"
                  ? "승인완료 (정회원)"
                  : "승인 대기중 (pending)"}
              </Badge>
              <Badge tone={authUserProfile.role}>
                {ROLE_LABELS[authUserProfile.role]}
              </Badge>
            </div>
            <p className="text-xs text-ink-3 mt-1">
              {authUserProfile.role === "admin"
                ? `가입일: ${authUserProfile.joinedAt}`
                : `소속 정보: ${authUserProfile.studentIdOrYear} · 가입일: ${authUserProfile.joinedAt}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleLogout()}
            className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-rose-50 hover:text-rose-600 text-ink-2 text-xs font-bold inline-flex items-center gap-1.5 transition self-start sm:self-auto border border-line"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </Panel>
      )}

      {/* 단계별 화면 전환 탭 */}
      <div className="flex flex-wrap gap-2 bg-surface p-1.5 rounded-2xl border border-line">
        {[
          { key: "login", label: "1. 로그인" },
          { key: "signup", label: "2. 신규 회원가입 신청" },
          { key: "reset", label: "3. 비밀번호 재설정" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as AuthScreenTab)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition",
              activeTab === tab.key
                ? "bg-brand-600 text-white shadow-2xs"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        ))}
        {isRealAuthActive && authUserProfile?.approvalStatus === "pending" && (
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition",
              activeTab === "pending"
                ? "bg-brand-600 text-white shadow-2xs"
                : "text-amber-700 hover:bg-amber-50"
            )}
          >
            대기 현황 확인
          </button>
        )}
      </div>

      {/* 1. 실제 로그인 화면 */}
      {activeTab === "login" && (
        <Panel padding="lg" className="max-w-md mx-auto bg-surface border-line space-y-5 shadow-xs">
          <div className="text-center space-y-2">
            <div
              aria-hidden="true"
              className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-2xs"
            >
              e
            </div>
            <h2 className="text-xl font-black text-ink">
              동국e음 회원 로그인
            </h2>
            <p className="text-xs text-ink-3">
              동국대학교 교육학과 승인 회원 전용
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={onLoginSubmit} className="space-y-3.5 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-ink mb-1.5">이메일 주소</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="예: student@dgu.ac.kr"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-ink">비밀번호</label>
                <button
                  type="button"
                  onClick={() => setActiveTab("reset")}
                  className="text-xs text-brand-600 hover:underline font-semibold"
                >
                  비밀번호 찾기
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer"
            >
              {loginLoading ? "로그인 확인 중..." : "로그인"}
            </button>
          </form>

          <div className="pt-3 border-t border-line text-center space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className="text-xs font-bold text-brand-600 hover:underline block mx-auto cursor-pointer"
            >
              계정이 없으신가요? 신규 회원가입 신청 →
            </button>
          </div>
        </Panel>
      )}

      {/* 2. 비밀번호 재설정 화면 */}
      {activeTab === "reset" && (
        <Panel padding="lg" className="max-w-md mx-auto bg-surface border-line space-y-5 shadow-xs">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-black text-ink">
              비밀번호 재설정
            </h2>
            <p className="text-xs text-ink-3">
              가입하신 이메일 주소를 입력하시면 비밀번호 재설정 인증 메일을 보내드립니다.
            </p>
          </div>

          {resetError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{resetError}</span>
            </div>
          )}

          {resetSentNotice && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>재설정 인증 이메일 발송 완료</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                <strong>{resetEmail}</strong> 주소로 비밀번호 재설정 링크가 발송되었습니다.<br />
                메일함을 확인하신 후 링크를 클릭하여 새로운 비밀번호를 설정해 주세요.
              </p>
            </div>
          )}

          <form onSubmit={onResetSubmit} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-ink mb-1.5">가입된 이메일 주소</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="예: student@dgu.ac.kr"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-2 text-[11px] text-ink-3 space-y-1.5 border border-line">
              <p className="font-semibold text-ink-2">💡 비밀번호 재설정 안내</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>실제 가입된 회원 계정의 이메일로만 재설정 링크가 전송됩니다.</li>
                <li>메일을 받으신 후 링크를 클릭해 새로운 비밀번호를 안전하게 설정하실 수 있습니다.</li>
                <li>메일이 보이지 않는 경우 스팸 메일함도 함께 확인해 주세요.</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold transition cursor-pointer shadow-xs"
            >
              {resetLoading ? "인증 메일 발송 중..." : "비밀번호 재설정 인증 메일 발송"}
            </button>
          </form>

          <div className="pt-3 border-t border-line text-center">
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className="text-xs font-bold text-brand-600 hover:underline block mx-auto cursor-pointer"
            >
              ← 로그인 화면으로 돌아가기
            </button>
          </div>
        </Panel>
      )}

      {/* 3. 신규 회원가입 화면 */}
      {activeTab === "signup" && (
        <Panel padding="lg" className="max-w-2xl mx-auto bg-surface border-line space-y-6 shadow-xs">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-ink">
              동국e음 회원가입 신청
            </h2>
            <p className="text-xs sm:text-sm text-ink-3 mt-1">
              가입 신청서를 제출하시면 학과 관리자의 소속 확인(승인) 후 모든 학과 전용 서비스가 활성화됩니다.
            </p>
          </div>

          {signupError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{signupError}</span>
            </div>
          )}

          {/* 사용자 유형 선택 라디오 그룹 */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-bold text-ink">
              Step 1. 사용자 유형 선택 *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  role: "student" as UserRole,
                  title: "재학생",
                  desc: "공지 확인, 졸업요건 자가점검, 게시판 및 대화 참여",
                  icon: <GraduationCap className="w-5 h-5 text-brand-600 mb-1" />,
                },
                {
                  role: "alumni" as UserRole,
                  title: "졸업생",
                  desc: "진로 프로필 등록, 후배 멘토링 및 직무 경험 공유",
                  icon: <Briefcase className="w-5 h-5 text-amber-600 mb-1" />,
                },
                {
                  role: "professor" as UserRole,
                  title: "교수진",
                  desc: "학생 면담 요청 승인, 연구·지도 소통 공간 지원",
                  icon: <BookOpen className="w-5 h-5 text-emerald-600 mb-1" />,
                },
              ].map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => setSelectedRole(item.role)}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition flex flex-col justify-between",
                    selectedRole === item.role
                      ? "bg-accent-soft border-brand-500 ring-2 ring-brand-500/20"
                      : "bg-surface border-line hover:border-brand-300"
                  )}
                >
                  <div>
                    {item.icon}
                    <p className="font-extrabold text-sm text-ink">
                      {item.title}
                    </p>
                    <p className="text-xs text-ink-3 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={onSignupSubmit} className="space-y-4 text-xs sm:text-sm">
            <p className="font-bold text-ink text-xs sm:text-sm pt-2 border-t border-line">
              Step 2. 가입 정보 입력 *
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-ink mb-1.5">이름 *</label>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="예: 김동국"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {selectedRole === "student" ? (
                <div>
                  <label className="block font-bold text-ink mb-1.5">
                    입학 연도 (신입학 재학생 기준) *
                  </label>
                  <select
                    value={signupAdmissionYear}
                    onChange={(e) => setSignupAdmissionYear(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014].map(
                      (yr) => (
                        <option key={yr} value={yr}>
                          {yr}학년도 신입학 ({String(yr).slice(-2)}학번)
                        </option>
                      )
                    )}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-ink mb-1.5">학번 / 졸업연도 / 직함 *</label>
                  <input
                    type="text"
                    required
                    value={signupStudentId}
                    onChange={(e) => setSignupStudentId(e.target.value)}
                    placeholder="예: 18학번 졸업 / 교육학과 전임교원"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-ink mb-1.5">이메일 (로그인 ID) *</label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="예: user@dgu.ac.kr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-ink mb-1.5">비밀번호 (6자리 이상) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="6자리 이상 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-ink mb-1.5">가입 신청 메모 (학과 확인용)</label>
              <textarea
                rows={3}
                value={signupNote}
                onChange={(e) => setSignupNote(e.target.value)}
                placeholder="예: 교육학과 23학번 재학생입니다. 플랫폼 이용을 신청합니다."
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface-2 text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="text-xs font-bold text-ink-3 hover:text-ink hover:underline"
              >
                이미 계정이 있으신가요? 로그인하기
              </button>
              <button
                type="submit"
                disabled={signupLoading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer"
              >
                {signupLoading ? "계정 생성 중..." : "회원가입 완료 및 승인 요청"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* 4. 승인 대기 화면 (실시간 감지 연동) */}
      {activeTab === "pending" && (
        <Panel padding="lg" className="max-w-xl mx-auto bg-surface border-line p-8 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black text-ink">
            {authUserProfile?.approvalStatus === "approved"
              ? "🎉 가입 승인이 완료되었습니다!"
              : "관리자 소속 승인 대기 중입니다"}
          </h2>

          <p className="text-xs sm:text-sm text-ink-2 leading-relaxed max-w-md mx-auto">
            {authUserProfile?.approvalStatus === "approved"
              ? "축하합니다! 학과 관리자의 승인이 완료되어 이제 플랫폼의 모든 게시판, 대화창, 멘토링 기능을 정상 이용하실 수 있습니다."
              : "동국대학교 교육학과 전용 플랫폼의 보안 정책에 따라 관리자의 소속 확인 후 내부 콘텐츠가 열립니다. 관리자가 승인하면 새로고침 없이 화면이 즉시 열립니다."}
          </p>

          <div className="p-4 rounded-2xl bg-surface-2 text-left text-xs space-y-1.5 border border-line">
            <p className="font-bold text-ink flex items-center justify-between">
              <span>내 가입 프로필 상태</span>
              <Badge tone={authUserProfile?.approvalStatus === "approved" ? "success" : "warning"}>
                {authUserProfile?.approvalStatus || "pending"}
              </Badge>
            </p>
            <p className="text-ink-2">
              - 이름: {authUserProfile?.name || "확인중"}<br />
              - 이메일: {authUserProfile?.email || rawFirebaseUser?.email || "확인중"}<br />
              - 역할: {ROLE_LABELS[authUserProfile?.role || "student"]}{authUserProfile?.role !== "admin" && authUserProfile?.studentIdOrYear ? ` (${authUserProfile.studentIdOrYear})` : ""}
            </p>
            {authUserProfile?.adminComment && (
              <p className="text-brand-600 font-semibold pt-1 border-t border-line">
                관리자 메시지: {authUserProfile.adminComment}
              </p>
            )}
          </div>

          {/* 최초 관리자 등록 안내 상자 */}
          {authUserProfile?.approvalStatus !== "approved" && (
            <div className="p-4 rounded-2xl bg-accent-soft border border-orange-200 text-left space-y-2">
              <div className="flex items-center gap-1.5 text-brand-600 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span>내가 이 시스템의 개설자(관리자)인가요?</span>
              </div>
              <p className="text-[11px] text-ink-2 leading-relaxed">
                처음 프로젝트를 만든 분은 아래 버튼을 눌러 본인 계정을 <strong>최초 관리자(Admin)</strong>로 즉시 승격시킬 수 있습니다. 관리자가 되면 승인 대기가 풀리고 관리자 콘솔이 활성화됩니다.
              </p>
              {adminClaimFeedback && (
                <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  {adminClaimFeedback}
                </p>
              )}
              <button
                type="button"
                onClick={onClaimAdminSubmit}
                disabled={adminClaimLoading}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {adminClaimLoading
                  ? "관리자로 등록 처리 중..."
                  : "👑 현재 계정을 최초 관리자로 승격 등록하기 (즉시 승인 완료)"}
              </button>
            </div>
          )}

          <div className="pt-2 flex flex-wrap justify-center gap-2.5">
            {authUserProfile?.approvalStatus === "approved" ? (
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs"
              >
                동국e음 메인 홈으로 입장하기 →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleLogout()}
                className="px-4 py-2 rounded-xl border border-line bg-surface hover:bg-surface-2 text-ink-2 text-xs font-bold transition"
              >
                로그아웃하고 다른 계정으로 로그인
              </button>
            )}
          </div>
        </Panel>
      )}

      {/* 5. 최초 관리자 안전 등록 화면 */}
      {activeTab === "bootstrap_admin" && (
        <Panel padding="lg" className="max-w-xl mx-auto bg-surface border-line space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-brand-600">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="text-lg font-black text-ink">
              최초 관리자(Admin) 계정 안전 등록 절차
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-ink-2 leading-relaxed">
            새로 만든 Firebase 프로젝트에 최초 관리자가 없는 상태에서, 현재 로그인된 계정을 시스템 최초 관리자로 1회에 한해 안전하게 승격 등록합니다.
          </p>

          <div className="p-4 rounded-2xl bg-accent-soft border border-orange-200 text-xs space-y-1.5">
            <p className="font-bold text-ink">
              보안 원칙:
            </p>
            <p className="text-ink-2">
              - <code>system/admin_bootstrap</code> 문서에 최초 관리자 UID가 1회 영구 기록됩니다.<br />
              - 한 번 등록된 이후에는 다른 사용자가 임의로 관리자 권한을 가로챌 수 없도록 Firestore 보안 규칙에서 영구 차단됩니다.
            </p>
          </div>

          {adminClaimFeedback && (
            <div className="p-3.5 rounded-xl bg-surface-2 text-xs font-semibold text-ink border border-line">
              {adminClaimFeedback}
            </div>
          )}

          {rawFirebaseUser ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-ink-2">
                현재 로그인된 계정: <strong>{rawFirebaseUser.email}</strong>
              </p>
              <button
                type="button"
                onClick={onClaimAdminSubmit}
                disabled={adminClaimLoading}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition shadow-xs"
              >
                {adminClaimLoading ? "관리자 등록 처리 중..." : "이 계정을 최초 관리자로 승격 등록하기"}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-surface-2 text-center text-xs text-ink-3 space-y-2 border border-line">
              <p>최초 관리자로 등록할 계정으로 먼저 로그인해 주세요.</p>
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="px-4 py-2 rounded-xl bg-ink text-white font-bold"
              >
                로그인하러 가기
              </button>
            </div>
          )}
        </Panel>
      )}

      {/* 6. 승인 거절 및 보완 요청 안내 화면 */}
      {activeTab === "rejected_or_supplement" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel padding="lg" className="bg-surface border border-amber-300 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-amber-700">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-black">소속 정보 보완 요청 상태</h3>
            </div>
            <p className="text-xs sm:text-sm text-ink-2">
              제출하신 가입 신청서에서 학번 또는 교육학과 소속 확인 정보가 부족하여 관리자가 보완을 요청한 상태입니다.
            </p>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1">
              <p className="font-bold text-amber-900">
                관리자 전달 메모:
              </p>
              <p className="text-amber-800">
                &ldquo;학번(입학연도)과 교육학과 본전공/복수전공 여부가 누락되어 있습니다. 정보를 보완해 주세요.&rdquo;
              </p>
            </div>
          </Panel>

          <Panel padding="lg" className="bg-surface border border-rose-200 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <XCircle className="w-6 h-6" />
              <h3 className="text-lg font-black">가입 승인 거절 상태</h3>
            </div>
            <p className="text-xs sm:text-sm text-ink-2">
              동국대학교 교육학과 구성원 자격이 확인되지 않거나 외부 홍보 목적으로 판단되어 가입 승인이 거절된 상태입니다.
            </p>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1">
              <p className="font-bold text-rose-900">
                거절 사유:
              </p>
              <p className="text-rose-800">
                &ldquo;동국대학교 교육학과 구성원(재학생·졸업생·교수진)만 가입할 수 있는 전용 플랫폼입니다.&rdquo;
              </p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
