import React from "react";
import { cn } from "./cn";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** 칩 오른쪽에 붙는 개수 */
  count?: number;
  size?: "sm" | "md";
}

/** 필터·분류 선택용 토글 칩. 선택 상태는 먹색으로 반전해 오렌지(행동 버튼)와 구분한다. */
export function Chip({
  selected = false,
  count,
  size = "md",
  className,
  type = "button",
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-colors duration-150",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
        selected
          ? "border-ink bg-ink text-ink-inverse"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
        className
      )}
      {...props}
    >
      {children}
      {typeof count === "number" && (
        <span
          className={cn(
            "tabular text-xs",
            selected ? "text-ink-inverse/70" : "text-ink-3"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * 칩 묶음. scroll이면 모바일에서 한 줄 가로 스크롤(줄바꿈 없음),
 * 아니면 여러 줄로 감싼다.
 */
export function ChipGroup({
  label,
  labelHidden = false,
  scroll = false,
  className,
  children,
}: {
  /** 묶음 앞에 붙는 짧은 이름 (예: "진로 분야") — 화면 낭독기에도 쓰인다 */
  label?: string;
  /** 이름을 화면에는 숨기고 화면 낭독기에만 알린다 */
  labelHidden?: boolean;
  scroll?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-center gap-2", scroll ? "min-w-0" : "flex-wrap", className)}
    >
      {label && !labelHidden && (
        <span className="w-16 shrink-0 text-xs font-semibold text-ink-3">{label}</span>
      )}
      <div
        className={cn(
          "flex gap-1.5",
          scroll ? "min-w-0 flex-1 overflow-x-auto scrollbar-none py-0.5" : "flex-wrap"
        )}
      >
        {children}
      </div>
    </div>
  );
}
