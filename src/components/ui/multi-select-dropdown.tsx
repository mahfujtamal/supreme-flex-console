import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const ALL_VALUE = "__ALL__";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  disabled?: boolean;
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  allLabel = "ALL",
  disabled = false,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAll = selected.includes(ALL_VALUE);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleAll = () => {
    onChange(isAll ? [] : [ALL_VALUE]);
  };

  const toggleItem = (val: string) => {
    if (isAll) return;
    const next = selected.includes(val)
      ? selected.filter((s) => s !== val)
      : [...selected, val];
    onChange(next);
  };

  const displayText = () => {
    if (isAll) return allLabel;
    if (!selected.length) return placeholder;
    if (selected.length <= 2) {
      return selected
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    return `${selected.length} selected`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected.length && "text-muted-foreground"
        )}
      >
        <span className="truncate text-left flex-1">{displayText()}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto animate-in fade-in-0 zoom-in-95">
          {/* ALL option */}
          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent border-b">
            <Checkbox
              checked={isAll}
              onCheckedChange={toggleAll}
              className="h-3.5 w-3.5"
            />
            <span className="text-sm font-medium">{allLabel}</span>
          </label>

          {options.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-sm",
                isAll && "opacity-40 pointer-events-none"
              )}
            >
              <Checkbox
                checked={isAll || selected.includes(opt.value)}
                onCheckedChange={() => toggleItem(opt.value)}
                disabled={isAll}
                className="h-3.5 w-3.5"
              />
              <span>{opt.label}</span>
            </label>
          ))}

          {!options.length && (
            <p className="text-xs text-muted-foreground px-3 py-2">No options</p>
          )}
        </div>
      )}
    </div>
  );
}

export { ALL_VALUE };
