"use client"

import { cn, formatNumber } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  /** Numbers go through `format`; strings (ratios, modes) render as-is */
  value: number | string
  format?: (n: number) => string
  icon: LucideIcon
  /** Drawn behind the label and value, filling the tile (a sparkline) */
  background?: React.ReactNode
}

// Tiles sit flush against each other: the 1px gap shows the grid's border colour
// through as a hairline between cells, whatever the column count.
// The strip bleeds through <main>'s padding so it meets the header and sidebar lines.
export function StatGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-4 -mt-4 grid gap-px border-b bg-border sm:grid-cols-2 lg:-mx-6 lg:-mt-6 xl:grid-cols-4",
        className
      )}
      {...props}
    />
  )
}

export function StatCard({ title, value, format = formatNumber, icon: Icon, background }: StatCardProps) {
  return (
    // A single 48px row: icon and label on the left, value pushed right
    <div className="relative flex h-12 items-center gap-2 overflow-hidden bg-card px-4 text-card-foreground">
      {background && <div className="pointer-events-none absolute inset-0">{background}</div>}
      <Icon className="relative h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.5} />
      <p className="relative truncate text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
        {title}
      </p>
      <span className="relative ml-auto shrink-0 text-lg font-semibold tracking-tight font-mono tabular-nums">
        {typeof value === "number" ? format(value) : value}
      </span>
    </div>
  )
}

