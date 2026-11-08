import React from "react";
import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "student"
  | "alumni"
  | "professor"
  | "admin"
  /** "예시 데이터" 같은 데모 표기 전용 — 점선 테두리로 내용과 구분되게 */
  | "demo";

export type BadgeVariant = "soft" | "solid";

const SOFT: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line",
  brand: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  violet: "bg-role-admin-soft text-role-admin",
  student: "bg-role-student-soft text-role-student",
  alumni: "bg-role-alumni-soft text-role-alumni",
  professor: "bg-role-professor-soft text-role-professor",
  admin: "bg-role-admin-soft text-role-admin",
  demo: "border border-dashed border-warning/50 text-warning",
};

const SOLID: Record<BadgeTone, string> = {
  neutral: "bg-ink text-ink-inverse",
  brand: "bg-accent text-ink-inverse",
  success: "bg-success text-ink-inverse",
  warning: "bg-warning text-ink-inverse",
  danger: "bg-danger text-ink-inverse",
  info: "bg-info text-ink-inverse",
  violet: "bg-role-admin text-ink-inverse",
  student: "bg-role-student text-ink-inverse",
  alumni: "bg-role-alumni text-ink-inverse",
  professor: "bg-role-professor text-ink-inverse",
  admin: "bg-role-admin text-ink-inverse",
  demo: "bg-warning text-ink-inverse",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  /** 앞에 붙는 작은 아이콘 */
  icon?: React.ReactNode;
  /** 앞에 색 점을 찍는다 (분류 표시용) */
  dot?: boolean;
}

export function Badge({
  tone = "neutral",
  variant = "soft",
  size = "sm",
  icon,
  dot,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md font-semibold whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-xs leading-4" : "px-2 py-1 text-xs leading-4",
        "[&_svg]:size-3 [&_svg]:shrink-0",
        variant === "solid" ? SOLID[tone] : SOFT[tone],
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** 읽지 않은 수 같은 숫자 알림 */
export function CountBadge({
  count,
  max = 99,
  className,
  tone = "brand",
}: {
  count: number;
  max?: number;
  className?: string;
  tone?: "brand" | "warning" | "neutral" | "inverse";
}) {
  if (count <= 0) return null;
  const toneClass = {
    brand: "bg-brand-600 text-white",
    warning: "bg-warning text-ink-inverse",
    neutral: "bg-surface-3 text-ink-2",
    inverse: "bg-white text-brand-700",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs leading-none font-bold tabular",
        toneClass,
        className
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
