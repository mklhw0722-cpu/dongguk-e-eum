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
import { ROLE_LABELS, DemoInfoBanner } from "@/components/common/Cards";
import {
  UserCheck,
  ShieldAlert,
  Clock,
  XCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  FileWarning,
  Mail,
  KeyRound,
  ShieldCheck,
  LogOut,
  Sparkles,
} from "lucide-react";

type AuthScreenTab =
  | "login"
  | "signup"
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

  // 신입학 재학생 전용 학사정보 입력 상태 (전공 이수 형태와 교직 이수 상태를 독립 축으로 분리)
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

  const onResetPasswordClick = async () => {
    if (!loginEmail.trim()) {
      setLoginError("비밀번호를 재설정할 이메일 주소를 먼저 입력해 주세요.");
      return;
    }
    setLoginError(null);
    try {
      await handleResetPassword(loginEmail.trim());
      setResetSentNotice(true);
      setTimeout(() => setResetSentNotice(false), 5000);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : String(err));
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
            majorPlanType: signupMajorPlanType,
            hasDoubleMajor: signupMajorPlanType !== "single",
            doubleMajorDepartment:
              signupMajorPlanType === "single" ? "" : signupDoubleMajorDept.trim(),
            teachingTrackStatus: signupTeachingStatus,
            isEnglishTrack: signupIsEnglishTrack,
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
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Firebase 계정 인증 및 관리자 승인 시스템
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            이메일·비밀번호 기반 실제 회원가입, 실시간 관리자 승인(pending → approved), 그리고 보안 접근 제어를 지원합니다.
          </p>
        </div>


      </div>

      <DemoInfoBanner
        title="보안 규칙 강제: 승인된 회원만 내부 데이터 접근 가능"
        description="회원가입 시 Firestore에 무조건 승인 대기(pending) 상태로 등록되며, 사용자가 자신의 승인 상태나 관리자 권한을 스스로 변경하는 것은 서버(Firestore Security Rules)에서 원천 차단됩니다."
        variant="amber"
      />

      {/* 현재 로그인 세션 상태 표시 */}
      {isRealAuthActive && authUserProfile && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                현재 로그인 계정: {authUserProfile.name} ({authUserProfile.email})
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  authUserProfile.approvalStatus === "approved"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {authUserProfile.approvalStatus === "approved"
                  ? "승인완료 (정회원)"
                  : "승인 대기중 (pending)"}
              </span>
              <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[11px] font-bold">
                {ROLE_LABELS[authUserProfile.role]}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              소속 정보: {authUserProfile.studentIdOrYear} · 가입일: {authUserProfile.joinedAt}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleLogout()}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-xs font-bold inline-flex items-center gap-1.5 transition self-start sm:self-auto"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      )}

      {/* 단계별 화면 전환 탭 */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        {/* 이 화면은 비로그인 사용자에게만 보이므로 로그인·회원가입 탭만 노출합니다.
            (승인 대기·거절 안내는 로그인 후 상태에 맞춰 AppShell 이 자동으로 보여줍니다) */}
        {[
          { key: "login", label: "1. 로그인 (이메일/비번)" },
          { key: "signup", label: "2. 신규 회원가입" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as AuthScreenTab)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === tab.key
                ? "bg-orange-600 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. 실제 로그인 화면 */}
      {activeTab === "login" && (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white font-black text-2xl flex items-center justify-center mx-auto">
              e
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              동국e음 회원 로그인
            </h2>
            <p className="text-xs text-slate-500">
              동국대학교 교육학과 승인 회원 전용 (Firebase Auth 연동)
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {resetSentNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>비밀번호 재설정 이메일을 발송했습니다. 받은 편지함을 확인해 주세요.</span>
            </div>
          )}

          <form onSubmit={onLoginSubmit} className="space-y-3.5 text-xs sm:text-sm">
            <div>
              <label className="block font-bold mb-1">이메일 주소</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="예: student@dgu.ac.kr"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold">비밀번호</label>
                <button
                  type="button"
                  onClick={onResetPasswordClick}
                  className="text-xs text-orange-600 hover:underline font-semibold"
                >
                  비밀번호 재설정
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold transition"
            >
              {loginLoading ? "로그인 확인 중..." : "로그인"}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className="text-xs font-bold text-orange-600 hover:underline block mx-auto"
            >
              계정이 없으신가요? 신규 회원가입 신청 →
            </button>

          </div>
        </div>
      )}

      {/* 2. 신규 회원가입 화면 */}
      {activeTab === "signup" && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              동국e음 회원가입 신청 (Firebase Auth & Firestore)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              가입 즉시 계정이 생성되며, Firestore에 <strong>승인 대기(pending)</strong> 상태로 기록되어 관리자 승인 후 모든 콘텐츠가 열립니다.
            </p>
          </div>

          {signupError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{signupError}</span>
            </div>
          )}

          {/* 사용자 유형 선택 */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-bold">
              사용자 유형 선택
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  role: "student" as UserRole,
                  title: "재학생 (본전공·복수전공)",
                  desc: "공지 확인, 졸업요건 자가점검, 공유방 참여",
                },
                {
                  role: "alumni" as UserRole,
                  title: "졸업생 (동문 멘토)",
                  desc: "진로 프로필 등록, 후배 멘토링 및 직무 경험 공유",
                },
                {
                  role: "professor" as UserRole,
                  title: "교수진 · 연구실",
                  desc: "학생 면담 요청, 연구·수업 그룹방 개설",
                },
              ].map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => setSelectedRole(item.role)}
                  className={`p-4 rounded-2xl border text-left transition ${
                    selectedRole === item.role
                      ? "bg-orange-50 dark:bg-orange-950/40 border-orange-500 ring-2 ring-orange-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-orange-300"
                  }`}
                >
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={onSignupSubmit} className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">이름</label>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="예: 김동국"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              {selectedRole === "student" ? (
                <div>
                  <label className="block font-bold mb-1">
                    입학 연도 (신입학 재학생 기준)
                  </label>
                  <select
                    value={signupAdmissionYear}
                    onChange={(e) => setSignupAdmissionYear(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
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
                  <label className="block font-bold mb-1">학번 / 졸업연도 / 직함</label>
                  <input
                    type="text"
                    required
                    value={signupStudentId}
                    onChange={(e) => setSignupStudentId(e.target.value)}
                    placeholder="예: 18학번 졸업 / 교육학과 전임교원"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              )}
            </div>

            {/* 재학생 전용 개인별 학사정보 (전공 이수 형태 + 교직 이수 상태 분리 입력) */}
            {selectedRole === "student" && (
              <div className="p-4 rounded-2xl bg-orange-50/60 dark:bg-slate-800/60 border border-orange-200/80 dark:border-slate-700 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-extrabold text-xs sm:text-sm text-orange-950 dark:text-orange-200">
                    동국대학교 교육학과 신입학 학사정보 (졸업요건 자동 적용)
                  </span>
                  <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300">
                    가입 후 [졸업요건 점검] 화면에서 언제든 수정 가능
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold mb-1 text-xs">
                      1. 전공 이수 형태 (단일 / 복수전공)
                    </label>
                    <select
                      value={signupMajorPlanType}
                      onChange={(e) => {
                        const nextPlan = e.target.value as MajorPlanType;
                        setSignupMajorPlanType(nextPlan);
                        if (nextPlan === "single" && signupTeachingStatus === "double_teaching") {
                          setSignupTeachingStatus("educational_major");
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="single">
                        단일전공 (교육학과 전공 66학점)
                      </option>
                      <option value="double_edu">
                        복수전공 — 사범대학 내 타 학과 (주전공 62 + 복수 50학점)
                      </option>
                      <option value="double_general">
                        복수전공 — 일반대학(비사범대) 학과 (주전공 62 + 타 학과 기준)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-xs">
                      2. 교직 이수 관련 상태 (복수전공과 동시 적용 가능)
                    </label>
                    <select
                      value={signupTeachingStatus}
                      onChange={(e) =>
                        setSignupTeachingStatus(e.target.value as TeachingTrackStatus)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="educational_major">
                        주전공 교직 이수 (교육학과 사범대 기본 과정)
                      </option>
                      {signupMajorPlanType !== "single" && (
                        <option value="double_teaching">
                          주전공 + 복수전공 교직 병행 (교직 복수전공)
                        </option>
                      )}
                      <option value="non_teaching">
                        교직 미이수 (일반 학사학위 취득 과정)
                      </option>
                    </select>
                  </div>
                </div>

                {signupMajorPlanType !== "single" && (
                  <div>
                    <label className="block font-bold mb-1 text-xs">
                      복수전공 학과명
                    </label>
                    <input
                      type="text"
                      required
                      value={signupDoubleMajorDept}
                      onChange={(e) => setSignupDoubleMajorDept(e.target.value)}
                      placeholder={
                        signupMajorPlanType === "double_edu"
                          ? "예: 국어교육과, 역사교육과, 수학교육과 등"
                          : "예: 심리학과, 경영학과, 컴퓨터공학과 등"
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={signupIsEnglishTrack}
                    onChange={(e) => setSignupIsEnglishTrack(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>
                    영어트랙 대상자입니다 (체크 시 공통교양·핵심교양 영어트랙 별도 기준 확인 필요 안내 적용)
                  </span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">이메일 (로그인 ID)</label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="예: user@dgu.ac.kr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">비밀번호 (6자리 이상)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="6자리 이상 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">가입 신청 메모 (학과 확인용)</label>
              <textarea
                rows={3}
                value={signupNote}
                onChange={(e) => setSignupNote(e.target.value)}
                placeholder="예: 교육학과 22학번 재학생입니다. 진로 멘토링과 공지 확인을 위해 가입 신청합니다."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="text-xs text-slate-500 hover:underline"
              >
                이미 계정이 있으신가요? 로그인하기
              </button>
              <button
                type="submit"
                disabled={signupLoading}
                className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold transition"
              >
                {signupLoading ? "계정 생성 중..." : "회원가입 완료 및 승인 요청"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. 승인 대기 화면 (실시간 감지 연동) */}
      {activeTab === "pending" && (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {authUserProfile?.approvalStatus === "approved"
              ? "🎉 가입 승인이 완료되었습니다!"
              : "관리자 소속 승인 대기 중입니다"}
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
            {authUserProfile?.approvalStatus === "approved"
              ? "축하합니다! 학과 관리자의 승인이 완료되어 이제 플랫폼의 모든 게시판, 대화창, 멘토링 기능을 정상 이용하실 수 있습니다."
              : "동국대학교 교육학과 폐쇄형 플랫폼의 보안 정책에 따라 관리자의 소속 확인 후 내부 콘텐츠가 열립니다. 관리자가 승인하면 새로고침 없이 화면이 즉시 열립니다."}
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 text-left text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
            <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>내 가입 프로필 상태</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  authUserProfile?.approvalStatus === "approved"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {authUserProfile?.approvalStatus || "pending"}
              </span>
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              - 이름: {authUserProfile?.name || "확인중"}<br />
              - 이메일: {authUserProfile?.email || rawFirebaseUser?.email || "확인중"}<br />
              - 역할: {ROLE_LABELS[authUserProfile?.role || "student"]} ({authUserProfile?.studentIdOrYear})
            </p>
            {authUserProfile?.adminComment && (
              <p className="text-orange-700 dark:text-orange-300 font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                관리자 메시지: {authUserProfile.adminComment}
              </p>
            )}
          </div>

          {/* 최초 관리자 등록 안내 상자 */}
          {authUserProfile?.approvalStatus !== "approved" && (
            <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-left space-y-2">
              <div className="flex items-center gap-1.5 text-orange-800 dark:text-orange-200 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <span>내가 이 시스템의 개설자(관리자)인가요?</span>
              </div>
              <p className="text-[11px] text-orange-700 dark:text-orange-300 leading-relaxed">
                처음 프로젝트를 만든 분은 아래 버튼을 눌러 본인 계정을 <strong>최초 관리자(Admin)</strong>로 즉시 승격시킬 수 있습니다. 관리자가 되면 승인 대기가 풀리고 관리자 콘솔이 활성화됩니다.
              </p>
              {adminClaimFeedback && (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  {adminClaimFeedback}
                </p>
              )}
              <button
                type="button"
                onClick={onClaimAdminSubmit}
                disabled={adminClaimLoading}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
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
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs"
              >
                동국e음 메인 홈으로 입장하기 →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleLogout()}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition"
              >
                로그아웃하고 다른 계정으로 로그인
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. 최초 관리자 안전 등록 화면 */}
      {activeTab === "bootstrap_admin" && (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-orange-600">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              최초 관리자(Admin) 계정 안전 등록 절차
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            새로 만든 Firebase 프로젝트에 최초 관리자가 없는 상태에서, 현재 로그인된 계정을 시스템 최초 관리자로 1회에 한해 안전하게 승격 등록합니다.
          </p>

          <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-xs space-y-1.5">
            <p className="font-bold text-orange-900 dark:text-orange-200">
              보안 원칙:
            </p>
            <p className="text-orange-800 dark:text-orange-300">
              - <code>system/admin_bootstrap</code> 문서에 최초 관리자 UID가 1회 영구 기록됩니다.<br />
              - 한 번 등록된 이후에는 다른 사용자가 임의로 관리자 권한을 가로챌 수 없도록 Firestore 보안 규칙에서 영구 차단됩니다.
            </p>
          </div>

          {adminClaimFeedback && (
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              {adminClaimFeedback}
            </div>
          )}

          {rawFirebaseUser ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                현재 로그인된 계정: <strong>{rawFirebaseUser.email}</strong>
              </p>
              <button
                type="button"
                onClick={onClaimAdminSubmit}
                disabled={adminClaimLoading}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition"
              >
                {adminClaimLoading ? "관리자 등록 처리 중..." : "이 계정을 최초 관리자로 승격 등록하기"}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500 space-y-2">
              <p>최초 관리자로 등록할 계정으로 먼저 로그인해 주세요.</p>
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold"
              >
                로그인하러 가기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. 승인 거절 및 보완 요청 안내 화면 */}
      {activeTab === "rejected_or_supplement" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-300 dark:border-amber-800 p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-black">소속 정보 보완 요청 상태</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              제출하신 가입 신청서에서 학번 또는 교육학과 소속 확인 정보가 부족하여 관리자가 보완을 요청한 상태입니다.
            </p>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs space-y-1">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                관리자 전달 메모:
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                &ldquo;학번(입학연도)과 교육학과 본전공/복수전공 여부가 누락되어 있습니다. 정보를 보완해 주세요.&rdquo;
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <XCircle className="w-6 h-6" />
              <h3 className="text-lg font-black">가입 승인 거절 상태</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              동국대학교 교육학과 구성원 자격이 확인되지 않거나 외부 홍보 목적으로 판단되어 가입 승인이 거절된 상태입니다.
            </p>
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs space-y-1">
              <p className="font-bold text-rose-900 dark:text-rose-200">
                거절 사유:
              </p>
              <p className="text-rose-800 dark:text-rose-300">
                &ldquo;동국대학교 교육학과 구성원(재학생·졸업생·교수진)만 가입할 수 있는 폐쇄형 플랫폼입니다.&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
