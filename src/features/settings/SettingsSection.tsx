import type { ReactNode } from 'react';

export function SettingsSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between text-sm text-content">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="focus-ring h-4 w-4 accent-accent"
      />
    </label>
  );
}
