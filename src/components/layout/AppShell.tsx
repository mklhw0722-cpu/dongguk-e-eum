"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { UserRole } from "@/types";
import { ROLE_LABELS } from "@/components/common/Cards";
import { FirebaseSetupModal } from "@/components/common/FirebaseSetupModal";
import {
  Home,
  Megaphone,
  MessageSquare,
  Compass,
  Users,
  CheckSquare,
  ShieldCheck,
  UserCheck,
  Moon,
  Sun,
  RotateCcw,
  Sparkles,
  Database,
  LogOut,
  Clock,
  ShieldAlert,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "홈 대시보드", shortLabel: "홈", icon: Home },
  { href: "/notices", label: "학교·학과 공지", shortLabel: "공지", icon: Megaphone },
  { href: "/chat", label: "대화창 (메신저)", shortLabel: "대화창", icon: MessageSquare },
  { href: "/rooms", label: "진로·복전 공유방", shortLabel: "공유방", icon: Compass },
  { href: "/alumni", label: "졸업생 동문 연결", shortLabel: "졸업생", icon: Users },
  { href: "/graduation", label: "졸업요건 관리", shortLabel: "졸업요건", icon: CheckSquare },
  { href: "/auth", label: "가입·인증 안내", shortLabel: "가입/인증", icon: UserCheck },
  { href: "/admin", label: "관리자 센터", shortLabel: "관리자", icon: ShieldCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currentUser,
    currentRole,
    switchRole,
    isDarkMode,
    toggleDarkMode,
    resetDemoData,
    conversations,
    approvalRequests,
    isFirestoreConnected,
    firebaseProjectId,
    isRealAuthActive,
    authUserProfile,
    isAccessAllowed,
    handleLogout,
  } = useApp();

  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // 현재 사용자의 읽지 않은 메시지 총합
  const totalUnreadMessages = conversations.reduce((sum, conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return sum + (member?.unreadCount || 0);
  }, 0);

  const pendingApprovalsCount = approvalRequests.filter(
    (r) => r.status === "pending"
  ).length;

  const roles: UserRole[] = ["student", "alumni", "professor", "admin"];

  // 미승인 회원 접근 차단 화면 (Auth 페이지는 언제든 조회 가능해야 함)
  const isAuthPage = pathname === "/auth";
  const shouldBlockAccess = isRealAuthActive && !isAccessAllowed && !isAuthPage;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* 상단 바 */}
      <div className="bg-slate-900 text-white px-3 sm:px-6 py-2 text-xs border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsFirebaseModalOpen(true)}
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] inline-flex items-center gap-1.5 transition cursor-pointer ${
                isFirestoreConnected
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-orange-600 hover:bg-orange-500 text-white"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              {isFirestoreConnected
                ? `Firebase DB 연결됨 (${firebaseProjectId})`
                : "Firebase 클라우드 DB 연결 설정"}
            </button>

            {isRealAuthActive && authUserProfile ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <strong>{authUserProfile.name}</strong> ({authUserProfile.email})
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    authUserProfile.approvalStatus === "approved"
                      ? "bg-emerald-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {authUserProfile.approvalStatus === "approved"
                    ? "승인완료"
                    : "승인대기중"}
                </span>
                <button
                  type="button"
                  onClick={() => handleLogout()}
                  className="ml-1 text-slate-400 hover:text-white underline text-[11px] inline-flex items-center gap-0.5"
                >
                  <LogOut className="w-3 h-3" /> 로그아웃
                </button>
              </span>
            ) : (
              <Link
                href="/auth"
                className="text-orange-300 hover:text-orange-200 underline font-semibold text-[11px]"
              >
                [실제 로그인 / 회원가입 하러 가기]
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {!isRealAuthActive && (
              <>
                <span className="text-slate-400 mr-1 text-[11px]">데모 역할 전환:</span>
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => switchRole(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      currentRole === r
                        ? "bg-orange-500 text-white shadow-xs"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </>
            )}

            <button
              type="button"
              onClick={toggleDarkMode}
              title="다크모드 전환"
              className="ml-1 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={resetDemoData}
              title="데모 데이터 초기화"
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 inline-flex items-center gap-1 text-[11px] transition"
            >
              <RotateCcw className="w-3 h-3" /> 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 본문 레이아웃 */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* PC 사이드바 */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sticky top-10 h-[calc(100vh-2.5rem)] justify-between">
          <div className="space-y-6">
            <Link href="/" className="block group">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-xl shadow-xs group-hover:bg-orange-700 transition">
                  e
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                      동국<span className="text-orange-600">e</span>음
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold border border-orange-200 dark:border-orange-800">
                      교육학과
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    교육(e)과 사람을 잇는 학과 플랫폼
                  </p>
                </div>
              </div>
            </Link>

            {/* 현재 접속 프로필 카드 */}
            <div className="p-3.5 rounded-2xl bg-orange-50/70 dark:bg-slate-800/80 border border-orange-200/70 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {currentUser.avatarInitials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {currentUser.name}
                    </p>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-600 text-white">
                      {ROLE_LABELS[currentUser.role]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.studentIdOrYear}
                  </p>
                </div>
              </div>

              {isRealAuthActive && (
                <div className="mt-2 pt-2 border-t border-orange-200/60 dark:border-slate-700 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {authUserProfile?.approvalStatus === "approved"
                      ? "🟢 승인된 정회원"
                      : "🟡 관리자 승인 대기중"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLogout()}
                    className="text-rose-600 hover:underline font-semibold"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>

            {/* 내비게이션 메뉴 */}
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>

                    {item.href === "/chat" && totalUnreadMessages > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isActive
                            ? "bg-white text-orange-600"
                            : "bg-orange-600 text-white"
                        }`}
                      >
                        {totalUnreadMessages}
                      </span>
                    )}

                    {item.href === "/admin" && pendingApprovalsCount > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isActive
                            ? "bg-white text-orange-600"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {pendingApprovalsCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-500 dark:text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" /> 동국e음 (Dongguk e-eum)
            </p>
            <p>동국대학교 교육학과 폐쇄형 커뮤니티</p>
            <p className="text-[10px]">
              {isFirestoreConnected
                ? "🟢 Firebase Auth & Firestore 실시간 보안 연동"
                : "⚪ 로컬 데모 모드 (상단에서 연결 가능)"}
            </p>
          </div>
        </aside>

        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
          {/* 모바일 상단 브랜드 헤더 */}
          <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-black text-base">
                e
              </div>
              <div>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  동국<span className="text-orange-600">e</span>음
                </span>
                <span className="ml-1.5 text-[11px] text-slate-500">교육학과</span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFirebaseModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-orange-600 text-white text-xs font-bold"
              >
                DB연결
              </button>
              <Link
                href="/auth"
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
              >
                로그인
              </Link>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto">
            {shouldBlockAccess ? (
              /* 미승인 회원 접근 차단 가드 (요구사항 5 & 6) */
              <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-3xl border border-amber-300 dark:border-amber-800 p-8 text-center space-y-4 shadow-lg">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  관리자 가입 승인 대기 중입니다
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
                  <strong>{authUserProfile?.name}</strong>님, 계정 가입은 정상 완료되었으나
                  동국대학교 교육학과 폐쇄형 플랫폼 보안 정책에 따라 학과 관리자의 소속 승인 전까지는 내부 콘텐츠 이용이 제한됩니다.
                </p>
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-left text-xs space-y-1.5 border border-amber-200 dark:border-amber-900/50">
                  <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> 승인 처리 상태 안내
                  </p>
                  <p className="text-amber-800 dark:text-amber-300">
                    - 등록 이메일: <strong>{authUserProfile?.email}</strong><br />
                    - 신청 신분: <strong>{ROLE_LABELS[authUserProfile?.role || "student"]}</strong> ({authUserProfile?.studentIdOrYear})<br />
                    - 현재 승인 상태: <strong>승인 대기중 (pending)</strong>
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1 border-t border-amber-200 dark:border-amber-900/60">
                    ※ 관리자가 승인을 완료하면 새로고침 없이도 즉시 플랫폼의 모든 게시판과 대화창이 열립니다.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                  <Link
                    href="/auth"
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                  >
                    👑 내가 관리자라면? 최초 관리자로 즉시 등록하기
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleLogout()}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>

      {/* 모바일 하단 내비게이션 바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 grid grid-cols-6 gap-1">
        {NAV_ITEMS.slice(0, 6).map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-semibold transition relative ${
                isActive
                  ? "text-orange-600"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate">{item.shortLabel}</span>
              {item.href === "/chat" && totalUnreadMessages > 0 && (
                <span className="absolute top-0.5 right-2 w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center">
                  {totalUnreadMessages}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Firebase 설정 및 보안규칙 모달 */}
      <FirebaseSetupModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
      />
    </div>
  );
}
