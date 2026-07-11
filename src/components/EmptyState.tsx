import { AlertTriangle } from "lucide-react";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <AlertTriangle size={42} />
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
