import { cn } from "@/lib/utils";

/**
 * Surface card used across the dashboard.
 * Client-side interactivity lives in specific components; this stays server-renderable.
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "animate-rise-in rounded-xl border border-zinc-200 bg-surface shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-zinc-900">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
