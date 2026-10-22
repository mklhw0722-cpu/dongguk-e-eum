import React from "react";
import { cn } from "./cn";

type PanelPadding = "none" | "sm" | "md" | "lg";

const PADDING: Record<PanelPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "aside";
  padding?: PanelPadding;
  /** 클릭 가능한 카드일 때 hover 표시 */
  interactive?: boolean;
  /** 바탕 톤: surface(흰 면, 기본) / muted(한 단계 들어간 면) */
  tone?: "surface" | "muted";
}

/**
 * 화면을 나누는 기본 면. 한 화면 안에서 Panel 안에 또 Panel을 넣지 말고,
 * 안쪽 항목은 구분선(divide-y divide-line)이나 tone="muted" 블록으로 나눈다.
 */
export function Panel({
  as: Tag = "div",
  padding = "md",
  interactive = false,
  tone = "surface",
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-line",
        tone === "surface" ? "bg-surface" : "bg-surface-2",
        PADDING[padding],
        interactive &&
          "transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-raise",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 오른쪽(모바일에선 아래)에 놓이는 버튼들 */
  actions?: React.ReactNode;
  /** 제목 위 작은 표시 (배지 등) — 꼭 필요할 때만 */
  meta?: React.ReactNode;
  className?: string;
}

/** 각 페이지 맨 위 제목 영역 */
export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {meta && <div className="flex flex-wrap items-center gap-1.5">{meta}</div>}
        <h1 className="text-2xl font-bold text-ink sm:text-title">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm text-ink-2 sm:text-body">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export interface SectionHeaderProps {
  title: React.ReactNode;
  /** 제목 옆 개수 */
  count?: number;
  description?: React.ReactNode;
  /** 오른쪽 링크/버튼 (예: 전체보기) */
  action?: React.ReactNode;
  /** 제목 앞 아이콘 — 섹션 구분이 꼭 필요할 때만 */
  icon?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}

/** 섹션(패널) 머리 */
export function SectionHeader({
  title,
  count,
  description,
  action,
  icon,
  as: Heading = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading className="flex items-center gap-2 text-base font-bold text-ink sm:text-lg [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-ink-3">
          {icon}
          <span className="min-w-0">{title}</span>
          {typeof count === "number" && (
            <span className="tabular text-sm font-semibold text-ink-3">{count}</span>
          )}
        </Heading>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  );
}
