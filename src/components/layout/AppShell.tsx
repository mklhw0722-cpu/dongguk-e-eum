"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccessGateScreen } from "@/components/layout/AccessGateScreen";
import { canAccessAdmin, canAccessGraduation, classifyRoute, resolveRouteView } from "@/lib/accessGate";
import { useApp } from "@/context/AppContext";
import { UserRole } from "@/types";
import { ROLE_LABELS } from "@/components/common/Cards";
import { FirebaseSetupModal } from "@/components/common/FirebaseSetupModal";
import { DONGGUK_SYMBOL_DATA_URL } from "@/lib/donggukSymbol";
import { formatUnreadBadge } from "@/lib/chatReadReceipts";
import {
  Home,
  Megaphone,
  MessageSquare,
  Compass,
  Users,
  CheckSquare,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  Sparkles,
  Database,
  LogOut,
  Clock,
  ShieldAlert,
  Loader2,
  Lock,
  XCircle,
  FileWarning,
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
    resetDemoData,
    conversations,
    approvalRequests,
    isFirestoreConnected,
    firebaseProjectId,
    rawFirebaseUser,
    isRealAuthActive,
    authUserProfile,
    isAuthLoading,
    isAccessAllowed,
    accessGate,
    firestoreError,
    handleLogout,
  } = useApp();
  const router = useRouter();

  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // 현재 사용자의 읽지 않은 메시지 총합
  const totalUnreadMessages = conversations.reduce((sum, conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return sum + (member?.unreadCount || 0);
  }, 0);

  const pendingApprovalsCount = approvalRequests.filter(
    (r) => r.status === "pending"
  ).length;

  // 관리자 권한 검증: 승인 완료(approved)이고 역할이 admin인 경우만 관리자 인정
  const isApprovedAdminUser = Boolean(rawFirebaseUser) && canAccessAdmin(accessGate, authUserProfile);
  const isGraduationAllowed = canAccessGraduation(authUserProfile || currentUser);

  // 메뉴 노출: 비로그인은 로그인·가입 메뉴만, 미승인은 메뉴 없음, 승인 회원은 내부 메뉴(관리자 메뉴는 관리자만)
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (accessGate === "signed_out") return item.href === "/auth";
    if (!isAccessAllowed) return false;
    if (item.href === "/auth") return false;
    if (item.href === "/admin") return isApprovedAdminUser;
    if (item.href === "/graduation") return isGraduationAllowed;
    return true;
  });

  // 경로 정규화: GitHub Pages의 basePath(/dongguk-e-eum), 후행 슬래시(/) 등 완벽 대응
  const normalizedPath = (pathname || "")
    .replace(/^\/dongguk-e-eum/, "")
    .replace(/\/+$/, "") || "/";

  // 현재 주소 종류(로그인 화면 / 관리자 화면 / 내부 화면)와 사용자 상태로 표시할 화면 결정
  const routeKind = classifyRoute(pathname);
  const routeView = resolveRouteView(accessGate, routeKind, isApprovedAdminUser);

  // 비로그인 사용자가 내부 주소로 직접 들어오면 로그인 화면으로, 승인 회원이 로그인 화면에 오면 홈으로 이동
  useEffect(() => {
    if (routeView === "redirect_auth") {
      router.replace("/auth");
    } else if (routeView === "redirect_home") {
      router.replace("/");
    }
  }, [routeView, router]);

  const isItemActive = (href: string) => {
    const itemNorm = href.replace(/\/+$/, "") || "/";
    if (itemNorm === "/") {
      return normalizedPath === "/";
    }
    return normalizedPath === itemNorm || normalizedPath.startsWith(itemNorm + "/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* 상단 바 */}
      <div className="bg-slate-900 text-white px-3 sm:px-6 py-2 text-xs border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 학과 공식 클라우드 DB 연결 상태 표시 (관리자만 클릭 시 상세 모달 열림) */}
            <button
              type="button"
              onClick={() => {
                if (isApprovedAdminUser) {
                  setIsFirebaseModalOpen(true);
                }
              }}
              title={isApprovedAdminUser ? "클릭 시 관리자 Firebase 연동 설정 열기" : "동국대학교 교육학과 공식 클라우드 DB와 실시간 연결되어 있습니다."}
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] inline-flex items-center gap-1.5 transition ${
                isApprovedAdminUser ? "cursor-pointer hover:opacity-90" : "cursor-default"
              } ${
                isFirestoreConnected
                  ? "bg-emerald-600 text-white"
                  : "bg-orange-600 text-white"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              {isFirestoreConnected
                ? `동국e음 클라우드 DB 정상 연결 (${firebaseProjectId})`
                : "동국e음 클라우드 DB 연결 준비중"}
            </button>

            {rawFirebaseUser && authUserProfile ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <strong>{authUserProfile.name}</strong> ({authUserProfile.email})
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-700 text-slate-200">
                  {ROLE_LABELS[authUserProfile.role]}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    authUserProfile.approvalStatus === "approved"
                      ? "bg-emerald-500 text-white"
                      : authUserProfile.approvalStatus === "rejected"
                      ? "bg-rose-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {authUserProfile.approvalStatus === "approved"
                    ? "승인완료"
                    : authUserProfile.approvalStatus === "rejected"
                    ? "가입반려"
                    : authUserProfile.approvalStatus === "supplement_requested"
                    ? "보완요청"
                    : authUserProfile.approvalStatus === "suspended"
                    ? "이용정지"
                    : authUserProfile.approvalStatus === "pending"
                    ? "승인대기중"
                    : "상태확인필요"}
                </span>
                <button
                  type="button"
                  onClick={() => handleLogout()}
                  className="ml-1 text-slate-400 hover:text-white underline text-[11px] inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" /> 로그아웃
                </button>
              </span>
            ) : rawFirebaseUser ? (
              <button
                type="button"
                onClick={() => handleLogout()}
                className="text-slate-300 hover:text-white underline text-[11px] inline-flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3 h-3" /> {rawFirebaseUser.email} 로그아웃
              </button>
            ) : (
              <Link
                href="/auth"
                className="text-orange-300 hover:text-orange-200 underline font-semibold text-[11px] inline-flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                [로그인 / 회원가입 하러 가기]
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
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
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 p-1 flex items-center justify-center shadow-xs group-hover:border-orange-400 group-hover:shadow-sm transition shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DONGGUK_SYMBOL_DATA_URL}
                    alt="동국대학교 심볼"
                    className="w-full h-full object-contain"
                  />
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

            {/* 현재 접속 프로필 카드 (승인 회원만 표시, 그 외에는 데모 사용자 정보가 보이지 않도록 안내만 표시) */}
            {!isAccessAllowed ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-600" />
                  {accessGate === "signed_out"
                    ? "로그인이 필요합니다"
                    : isAuthLoading
                    ? "계정 확인 중..."
                    : "승인 완료 후 이용 가능"}
                </p>
                {rawFirebaseUser && (
                  <p className="truncate text-[11px] text-slate-500">{rawFirebaseUser.email}</p>
                )}
              </div>
            ) : (
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
            )}

            {/* 내비게이션 메뉴 */}
            <nav className="space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.href);

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
                        {formatUnreadBadge(totalUnreadMessages)}
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
            <p>동국대학교 교육학과 전용 플랫폼</p>
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
              <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200/80 p-0.5 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={DONGGUK_SYMBOL_DATA_URL}
                  alt="동국대학교 심볼"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  동국<span className="text-orange-600">e</span>음
                </span>
                <span className="ml-1.5 text-[11px] text-slate-500">교육학과</span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {isApprovedAdminUser && (
                <button
                  type="button"
                  onClick={() => setIsFirebaseModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-orange-600 text-white text-xs font-bold"
                >
                  DB연결
                </button>
              )}
              {!rawFirebaseUser ? (
                <Link
                  href="/auth"
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                >
                  로그인
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLogout()}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                >
                  로그아웃
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto">
            {routeView === "content" || routeView === "show_auth_page" ? (
              // 승인 완료 회원의 내부 화면, 또는 비로그인 사용자의 로그인·회원가입 화면
              children
            ) : routeView === "loading" || routeView === "redirect_auth" || routeView === "redirect_home" ? (
              // 로그인·회원 문서 확인 중이거나 다른 화면으로 이동 중: 내부 콘텐츠를 절대 노출하지 않음
              <div className="max-w-md mx-auto my-20 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center mx-auto">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {routeView === "redirect_auth"
                    ? "로그인 화면으로 이동 중..."
                    : routeView === "redirect_home"
                    ? "홈 화면으로 이동 중..."
                    : "동국e음 보안 인증 확인 중..."}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  학과 전용 플랫폼 보안 정책에 따라 로그인 여부와 소속 승인 상태를 순서대로 확인하고 있습니다.
                </p>
              </div>
            ) : routeView === "forbidden" ? (
              // 일반 승인 회원이 URL로 /admin 직접 접근 시 403 차단
              <div className="max-w-xl mx-auto my-14 bg-white dark:bg-slate-900 rounded-3xl border border-rose-300 dark:border-rose-900/60 p-8 text-center space-y-4 shadow-lg">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  관리자 전용 구역 접근 제한 (403 Forbidden)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
                  <strong>{authUserProfile?.name}</strong>님은 현재 <strong>{ROLE_LABELS[authUserProfile?.role || "student"]}</strong> 신분으로 승인되어 있습니다.<br />
                  관리자 센터는 시스템 최고 관리자(Admin) 권한을 부여받은 계정만 접근할 수 있습니다.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2.5">
                  <Link
                    href="/"
                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
                  >
                    메인 홈 대시보드로 돌아가기 →
                  </Link>
                </div>
              </div>
            ) : (
              // 로그인했지만 승인되지 않은 모든 상태: 어떤 주소로 들어와도 상태별 안내 화면만 표시
              <AccessGateScreen
                state={accessGate}
                name={authUserProfile?.name || rawFirebaseUser?.email || "회원"}
                email={authUserProfile?.email || rawFirebaseUser?.email || ""}
                roleLabel={ROLE_LABELS[authUserProfile?.role || "student"]}
                studentIdOrYear={authUserProfile?.studentIdOrYear}
                adminComment={authUserProfile?.adminComment}
                errorMessage={firestoreError}
                onLogout={() => handleLogout()}
              />
            )}
          </main>
        </div>
      </div>

      {/* 모바일 하단 내비게이션 바 */}
      {(isAccessAllowed || accessGate === "signed_out") && (
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 grid gap-1 ${
          !isAccessAllowed ? "grid-cols-1" : isGraduationAllowed ? "grid-cols-6" : "grid-cols-5"
        }`}
      >
        {(!isAccessAllowed
          ? [
              { href: "/auth", shortLabel: "로그인/가입", icon: UserCheck },
            ]
          : [
              { href: "/", shortLabel: "홈", icon: Home },
              { href: "/notices", shortLabel: "공지", icon: Megaphone },
              { href: "/chat", shortLabel: "대화창", icon: MessageSquare },
              { href: "/rooms", shortLabel: "공유방", icon: Compass },
              ...(isGraduationAllowed
                ? [{ href: "/graduation", shortLabel: "졸업요건", icon: CheckSquare }]
                : []),
              isApprovedAdminUser
                ? { href: "/admin", shortLabel: "관리자", icon: ShieldCheck }
                : { href: "/alumni", shortLabel: "졸업생", icon: Users },
            ]
        ).map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-semibold transition relative ${
                isActive
                  ? "text-orange-600 font-bold"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate">{item.shortLabel}</span>
              {item.href === "/chat" && totalUnreadMessages > 0 && (
                <span className="absolute top-0.5 right-1 min-w-4 h-4 px-1 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center">
                  {formatUnreadBadge(totalUnreadMessages)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      )}

      {/* Firebase 설정 및 보안규칙 모달 */}
      <FirebaseSetupModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
      />
    </div>
  );
}
