"use client";

import React from "react";
import {
  Notice,
  NoticeCategory,
  AlumniProfile,
  CommunityRoom,
  GraduationRequirement,
  UserRole,
} from "@/types";
import {
  Pin,
  ExternalLink,
  MessageSquare,
  Users,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Chip,
  ChipGroup,
  EmptyState,
  SearchInput,
  cn,
  type BadgeTone,
  type CalloutTone,
} from "@/components/ui";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "재학생",
  alumni: "졸업생",
  professor: "교수",
  admin: "관리자",
};

/** 역할 배지 색 (Badge tone과 같은 이름). 새 코드에서는 <RoleBadge />를 쓴다. */
export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  student: "bg-role-student-soft text-role-student",
  alumni: "bg-role-alumni-soft text-role-alumni",
  professor: "bg-role-professor-soft text-role-professor",
  admin: "bg-role-admin-soft text-role-admin",
};

/** 역할 이름 배지 (재학생·졸업생·교수·관리자) */
export function RoleBadge({
  role,
  className,
  size,
}: {
  role: UserRole;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <Badge tone={role} size={size} className={className}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/** 공지 분류별 색 */
export const NOTICE_CATEGORY_TONE: Record<NoticeCategory, BadgeTone> = {
  "교육학과 공지": "brand",
  "학교 공지": "neutral",
  "학사 일정": "info",
  "장학 및 지원": "success",
  "교직 관련 안내": "violet",
};

/** 데모·예시 데이터 안내 상자 (페이지 상단) */
export function DemoInfoBanner({
  title,
  description,
  variant = "orange",
}: {
  title: string;
  description: string;
  variant?: "orange" | "blue" | "amber";
}) {
  const tone: CalloutTone = { orange: "brand", blue: "neutral", amber: "warning" }[variant] as CalloutTone;
  return <Callout tone={tone} title={title} description={description} />;
}

export function EmptyStateBox({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        actionLabel && onAction ? (
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

export function SearchAndFilterBar({
  searchQuery,
  onSearchChange,
  placeholder,
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  placeholder: string;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}) {
  return (
    <div className="space-y-3">
      <SearchInput
        value={searchQuery}
        onValueChange={onSearchChange}
        placeholder={placeholder}
        label="검색"
      />
      <ChipGroup label="분류" labelHidden scroll>
        {categories.map((cat) => (
          <Chip
            key={cat}
            selected={selectedCategory === cat}
            onClick={() => onSelectCategory(cat)}
          >
            {cat}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}

export function NoticeCard({
  notice,
  onSelect,
}: {
  notice: Notice;
  onSelect?: (notice: Notice) => void;
}) {
  return (
    <article
      className={cn(
        "group relative rounded-2xl border p-4 transition-[border-color,box-shadow] duration-150 sm:p-5",
        "has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-[var(--focus-ring)]",
        notice.isPinned
          ? "border-accent-line bg-accent-soft/50 hover:border-brand-300 dark:hover:border-brand-800"
          : "border-line bg-surface hover:border-line-strong hover:shadow-raise"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {notice.isPinned && (
          <Badge tone="brand" variant="solid" icon={<Pin />}>
            중요 고정
          </Badge>
        )}
        <Badge tone={NOTICE_CATEGORY_TONE[notice.category] ?? "neutral"} dot>
          {notice.category}
        </Badge>
        <Badge tone="demo">예시 데이터 (실제 공지 아님)</Badge>
        <span className="tabular ml-auto text-xs text-ink-3">{notice.createdAt}</span>
      </div>

      <h3 className="mt-2.5 text-[15px] font-semibold text-ink sm:text-base">
        <button
          type="button"
          onClick={() => onSelect && onSelect(notice)}
          className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none group-hover:text-accent"
        >
          {notice.title}
        </button>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-ink-2">{notice.summary}</p>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-3">
        <span className="truncate">작성: {notice.authorName}</span>
        <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-accent">
          상세 보기 & 공식 출처 <ChevronRight className="size-3.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export function AlumniCard({
  alumni,
  onSelectProfile,
  onRequestChat,
  onRequestMentoring,
}: {
  alumni: AlumniProfile;
  onSelectProfile: (alumni: AlumniProfile) => void;
  onRequestChat: (alumni: AlumniProfile) => void;
  onRequestMentoring: (alumni: AlumniProfile) => void;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-raise sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={alumni.displayName} role="alumni" size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-base font-semibold text-ink">
              <button
                type="button"
                onClick={() => onSelectProfile(alumni)}
                className="text-left underline-offset-4 hover:underline"
              >
                {alumni.displayName}
              </button>
            </h3>
            {alumni.mentoringAvailable ? (
              <Badge tone="success" dot className="shrink-0">
                멘토링 가능
              </Badge>
            ) : (
              <Badge tone="neutral" className="shrink-0">
                일정 조율중
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone="brand">{alumni.careerTrack}</Badge>
            <span className="text-xs text-ink-3">
              {alumni.graduationYear}년 졸업 · 복수전공: {alumni.doubleMajor}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        <p className="flex items-start gap-2 font-medium text-ink">
          <Briefcase className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <span>{alumni.currentRoleTitle}</span>
        </p>
        <p className="flex items-start gap-2 text-[13px] text-ink-3">
          {alumni.privacy.showOrganization ? (
            <>
              <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>소속: {alumni.organization}</span>
            </>
          ) : (
            <>
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>소속 비공개 설정됨 (직무 정보만 공개)</span>
            </>
          )}
        </p>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-ink-2">{alumni.bio}</p>

      {alumni.interests.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="관심 분야">
          {alumni.interests.map((tag) => (
            <li
              key={tag}
              className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2"
            >
              #{tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Button variant="ghost" size="sm" onClick={() => onSelectProfile(alumni)} className="-ml-2">
          상세 프로필
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<MessageSquare />}
            onClick={() => onRequestChat(alumni)}
          >
            대화 요청
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles />}
            onClick={() => onRequestMentoring(alumni)}
          >
            멘토링 신청
          </Button>
        </div>
      </div>
    </article>
  );
}

export function CommunityRoomCard({
  room,
  isJoined,
  postCount,
  onToggleJoin,
  onSelectRoom,
}: {
  room: CommunityRoom;
  isJoined: boolean;
  postCount: number;
  onToggleJoin: (roomId: string) => void;
  onSelectRoom: (roomId: string) => void;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-raise sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={room.type === "career" ? "brand" : "info"}>
          {room.type === "career" ? "진로 트랙 공유방" : "복수전공 공유방"} · {room.categoryName}
        </Badge>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-3">
          <Users className="size-3.5" aria-hidden="true" /> {room.memberIds.length}명 참여
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">{room.name}</h3>
        {isJoined && (
          <Badge tone="success" icon={<CheckCircle2 />}>
            참여중
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{room.description}</p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="text-xs text-ink-3">
          축적된 게시글 <strong className="tabular font-semibold text-ink">{postCount}건</strong>
        </span>
        <div className="flex items-center gap-1.5">
          {isJoined ? (
            <Button variant="ghost" size="sm" onClick={() => onToggleJoin(room.id)}>
              나가기
            </Button>
          ) : (
            <Button variant="soft" size="sm" icon={<Plus />} onClick={() => onToggleJoin(room.id)}>
              참여하기
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => onSelectRoom(room.id)}>
            입장하기
          </Button>
        </div>
      </div>
    </article>
  );
}

export function RequirementProgressCard({
  requirement,
  completedValue,
  userCustomTarget,
  isCompletedBoolean,
  onEdit,
}: {
  requirement: GraduationRequirement;
  completedValue: number;
  userCustomTarget: number | null;
  isCompletedBoolean?: boolean;
  onEdit: () => void;
}) {
  // 중요 원칙 준수: 공식 기준값이 미설정(null)이고 사용자가 직접 입력한 목표값도 없으면 허위 진행률(%)을 계산하지 않음
  const effectiveTarget = userCustomTarget ?? requirement.targetValue;
  const hasValidTarget =
    requirement.unit !== "여부" &&
    effectiveTarget !== null &&
    effectiveTarget > 0;

  const calculatedPercent = hasValidTarget
    ? Math.min(100, Math.round((completedValue / effectiveTarget) * 100))
    : null;

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="brand">{requirement.category}</Badge>
        <Badge tone="neutral">자가점검 기록</Badge>
      </div>

      <h3 className="mt-3 text-base font-semibold text-ink">{requirement.title}</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
        {requirement.applicableCondition}
      </p>

      {requirement.unit === "여부" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-3">
          <span className="text-sm text-ink-2">자가점검 상태</span>
          {isCompletedBoolean ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" /> 이수/충족 완료 표시됨
            </span>
          ) : (
            <span className="text-sm font-semibold text-warning">미완료 (점검 필요)</span>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5 rounded-xl bg-surface-2 px-3.5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-xs text-ink-3">내가 입력한 이수량</span>
            <span className="tabular text-lg font-bold text-ink">
              {completedValue}
              <span className="ml-0.5 text-sm font-semibold text-ink-2">{requirement.unit}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-xs text-ink-3">기준 목표치</span>
            {hasValidTarget ? (
              <span className="text-xs font-semibold text-accent">
                {effectiveTarget} {requirement.unit} (사용자 직접 설정)
              </span>
            ) : (
              <span className="text-xs font-semibold text-warning">
                기준 미설정 (요람 확인 후 직접 입력)
              </span>
            )}
          </div>

          {hasValidTarget && calculatedPercent !== null ? (
            <div className="pt-0.5">
              <div className="mb-1 flex justify-between text-xs font-semibold">
                <span className="text-ink-2">자가점검 달성률</span>
                <span className="tabular text-accent">{calculatedPercent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label={`${requirement.title} 자가점검 달성률`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={calculatedPercent}
                className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
              >
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
                  style={{ width: `${calculatedPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="border-t border-line pt-2 text-xs text-ink-3">
              ※ 공식 기준값이 설정되지 않아 임의 진행률(%)을 표시하지 않습니다.
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <a
          href={requirement.officialGuideUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 text-xs text-ink-3 hover:text-accent"
        >
          <span className="truncate">{requirement.officialGuideLabel}</span>
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
        <Button variant="soft" size="sm" onClick={onEdit} className="shrink-0">
          수치·목표 수정
        </Button>
      </div>
    </article>
  );
}
