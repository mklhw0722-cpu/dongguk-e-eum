"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { UserRole } from "@/types";
import { ROLE_LABELS, RoleBadge } from "@/components/common/Cards";
import { Avatar, Button, CountBadge, Modal, cn, useToast } from "@/components/ui";
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
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

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

// 사이드바에서 목적별로 묶어 보여 준다 (모바일 하단 탭은 앞의 6개)
const NAV_GROUPS: { label?: string; hrefs: string[] }[] = [
  { hrefs: ["/"] },
  { label: "소통", hrefs: ["/notices", "/chat", "/rooms", "/alumni"] },
  { label: "학업", hrefs: ["/graduation"] },
  { label: "가입·운영", hrefs: ["/auth", "/admin"] },
];

const ROLES: UserRole[] = ["student", "alumni", "professor", "admin"];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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
  } = useApp();
  const toast = useToast();
  const [isResetOpen, setIsResetOpen] = useState(false);

  // 현재 사용자의 읽지 않은 메시지 총합
  const totalUnreadMessages = conversations.reduce((sum, conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return sum + (member?.unreadCount || 0);
  }, 0);

  const pendingApprovalsCount = approvalRequests.filter(
    (r) => r.status === "pending"
  ).length;

  const badgeFor = (href: string) => {
    if (href === "/chat") return { count: totalUnreadMessages, tone: "brand" as const };
    if (href === "/admin") return { count: pendingApprovalsCount, tone: "warning" as const };
    return null;
  };

  const handleReset = () => {
    resetDemoData();
    setIsResetOpen(false);
    toast({ title: "데모 데이터를 처음 상태로 되돌렸어요", tone: "info" });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only z-[70] rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        본문으로 건너뛰기
      </a>

      {/* 상단 데모 바: 프로토타입 안내 + 역할(미리보기) 전환 */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#111826] text-white">
        <div className="flex h-11 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold">
              <span className="sm:hidden">데모</span>
              <span className="hidden sm:inline">1차 프로토타입 데모</span>
            </span>
            <span className="hidden truncate text-xs text-white/65 lg:inline">
              실제 서버/인증 미연결 상태 · 역할별 UI 미리보기 전환 기능 제공 (실제 권한 인증 아님)
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden text-xs text-white/55 sm:inline">역할 전환</span>

            {/* 데스크톱: 버튼 묶음 */}
            <div
              role="group"
              aria-label="역할 전환 (UI 미리보기)"
              className="hidden items-center gap-0.5 rounded-lg bg-white/8 p-0.5 sm:flex"
            >
              {ROLES.map((r) => {
                const active = currentRole === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={active}
                    onClick={() => switchRole(r)}
                    className={cn(
                      "h-7 rounded-md px-2.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-white text-[#111826]"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                );
              })}
            </div>

            {/* 모바일: 선택 상자 */}
            <label className="relative sm:hidden">
              <span className="sr-only">역할 전환 (UI 미리보기)</span>
              <select
                value={currentRole}
                onChange={(e) => switchRole(e.target.value as UserRole)}
                className="h-8 appearance-none rounded-md bg-white/10 pr-7 pl-2.5 text-[13px] font-semibold text-white focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="text-ink">
                    {ROLE_LABELS[r]} 보기
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-white/70"
              />
            </label>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
              title={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
              className="grid size-8 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsResetOpen(true)}
              title="데모 데이터 초기화"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">초기화</span>
              <span className="sr-only sm:hidden">데모 데이터 초기화</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* PC 사이드바 */}
        <aside className="sticky top-11 hidden h-[calc(100dvh-2.75rem)] w-60 shrink-0 flex-col border-r border-line bg-surface md:flex lg:w-64">
          {/* 텍스트 기반 브랜드 로고 (학교 공식 상표 이미지 미사용 원칙 준수) */}
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
                <p className="truncate text-xs text-ink-3">교육(e)과 사람을 잇는 학과 플랫폼</p>
              </div>
            </Link>
          </div>

          {/* 내비게이션 메뉴 */}
          <nav aria-label="주 메뉴" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi} className={cn(gi > 0 && "mt-5")}>
                {group.label && (
                  <p className="mb-1 px-3 text-xs font-semibold text-ink-3">{group.label}</p>
                )}
                <ul className="space-y-0.5">
                  {group.hrefs.map((href) => {
                    const item = NAV_ITEMS.find((n) => n.href === href)!;
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href);
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
                            className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-ink-3")}
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

          {/* 현재 접속 프로필 (데모) */}
          <div className="border-t border-line p-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={currentUser.name}
                initials={currentUser.avatarInitials}
                role={currentUser.role}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-ink">{currentUser.name}</p>
                  <RoleBadge role={currentUser.role} />
                </div>
                <p className="truncate text-xs text-ink-3">{currentUser.studentIdOrYear}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              동국대학교 교육학과 폐쇄형 커뮤니티 프로토타입 · ※ 모든 데이터는 개발용 가상 데이터입니다.
            </p>
          </div>
        </aside>

        {/* 메인 컨텐츠 영역 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 모바일 상단 브랜드 헤더 */}
          <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 md:hidden">
            <Link href="/" className="flex items-center gap-2">
              <BrandMark size="sm" />
              <BrandWordmark className="text-base" />
              <span className="text-xs text-ink-3">교육학과</span>
            </Link>

            <div className="flex items-center gap-1">
              <Link
                href="/auth"
                aria-current={isActivePath(pathname, "/auth") ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                  isActivePath(pathname, "/auth")
                    ? "bg-accent-soft text-accent"
                    : "text-ink-2 hover:bg-surface-2"
                )}
              >
                가입/인증
              </Link>
              <Link
                href="/admin"
                aria-current={isActivePath(pathname, "/admin") ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                  isActivePath(pathname, "/admin")
                    ? "bg-accent-soft text-accent"
                    : "text-ink-2 hover:bg-surface-2"
                )}
              >
                관리자
                <CountBadge count={pendingApprovalsCount} tone="warning" />
              </Link>
            </div>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-5 pb-28 outline-none sm:px-6 md:pb-14 lg:px-10 lg:pt-8"
          >
            {children}
          </main>
        </div>
      </div>

      {/* 모바일 하단 내비게이션 바 */}
      <nav
        aria-label="주 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-6">
          {NAV_ITEMS.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                    active ? "font-semibold text-accent" : "font-medium text-ink-3"
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-0.5 w-7 rounded-full bg-brand-600"
                    />
                  )}
                  <span className="relative">
                    <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.25 : 1.9} />
                    {item.href === "/chat" && totalUnreadMessages > 0 && (
                      <CountBadge
                        count={totalUnreadMessages}
                        className="absolute -top-1.5 -right-2.5 ring-2 ring-surface"
                      />
                    )}
                  </span>
                  <span className="max-w-full truncate px-0.5">{item.shortLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Modal
        open={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        size="sm"
        title="데모 데이터를 초기화할까요?"
        description="이 브라우저에 저장된 대화·글·졸업요건 기록이 처음 예시 상태로 돌아가요."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsResetOpen(false)}>
              취소
            </Button>
            <Button variant="primary" icon={<RotateCcw />} onClick={handleReset}>
              초기화
            </Button>
          </>
        }
      />
    </div>
  );
}

/** 동국e음 심볼: 'e'(교육)를 둥근 사각형에 담고, 오른쪽 아래 점으로 '이음'을 표시 */
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

function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight text-ink", className)}>
      동국<span className="text-brand-600 dark:text-brand-400">e</span>음
    </span>
  );
}
