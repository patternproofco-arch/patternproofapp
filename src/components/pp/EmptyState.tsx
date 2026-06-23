import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="pp-empty">
      <div className="pp-empty__icon">{icon ?? <Sparkles size={20} />}</div>
      <div className="pp-empty__title">{title}</div>
      {description && <p className="pp-empty__desc">{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}