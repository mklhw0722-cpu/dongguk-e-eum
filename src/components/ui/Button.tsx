import React from "react";
import { cn } from "./cn";

export type ButtonVariant =
  | "primary" // 화면의 핵심 행동 1개 (브랜드 오렌지)
  | "dark" // 강한 보조 행동 (먹색)
  | "secondary" // 일반 보조 행동 (흰 바탕 + 테두리)
  | "soft" // 브랜드 톤의 가벼운 행동 (참여하기 등)
  | "ghost" // 툴바·카드 안의 약한 행동
  | "success"
  | "warning"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-raise hover:bg-brand-700 active:bg-brand-800",
  dark: "bg-ink text-ink-inverse hover:bg-ink/85 active:bg-ink/75",
  secondary:
    "border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2 active:bg-surface-3",
  soft: "bg-accent-soft text-accent hover:bg-brand-100 dark:hover:bg-brand-950 active:bg-brand-200 dark:active:bg-brand-900",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-3",
  success:
    "bg-success-soft text-success hover:bg-success hover:text-ink-inverse active:opacity-90",
  warning:
    "bg-warning-soft text-warning hover:bg-warning hover:text-ink-inverse active:opacity-90",
  danger:
    "bg-danger-soft text-danger hover:bg-danger hover:text-ink-inverse active:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
  md: "h-10 px-4 text-sm [&_svg]:size-4",
  lg: "h-12 px-5 text-[15px] [&_svg]:size-[18px]",
};

/** Link(<a>)를 버튼처럼 보이게 할 때 쓴다. 예: <Link className={buttonClass("secondary")} /> */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], "[&_svg]:shrink-0", className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 버튼 앞에 붙는 아이콘 (lucide 아이콘 엘리먼트) */
  icon?: React.ReactNode;
  /** 가로 꽉 채우기 */
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, block, className, type = "button", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, cn(block && "w-full", className))}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** 화면 낭독기와 툴팁에 쓰이는 이름 (필수) */
  label: string;
  variant?: Extract<ButtonVariant, "ghost" | "secondary" | "soft" | "dark">;
  size?: "sm" | "md";
  children: React.ReactNode;
}

/** 아이콘만 있는 버튼. label은 aria-label과 title로 들어간다. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, variant = "ghost", size = "md", className, type = "button", children, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          BASE,
          VARIANTS[variant],
          size === "sm" ? "size-8 [&_svg]:size-4" : "size-10 [&_svg]:size-[18px]",
          "px-0 [&_svg]:shrink-0",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

/** 문장 안이나 섹션 머리의 텍스트 링크 */
export const textLinkClass =
  "inline-flex items-center gap-1 text-sm font-semibold text-accent underline-offset-4 hover:underline [&_svg]:size-4";
