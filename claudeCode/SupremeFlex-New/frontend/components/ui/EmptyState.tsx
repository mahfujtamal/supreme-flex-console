import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  heading,
  subtext,
}: {
  icon: LucideIcon;
  heading: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center space-y-3">
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/40" />
      <div>
        <p className="font-medium text-sm">{heading}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </div>
    </div>
  );
}
