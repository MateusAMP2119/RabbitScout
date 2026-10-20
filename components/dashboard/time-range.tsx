"use client"

import { cn } from "@/lib/utils"

/**
 * Chart time ranges. Sample increments follow the broker's default
 * retention policies (global: 5s ≤ 10m, 60s ≤ 1h, 600s ≤ ~8h, 1800s ≤ 24h),
 * so every range asks only for data the broker actually retains.
 */
export const TIME_RANGES = [
  { key: "live", label: "Live", age: 0, incr: 0 },
  { key: "10m", label: "10m", age: 600, incr: 5 },
  { key: "1h", label: "1h", age: 3600, incr: 60 },
  { key: "8h", label: "8h", age: 28800, incr: 600 },
  { key: "24h", label: "24h", age: 86400, incr: 1800 },
] as const

export type TimeRangeKey = (typeof TIME_RANGES)[number]["key"]

// Flush cells filling a 48px toolbar row, each closed off by a hairline
export function TimeRangeSelect({
  value,
  onChange,
}: {
  value: TimeRangeKey
  onChange: (key: TimeRangeKey) => void
}) {
  return (
    <div className="flex divide-x border-r">
      {TIME_RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            "min-w-14 px-4 text-xs font-medium transition-colors duration-(--duration-fast)",
            value === r.key
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
