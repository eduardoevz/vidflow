import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-raised/40 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-surface-raised text-accent shadow-sm">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-content">{title}</p>
        {description && <p className="max-w-md text-sm text-content-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
