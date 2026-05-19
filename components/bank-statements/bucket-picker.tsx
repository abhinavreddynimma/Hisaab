"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface BucketPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
  buckets: { id: number; name: string }[];
  /** Name of the bucket that "Auto" will resolve to given the current category. */
  autoResolvesTo?: string | null;
}

function bucketTone(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith("essential")) return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900";
  if (n.startsWith("discretionary")) return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900";
  if (n.startsWith("guilt")) return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900";
  return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
}

export function BucketPicker({ value, onChange, buckets, autoResolvesTo }: BucketPickerProps) {
  if (buckets.length === 0) return null;
  const autoLabel = autoResolvesTo
    ? `Auto · ${autoResolvesTo}`
    : "Auto (by category)";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Bucket override</Label>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          title={autoResolvesTo ? `Selected category maps to ${autoResolvesTo}` : "Pick a category to see which bucket Auto resolves to"}
          className={cn(
            "px-2.5 py-1 text-xs rounded-md border transition-colors inline-flex items-center gap-1",
            value === null
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-muted hover:border-foreground/30"
          )}
        >
          {autoLabel}
        </button>
        {buckets.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onChange(b.id)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md border transition-colors",
              value === b.id ? bucketTone(b.name) + " ring-1 ring-current/30" : "bg-background text-muted-foreground border-muted hover:border-foreground/30"
            )}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
