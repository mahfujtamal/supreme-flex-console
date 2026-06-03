type Stat = { label: string; value: string | number };

export function PageHero({
  title,
  subtitle,
  stats = [],
}: {
  title: string;
  subtitle?: string;
  stats?: Stat[];
}) {
  return (
    <div className="rounded-2xl bg-primary text-primary-foreground p-5 shadow-sm">
      {subtitle && <p className="text-sm font-medium opacity-80">{subtitle}</p>}
      <h1 className="text-2xl font-bold mt-0.5 tracking-tight">{title}</h1>
      {stats.length > 0 && (
        <div className="mt-4 flex gap-6 flex-wrap">
          {stats.map((s, i) => (
            <div key={i} className="flex gap-6 items-start">
              {i > 0 && <div className="w-px bg-white/20 self-stretch" />}
              <div>
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
