"use client";

import React, { useRef } from "react";
import { cn } from "./cn";

export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  /** 라벨 옆 개수 */
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** underline: 페이지 안 화면 전환 / segmented: 작은 보기 전환 */
  variant?: "underline" | "segmented";
  /** 화면 낭독기용 묶음 이름 */
  label: string;
  /** segmented를 가로 꽉 채우기 */
  block?: boolean;
  className?: string;
}

/** 탭 목록. ←/→ 키로 이동할 수 있다. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline",
  label,
  block = false,
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const idx = items.findIndex((it) => it.value === value);
    const next =
      e.key === "ArrowRight" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    onChange(items[next].value);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
    e.preventDefault();
  };

  const isUnderline = variant === "underline";

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        isUnderline
          ? "flex gap-1 overflow-x-auto scrollbar-none border-b border-line"
          : "inline-flex gap-1 rounded-xl border border-line bg-surface-2 p-1",
        !isUnderline && block && "flex w-full",
        className
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150 [&_svg]:size-4 [&_svg]:shrink-0",
              isUnderline
                ? cn("h-11 px-3", active ? "text-ink" : "text-ink-3 hover:text-ink")
                : cn(
                    "h-9 rounded-lg px-3.5",
                    block && "flex-1",
                    active ? "bg-surface text-ink shadow-raise" : "text-ink-2 hover:text-ink"
                  )
            )}
          >
            {it.icon}
            {it.label}
            {typeof it.count === "number" && (
              <span
                className={cn(
                  "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                  active ? "bg-brand-600 text-white" : "bg-surface-3 text-ink-2"
                )}
              >
                {it.count}
              </span>
            )}
            {isUnderline && active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
