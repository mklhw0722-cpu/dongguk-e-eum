import React from "react";
import { AlertTriangle, Info, CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "./cn";

export type CalloutTone = "neutral" | "brand" | "info" | "warning" | "success" | "danger";

const TONE: Record<CalloutTone, { box: string; icon: string; Icon: React.ElementType }> = {
  neutral: { box: "bg-surface-2 border-line", icon: "text-ink-3", Icon: Info },
  brand: { box: "bg-accent-soft border-accent-line", icon: "text-accent", Icon: Info },
  info: { box: "bg-info-soft border-info/20", icon: "text-info", Icon: Info },
  warning: { box: "bg-warning-soft border-warning/25", icon: "text-warning", Icon: AlertTriangle },
  success: { box: "bg-success-soft border-success/20", icon: "text-success", Icon: CheckCircle2 },
  danger: { box: "bg-danger-soft border-danger/25", icon: "text-danger", Icon: CircleAlert },
};

export interface CalloutProps {
  tone?: CalloutTone;
  title?: React.ReactNode;
  /** 짧은 설명. 목록 등 복잡한 내용은 children으로 */
  description?: React.ReactNode;
  /** 기본 아이콘 대신 쓸 아이콘. false면 아이콘 없음 */
  icon?: React.ReactNode | false;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** 안내·주의 문구 상자. 페이지마다 1개 이하로, 본문보다 조용하게 쓴다. */
export function Callout({
  tone = "neutral",
  title,
  description,
  icon,
  action,
  className,
  children,
}: CalloutProps) {
  const t = TONE[tone];
  const Icon = t.Icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        t.box,
        className
      )}
    >
      {icon !== false && (
        <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", t.icon)} aria-hidden="true">
          {icon ?? <Icon />}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {description && <p className="leading-relaxed text-ink-2">{description}</p>}
        {children && <div className="leading-relaxed text-ink-2">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
