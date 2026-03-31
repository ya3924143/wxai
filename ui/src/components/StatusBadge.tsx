interface StatusBadgeProps {
  readonly variant: "online" | "offline" | "expired" | "enabled" | "disabled";
  readonly label?: string;
}

const STYLES: Record<StatusBadgeProps["variant"], string> = {
  online: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  offline: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  enabled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  disabled: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
};

const DEFAULT_LABELS: Record<StatusBadgeProps["variant"], string> = {
  online: "在线",
  offline: "离线",
  expired: "过期",
  enabled: "已启用",
  disabled: "已禁用",
};

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STYLES[variant]}`}>
      {label ?? DEFAULT_LABELS[variant]}
    </span>
  );
}
