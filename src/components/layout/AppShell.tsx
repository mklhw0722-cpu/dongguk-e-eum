"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccessGateScreen } from "@/components/layout/AccessGateScreen";
import {
  canAccessAdmin,
  canAccessGraduation,
  classifyRoute,
  resolveRouteView,
} from "@/lib/accessGate";
import { useApp } from "@/context/AppContext";
import { ROLE_LABELS, RoleBadge } from "@/components/common/Cards";
import { FirebaseSetupModal } from "@/components/common/FirebaseSetupModal";
import { getAvatarInitials } from "@/lib/firebase";
import { Avatar, CountBadge, cn } from "@/components/ui";
import {
  Home,
  Megaphone,
  MessageSquare,
  Compass,
  Users,
  CheckSquare,
  ShieldCheck,
  UserCheck,
  LogOut,
  Lock,
  ShieldAlert,
  Loader2,
  type LucideIcon,
} from "lucide-react";

/** 긴 입학년도·학번 문자열을 '00학번' 형태로 간결하게 변환 */
function formatShortHakbun(value?: string | null): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  // 1. 이미 '23학번' 형태가 포함된 경우 (예: '23학번', '23학번 (3학년 재학)')
  const twoDigitHakbun = trimmed.match(/(\d{2})\s*학번/);
  if (twoDigitHakbun) {
    return `${twoDigitHakbun[1]}학번`;
  }

  // 2. '2023학년도', '2023학년도 신입학', '2023학번' 등 4자리 연도가 포함된 경우
  const fourDigitYear = trimmed.match(/(?:20|19)(\d{2})(?:학년도|학번|\s*신입학|\s*편입학)/);
  if (fourDigitYear) {
    return `${fourDigitYear[1]}학번`;
  }

  // 3. 8~10자리 학번 숫자 (예: '2023112345')
  const studentIdNumber = trimmed.match(/^(?:20|19)(\d{2})\d{4,8}$/);
  if (studentIdNumber) {
    return `${studentIdNumber[1]}학번`;
  }

  // 4. 연도 4자리 (예: '2023년', '2023')
  const standaloneYear = trimmed.match(/(?:20|19)(\d{2})/);
  if (standaloneYear) {
    return `${standaloneYear[1]}학번`;
  }

  return trimmed;
}

/** 브랜드 로고 심볼: 'e'와 작은 점(사람·잇다 의미) */
function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center rounded-[10px] bg-brand-600 font-black text-white",
        size === "sm" ? "size-8 text-[17px]" : "size-10 text-xl"
      )}
    >
      <span className="-mt-0.5 leading-none">e</span>
      <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface bg-brand-300" />
    </span>
  );
}

/** 브랜드 워드마크: '동국e음' */
function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-black tracking-tight text-ink", className)}>
      동국<span className="text-brand-600">e</span>음
    </span>
  );
}

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈 대시보드", shortLabel: "홈", icon: Home },
  { href: "/notices", label: "학교·학과 공지", shortLabel: "공지", icon: Megaphone },
  { href: "/chat", label: "대화창 (메신저)", shortLabel: "대화창", icon: MessageSquare },
  { href: "/rooms", label: "진로·복전 공유방", shortLabel: "공유방", icon: Compass },
  { href: "/alumni", label: "졸업생 동문 연결", shortLabel: "졸업생", icon: Users },
  { href: "/graduation", label: "졸업요건 관리", shortLabel: "졸업요건", icon: CheckSquare },
  { href: "/auth", label: "가입·인증 안내", shortLabel: "가입/인증", icon: UserCheck },
  { href: "/admin", label: "관리자 센터", shortLabel: "관리자", icon: ShieldCheck },
];

