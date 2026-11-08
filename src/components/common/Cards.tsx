"use client";

import { Badge } from "@/components/ui";

import React from "react";
import Link from "next/link";
import {
  Notice,
  AlumniProfile,
  CommunityRoom,
  GraduationRequirement,
  UserRole,
} from "@/types";
import {
  Pin,
  ExternalLink,
  Calendar,
  MessageSquare,
  Users,
  GraduationCap,
  Briefcase,
  Award,
  Search,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Lock,
  Sparkles,
} from "lucide-react";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "재학생",
  alumni: "졸업생",
  professor: "교수",
  admin: "관리자",
};

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

export function DemoInfoBanner({
  title,
  description,
  variant = "orange",
}: {
  title: string;
  description: string;
  variant?: "orange" | "blue" | "amber";
}) {
  const styles = {
    orange:
      "bg-orange-50/90 border-orange-200 text-orange-950 dark:bg-orange-950/30 dark:border-orange-800/60 dark:text-orange-200",
    blue: "bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200",
    amber:
      "bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200",
  }[variant];

  return (
    <div className={`rounded-xl border p-3.5 text-xs sm:text-sm flex items-start gap-3 ${styles}`}>
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-accent" />
      <div className="space-y-0.5">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-ink-2 leading-relaxed">{description}</p>
      </div>
    </div>
  );
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
    <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      <div className="mx-auto w-11 h-11 rounded-full bg-accent-soft flex items-center justify-center text-accent mb-3">
        <HelpCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-ink mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-ink-3 max-w-md mx-auto">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold transition shadow-raise"
        >
          {actionLabel}
        </button>
      )}
    </div>
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
    <div className="bg-surface rounded-2xl border border-line p-4 space-y-3 shadow-xs">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line bg-surface-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                active
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
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
  const categoryStyles: Record<string, string> = {
    "교육학과 공지": "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200 border border-orange-200 dark:border-orange-800",
    "학교 공지": "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800",
    "학사 일정": "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-200 dark:border-sky-800",
    "장학 및 지원": "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800",
    "교직 관련 안내": "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800",
  };

  const displayCategory = notice.category === "학사 일정" ? "학사공지" : notice.category;
  const isBoilerplateSummary = notice.summary && (notice.summary.includes("공식 공지") || notice.summary.includes("원문 이동"));

  return (
    <article
      onClick={() => onSelect && onSelect(notice)}
      className={`group relative rounded-2xl border p-4 sm:p-4.5 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-md ${
        notice.isPinned
          ? "bg-amber-50/40 dark:bg-amber-950/15 border-amber-300 dark:border-amber-800/80 hover:border-amber-400"
          : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:-translate-y-0.5"
      }`}
    >
      {/* 상단 태그 및 작성일 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {notice.isPinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-600 text-white text-xs font-bold shadow-2xs">
              <Pin className="w-3 h-3" /> 중요
            </span>
          )}
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
              categoryStyles[notice.category] || "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {displayCategory}
          </span>
          {notice.organization && (
            <span className="text-xs text-slate-500 font-medium">
              {notice.organization}
            </span>
          )}
          {notice.isNew && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black tracking-wide">
              NEW
            </span>
          )}
          {notice.subCategoryTag && (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px]">
              #{notice.subCategoryTag}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-medium ml-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{notice.createdAt}</span>
        </div>
      </div>

      {/* 공지 제목 */}
      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
        {notice.title}
      </h3>

      {/* 일정 기간이 감지된 경우 깔끔하게 표시 */}
      {notice.scheduleStatus === "confirmed" && notice.eventStartDate && (
        <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 text-xs font-semibold">
          <Calendar className="w-3 h-3 text-orange-600 shrink-0" />
          <span>
            일정: {notice.eventStartDate}
            {notice.eventEndDate && notice.eventEndDate !== notice.eventStartDate ? ` ~ ${notice.eventEndDate}` : ""}
          </span>
        </div>
      )}

      {/* 요약 내용: 기계적 매크로가 아닌 실제 수동 작성 요약문만 깔끔하게 노출 */}
      {!isBoilerplateSummary && notice.summary && (
        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mt-1.5">
          {notice.summary}
        </p>
      )}

      {/* 하단 푸터 바 */}
      <div className="flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {notice.hasAttachment && (
            <span className="inline-flex items-center gap-1 font-medium text-slate-500 text-xs">
              📎 첨부파일
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={notice.officialUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-medium transition"
          >
            공식 원문 바로가기 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-xs hover:border-orange-300 transition">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-bold flex items-center justify-center text-sm shrink-0">
              {alumni.displayName.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {alumni.displayName}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-xs font-semibold border border-orange-200 dark:border-orange-800/50">
                  {alumni.careerTrack}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {alumni.graduationYear}년 졸업 · 복수전공: {alumni.doubleMajor}
              </p>
            </div>
          </div>
          {alumni.mentoringAvailable ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold shrink-0">
              멘토링 가능
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-medium shrink-0">
              일정 조율중
            </span>
          )}
        </div>

        <div className="space-y-1.5 mb-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
            <Briefcase className="w-4 h-4 text-orange-600 shrink-0" />
            <span>{alumni.currentRoleTitle}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
            <Award className="w-4 h-4 text-slate-400 shrink-0" />
            {alumni.privacy.showOrganization ? (
              <span>소속: {alumni.organization}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Lock className="w-3 h-3" /> 소속 비공개 설정됨 (직무 정보만 공개)
              </span>
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
          {alumni.bio}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {alumni.interests.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onSelectProfile(alumni)}
          className="px-2.5 py-2 rounded-lg border border-line text-xs font-semibold text-ink hover:bg-surface-2 transition"
        >
          상세 프로필
        </button>
        <button
          type="button"
          onClick={() => onRequestMentoring(alumni)}
          className="px-2.5 py-2 rounded-lg bg-accent-soft text-accent hover:bg-brand-100 border border-brand-200/80 text-xs font-semibold transition flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" /> 멘토링 신청
        </button>
      </div>
    </div>
  );
}

export function CommunityRoomCard({
  room,
  postCount,
  latestPostDate,
  onSelectRoom,
}: {
  room: CommunityRoom;
  postCount: number;
  latestPostDate?: string | null;
  onSelectRoom: (roomId: string) => void;
}) {
  return (
    <div
      onClick={() => onSelectRoom(room.id)}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-xs hover:border-orange-300 transition cursor-pointer"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
              room.type === "career"
                ? "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300"
                : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
            }`}
          >
            {room.type === "career" ? "진로 트랙 게시판" : "복수전공 게시판"} ·{" "}
            {room.categoryName}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />{" "}
            {latestPostDate ? `최근 글 ${latestPostDate}` : "등록된 글 없음"}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5">
          {room.name}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
          {room.description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <span className="text-xs text-slate-500">
          게시글 <strong className="text-slate-800 dark:text-slate-200">{postCount}건</strong>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectRoom(room.id);
            }}
            className="px-3.5 py-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong text-xs font-semibold transition shadow-2xs"
          >
            게시판 보기
          </button>
        </div>
      </div>
    </div>
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-xs">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-xs font-semibold">
            {requirement.category}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
            자가점검 기록
          </span>
        </div>

        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
          {requirement.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          {requirement.applicableCondition}
        </p>

        {requirement.unit === "여부" ? (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              자가점검 상태
            </span>
            {isCompletedBoolean ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> 이수/충족 완료 표시됨
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-600">
                미완료 (점검 필요)
              </span>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 mb-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                내가 입력한 이수량
              </span>
              <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {completedValue} {requirement.unit}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                기준 목표치
              </span>
              {hasValidTarget ? (
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                  {effectiveTarget} {requirement.unit} (사용자 직접 설정)
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  기준 미설정 (요람 확인 후 직접 입력)
                </span>
              )}
            </div>

            {hasValidTarget && calculatedPercent !== null ? (
              <div className="pt-1">
                <div className="flex justify-between text-[11px] font-semibold text-orange-600 mb-1">
                  <span>자가점검 달성률</span>
                  <span>{calculatedPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-orange-600 rounded-full transition-all"
                    style={{ width: `${calculatedPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                ※ 공식 기준값이 설정되지 않아 임의 진행률(%)을 표시하지 않습니다.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <a
          href={requirement.officialGuideUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-slate-500 hover:text-orange-600 inline-flex items-center gap-1"
        >
          {requirement.officialGuideLabel} <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 hover:bg-orange-100 text-orange-700 dark:text-orange-300 text-xs font-semibold transition"
        >
          수치·목표 수정
        </button>
      </div>
    </div>
  );
}
