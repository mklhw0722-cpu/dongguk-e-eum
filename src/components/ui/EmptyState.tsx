import React from "react";
import { Inbox } from "lucide-react";
import { cn } from "./cn";

export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** 다음 행동 버튼 */
  action?: React.ReactNode;
  /** 패널 안쪽처럼 좁은 곳에서 쓸 때 */
  compact?: boolean;
  className?: string;
}

/** 목록이 비었을 때. 무엇을 하면 채워지는지 한 문장으로 안내한다. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact
          ? "rounded-xl bg-surface-2 px-4 py-6"
          : "rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-12",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mb-3 grid place-items-center rounded-full text-ink-3",
          compact ? "size-9 bg-surface [&_svg]:size-4" : "size-12 bg-surface-2 [&_svg]:size-5"
        )}
      >
        {icon ?? <Inbox />}
      </span>
      <p className={cn("font-semibold text-ink", compact ? "text-sm" : "text-base")}>{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-3">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
