import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "teal" | "purple" | "outline";

interface StatusBadgeProps {
  tone?: Tone;
  children: ReactNode;
}

const toneClass: Record<Tone, string> = {
  default: "",
  success: "pp-badge-success",
  warning: "pp-badge-warning",
  danger: "pp-badge-danger",
  info: "pp-badge-info",
  teal: "pp-badge-teal",
  purple: "pp-badge-purple",
  outline: "pp-badge-outline",
};

export function StatusBadge({ tone = "default", children }: StatusBadgeProps) {
  return <span className={`pp-badge ${toneClass[tone]}`}>{children}</span>;
}