// 사이드바에서 목적별로 묶어 보여 준다
const NAV_GROUPS: { label?: string; hrefs: string[] }[] = [
  { hrefs: ["/"] },
  { label: "소통", hrefs: ["/notices", "/chat", "/rooms", "/alumni"] },
  { label: "학업", hrefs: ["/graduation"] },
  { label: "가입·운영", hrefs: ["/auth", "/admin"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currentUser,
    conversations,
    approvalRequests,
    rawFirebaseUser,
    authUserProfile,
    isAuthLoading,
    isAccessAllowed,
    accessGate,
    firestoreError,
    handleLogout,
    realUsersForAdmin,
  } = useApp();
  const router = useRouter();

  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // 현재 사용자의 읽지 않은 메시지 총합
  const totalUnreadMessages = conversations.reduce((sum, conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return sum + (member?.unreadCount || 0);
  }, 0);

  const pendingApprovalsCount = (
    realUsersForAdmin && realUsersForAdmin.length > 0
      ? realUsersForAdmin.filter((u) => u.approvalStatus !== "approved")
      : approvalRequests.filter((r) => r.status !== "approved")
  ).length;

  const badgeFor = (href: string) => {
    if (href === "/chat" && totalUnreadMessages > 0) {
      return { count: totalUnreadMessages, tone: "brand" as const };
    }
    if (href === "/admin" && pendingApprovalsCount > 0) {
      return { count: pendingApprovalsCount, tone: "warning" as const };
    }
    return null;
  };

  // 관리자 권한 검증: 승인 완료(approved)이고 역할이 admin인 경우만 관리자 인정
  const isApprovedAdminUser =
    Boolean(rawFirebaseUser) && canAccessAdmin(accessGate, authUserProfile);
  const isGraduationAllowed = canAccessGraduation(authUserProfile || currentUser);

  // 권한 및 로그인 상태에 따른 메뉴 노출 필터링
  // - 로그아웃/미승인 상태: 홈 대시보드~관리자센터 등 내부 메뉴는 전혀 노출되지 않고, 로그인/가입 메뉴만 노출
  // - 승인 회원: 내부 메뉴만 노출되며, 관리자 메뉴는 승인된 관리자만, 졸업요건은 권한 있는 회원만 노출
  const isItemVisible = (href: string) => {
    if (accessGate === "signed_out") return href === "/auth";
    if (!isAccessAllowed) return false;
    if (href === "/auth") return false;
    if (href === "/admin") return isApprovedAdminUser;
    if (href === "/graduation") return isGraduationAllowed;
    return true;
  };

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    hrefs: group.hrefs.filter(isItemVisible),
  })).filter((group) => group.hrefs.length > 0);

  // 경로 정규화: GitHub Pages의 basePath(/dongguk-e-eum), 후행 슬래시(/) 등 대응
  const normalizedPath =
    (pathname || "")
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
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {/* 본문 레이아웃 */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* PC 좌측 사이드바 */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface md:flex lg:w-72 justify-between">
          <div className="flex flex-col min-h-0 flex-1">
            {/* 상단 텍스트 기반 브랜드 로고 */}
            <div className="px-5 pt-5 pb-4">
              <Link href="/" className="group flex items-center gap-2.5 rounded-lg">
                <BrandMark />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <BrandWordmark className="text-lg" />
                    <span className="rounded bg-accent-soft px-1.5 py-px text-xs font-semibold text-accent">
                      교육학과
                    </span>
                  </div>
                  <p className="truncate text-xs text-ink-3">
                    교육(e)과 사람을 잇는 학과 플랫폼
                  </p>
                </div>
              </Link>
            </div>

            {/* 내비게이션 메뉴 (로그인/승인 상태에 맞춰 필터링된 그룹 노출) */}
            <nav aria-label="메인 메뉴" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              {visibleGroups.map((group, gi) => (
                <div key={gi} className={cn(gi > 0 && "mt-5")}>
                  {group.label && visibleGroups.length > 1 && (
                    <p className="mb-1 px-3 text-xs font-semibold text-ink-3">
                      {group.label}
                    </p>
                  )}
                  <ul className="space-y-0.5">
                    {group.hrefs.map((href) => {
                      const item = NAV_ITEMS.find((n) => n.href === href);
                      if (!item) return null;
                      const Icon = item.icon;
                      const active = isItemActive(item.href);
                      const badge = badgeFor(item.href);

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                              active
                                ? "bg-accent-soft font-semibold text-accent"
                                : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                            )}
                          >
                            <Icon
                              aria-hidden="true"
                              className={cn(
                                "size-[18px] shrink-0",
                                active ? "text-accent" : "text-ink-3"
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {badge && <CountBadge count={badge.count} tone={badge.tone} />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          {/* 하단 프로필 카드: 로그아웃 상태에서는 사용자 정보 일체 미표시, 승인 회원만 프로필 표시 */}
          <div className="border-t border-line p-4 bg-surface shrink-0">
            {!isAccessAllowed ? (
              // 로그아웃 또는 승인 대기 상태
              <div>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-2 border border-line text-xs">
                  <Lock className="size-4 text-brand-600 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-2">
                      {accessGate === "signed_out"
                        ? "로그인이 필요합니다"
                        : isAuthLoading
                        ? "계정 확인 중..."
                        : "승인 완료 후 이용 가능"}
                    </p>
                    {rawFirebaseUser && (
                      <p className="truncate text-[11px] text-ink-3">{rawFirebaseUser.email}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-3">동국대학교 교육학과 전용 플랫폼</p>
                  {rawFirebaseUser && (
                    <button
                      type="button"
                      onClick={() => handleLogout()}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                    >
                      <LogOut className="size-3.5" aria-hidden="true" />
                      <span>로그아웃</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // 정상 승인 완료 회원 프로필
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={currentUser.name}
                      initials={
                        getAvatarInitials(currentUser.name, currentUser.role) ||
                        currentUser.avatarInitials
                      }
                      role={currentUser.role}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-ink">
                          {currentUser.name}
                        </p>
                        <RoleBadge role={currentUser.role} />
                      </div>
                      <p className="truncate text-xs text-ink-3">
                        {currentUser.role === "admin"
                          ? "학과 관리자"
                          : currentUser.role === "professor"
                          ? "학과 전임교원"
                          : formatShortHakbun(currentUser.studentIdOrYear) ||
                            currentUser.studentIdOrYear ||
                            currentUser.email ||
                            ""}
                      </p>
                    </div>
                  </div>
                  {/* 명확한 로그아웃 버튼 (텍스트 포함) */}
                  <button
                    type="button"
                    onClick={() => handleLogout()}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <LogOut className="size-3.5" aria-hidden="true" />
                    <span>로그아웃</span>
                  </button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-3">
                  동국대학교 교육학과 전용 플랫폼
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
          {/* 모바일 상단 브랜드 헤더 */}
          <header className="md:hidden bg-surface border-b border-line px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <BrandMark size="sm" />
              <BrandWordmark className="text-base" />
              <span className="text-xs text-ink-3">교육학과</span>
            </Link>

            <div className="flex items-center gap-2">
              {isApprovedAdminUser && (
                <button
                  type="button"
                  onClick={() => setIsFirebaseModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-brand-600 text-white text-xs font-bold shadow-xs hover:bg-brand-700 transition"
                >
                  DB설정
                </button>
              )}
              {!rawFirebaseUser ? (
                <Link
                  href="/auth"
                  className="px-2.5 py-1 rounded-lg bg-surface-2 text-xs font-semibold text-ink hover:bg-surface-3 transition"
                >
                  로그인
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLogout()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  <span>로그아웃</span>
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto">
            {routeView === "content" || routeView === "show_auth_page" ? (
              // 승인 완료 회원의 내부 화면, 또는 비로그인 사용자의 로그인·회원가입 화면
              children
            ) : routeView === "loading" ||
              routeView === "redirect_auth" ||
              routeView === "redirect_home" ? (
              // 로그인·회원 문서 확인 중이거나 다른 화면으로 이동 중
              <div className="max-w-md mx-auto my-20 p-8 bg-surface rounded-3xl border border-line text-center space-y-4 shadow-xs">
                <div className="size-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mx-auto">
                  <Loader2 className="size-7 animate-spin" />
                </div>
                <h2 className="text-lg font-black text-ink">
                  {routeView === "redirect_auth"
                    ? "로그인 화면으로 이동 중..."
                    : routeView === "redirect_home"
                    ? "홈 화면으로 이동 중..."
                    : "동국e음 보안 인증 확인 중..."}
                </h2>
                <p className="text-xs text-ink-3 leading-relaxed">
                  학과 전용 플랫폼 보안 정책에 따라 로그인 여부와 소속 승인 상태를 순서대로 확인하고 있습니다.
                </p>
              </div>
            ) : routeView === "forbidden" ? (
              // 일반 승인 회원이 URL로 /admin 직접 접근 시 403 차단
              <div className="max-w-xl mx-auto my-14 bg-surface rounded-3xl border border-danger/40 p-8 text-center space-y-4 shadow-md">
                <div className="size-16 rounded-2xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
                  <ShieldAlert className="size-8" />
                </div>
                <h2 className="text-xl font-black text-ink">
                  관리자 전용 구역 접근 제한 (403 Forbidden)
                </h2>
                <p className="text-xs sm:text-sm text-ink-2 leading-relaxed max-w-md mx-auto">
                  <strong>{authUserProfile?.name}</strong>님은 현재{" "}
                  <strong>{ROLE_LABELS[authUserProfile?.role || "student"]}</strong> 신분으로 승인되어 있습니다.
                  <br />
                  관리자 센터는 시스템 최고 관리자(Admin) 권한을 부여받은 계정만 접근할 수 있습니다.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2.5">
                  <Link
                    href="/"
                    className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs"
                  >
                    메인 홈 대시보드로 돌아가기 →
                  </Link>
                </div>
              </div>
            ) : (
              // 로그인했지만 승인되지 않은 모든 상태 안내 화면
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
          className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line px-2 py-1.5 grid gap-1 ${
            !isAccessAllowed
              ? "grid-cols-1"
              : isGraduationAllowed
              ? "grid-cols-6"
              : "grid-cols-5"
          }`}
        >
          {(!isAccessAllowed
            ? [{ href: "/auth", shortLabel: "로그인/가입", icon: UserCheck }]
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
                className={cn(
                  "flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-semibold transition relative",
                  isActive ? "text-accent font-bold" : "text-ink-3 hover:text-ink"
                )}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="truncate">{item.shortLabel}</span>
                {item.href === "/chat" && totalUnreadMessages > 0 && (
                  <span className="absolute top-0.5 right-1 min-w-4 h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">
                    {totalUnreadMessages > 99 ? "99+" : totalUnreadMessages}
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
