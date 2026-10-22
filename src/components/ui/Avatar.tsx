import React from "react";
import type { UserRole } from "@/types";
import { cn } from "./cn";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<AvatarSize, string> = {
  xs: "size-7 text-xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
};

const ROLE_TONE: Record<UserRole, string> = {
  student: "bg-role-student-soft text-role-student",
  alumni: "bg-role-alumni-soft text-role-alumni",
  professor: "bg-role-professor-soft text-role-professor",
  admin: "bg-role-admin-soft text-role-admin",
};

export interface AvatarProps {
  /** 이름 (initials가 없으면 앞 두 글자를 쓴다) */
  name: string;
  initials?: string;
  /** 역할에 따라 색이 정해진다. 없으면 회색 */
  role?: UserRole;
  size?: AvatarSize;
  className?: string;
}

/** 사람을 나타내는 원형 이니셜. 사람 = 원, 로고·방 = 둥근 사각형으로 구분한다. */
export function Avatar({ name, initials, role, size = "md", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight select-none",
        role ? ROLE_TONE[role] : "bg-surface-3 text-ink-2",
        SIZES[size],
        className
      )}
    >
      {(initials || name).slice(0, 2)}
    </span>
  );
}

/** 여러 사람을 겹쳐 보여 준다 (단체 대화 등) */
export function AvatarStack({
  people,
  max = 3,
  size = "sm",
  className,
}: {
  people: { name: string; initials?: string; role?: UserRole }[];
  max?: number;
  size?: Extract<AvatarSize, "xs" | "sm" | "md">;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn("inline-flex items-center -space-x-2", className)}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          initials={p.initials}
          role={p.role}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 font-semibold text-ink-2 ring-2 ring-surface",
            SIZES[size]
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
