"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, CircleAlert, X } from "lucide-react";
import { cn } from "./cn";

type ToastTone = "success" | "info" | "warning" | "danger";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** 표시 시간(ms). 기본 3200 */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "description">> {
  id: number;
  description?: string;
}

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

/** 어디서든 const toast = useToast(); toast({ title: "보냈어요" }) 로 짧은 완료 알림을 띄운다. */
export function useToast() {
  return useContext(ToastContext);
}

const TONE: Record<ToastTone, { Icon: React.ElementType; icon: string }> = {
  success: { Icon: CheckCircle2, icon: "text-success" },
  info: { Icon: Info, icon: "text-info" },
  warning: { Icon: AlertTriangle, icon: "text-warning" },
  danger: { Icon: CircleAlert, icon: "text-danger" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    seq.current += 1;
    const item: ToastItem = {
      id: seq.current,
      title: input.title,
      description: input.description,
      tone: input.tone ?? "success",
      duration: input.duration ?? 3200,
    };
    setToasts((prev) => [...prev.slice(-2), item]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { Icon, icon } = TONE[toast.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-pop"
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-ink-2">{toast.description}</p>}
      </div>
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={() => onDismiss(toast.id)}
        className="-mt-0.5 -mr-1 grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
