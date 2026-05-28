import { Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatusBanner({ tone, message }: { tone: "error" | "success" | "info"; message: string }) {
  return (
    <div className={`status-banner ${tone}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{message}</span>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function FullScreenState({ title, message }: { title: string; message: string }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel compact">
        <Sparkles size={28} />
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const boundedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="progress-wrap" aria-label={label ?? `Progress ${boundedValue}%`}>
      <div className="progress-track">
        <span style={{ width: `${boundedValue}%` }} />
      </div>
      <strong>{boundedValue}%</strong>
    </div>
  );
}
