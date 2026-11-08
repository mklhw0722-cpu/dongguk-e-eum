import React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "./cn";

/** 입력창 공통 모양 */
export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink " +
  "transition-[border-color,box-shadow] duration-150 hover:border-line-strong " +
  "focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70";

export interface FieldProps {
  label: React.ReactNode;
  /** 입력 아래 도움말 */
  hint?: React.ReactNode;
  /** 입력 아래 오류 문구 (hint 대신 표시) */
  error?: React.ReactNode;
  required?: boolean;
  /** 입력 요소가 하나면 label(기본), 버튼·라디오 묶음이면 div */
  as?: "label" | "div";
  className?: string;
  children: React.ReactNode;
}

/** 라벨 + 입력 + 도움말 묶음 */
export function Field({
  label,
  hint,
  error,
  required,
  as: Tag = "label",
  className,
  children,
}: FieldProps) {
  return (
    <Tag className={cn("block space-y-1.5", className)}>
      <span className="block text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : (
        hint && <span className="block text-xs leading-relaxed text-ink-3">{hint}</span>
      )}
    </Tag>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, "h-10", className)} {...props} />;
  }
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputClass, "resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <span className={cn("relative block", className)}>
        <select ref={ref} className={cn(inputClass, "h-10 appearance-none pr-9")} {...props}>
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
        />
      </span>
    );
  }
);

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
}

/** 체크박스 + 라벨 */
export function Checkbox({ label, description, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex items-start gap-2.5 text-sm", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-brand-600"
        {...props}
      />
      <span className="min-w-0">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  );
}

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value" | "size"> {
  value: string;
  onValueChange: (value: string) => void;
  /** 화면에 보이지 않는 라벨 (placeholder와 별개로 필요) */
  label: string;
  size?: "md" | "lg";
}

/** 돋보기 아이콘과 지우기 버튼이 있는 검색창 */
export function SearchInput({
  value,
  onValueChange,
  label,
  size = "md",
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          inputClass,
          size === "lg" ? "h-12 text-[15px]" : "h-10",
          "pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => onValueChange("")}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
