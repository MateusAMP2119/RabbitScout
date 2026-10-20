"use client"

import { useMemo, useState } from "react"
import { Inbox, Rows3, Network, MemoryStick, Gauge, HardDrive, Files, Cpu, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { StatCard, StatGrid } from "@/components/dashboard/stat-card"
import { ChartLegend } from "@cloudflare/kumo/components/chart"
import { Sparkline, TimeSeriesChart, useSeriesColors, type ColumnarData } from "@/components/dashboard/line-chart"
import { DistributionDonut } from "@/components/dashboard/distribution-donut"
import { TimeRangeSelect, TIME_RANGES, type TimeRangeKey } from "@/components/dashboard/time-range"
import { ErrorCard } from "@/components/shared/error-card"
import { usePolling } from "@/hooks/use-polling"
import { useLiveSeries, WINDOW_SEC } from "@/hooks/use-live-series"
import { ratesFromSamples, gaugeFromSamples, pickBaseAxis, alignToAxis } from "@/lib/chart-data"
import { cn, formatBytes, formatNumber, formatRate } from "@/lib/utils"
import type { Overview, Queue, NodeStats } from "@/lib/rabbitmq/types"
import type { HistoryColumn, MetricsHistory } from "@/lib/metrics/history"

const RATE_LABELS = ["Publish", "Deliver"]
const QUEUED_LABELS = ["Total", "Ready", "Unacked"]

// ── Main page ──────────────────────────────────────────────────

export default function OverviewPage() {
  const [range, setRange] = useState<TimeRangeKey>("live")
  const rangeDef = TIME_RANGES.find((r) => r.key === range)!
  const isLive = range === "live"

  const overviewUrl = isLive
    ? "/api/rabbitmq/overview"
    : `/api/rabbitmq/overview?lengths_age=${rangeDef.age}&lengths_incr=${rangeDef.incr}&msg_rates_age=${rangeDef.age}&msg_rates_incr=${rangeDef.incr}`

  const { data: overview, error, loading, lastUpdated } = usePolling<Overview>(overviewUrl)
  const { data: queues } = usePolling<Queue[]>("/api/rabbitmq/queues")
  const { data: nodeStats } = usePolling<NodeStats | null>(
    overview?.node ? `/api/rabbitmq/nodes/${encodeURIComponent(overview.node)}` : null,
  )

  // Sparklines behind the stat tiles: the recorded history over the chart's range
  const { data: history } = usePolling<MetricsHistory>(`/api/metrics?seconds=${isLive ? WINDOW_SEC : rangeDef.age}`)
  const spark = (column: HistoryColumn) =>
    history && history.ts.length > 0 ? (
      <Sparkline from={history.from} to={history.to} ts={history.ts} values={history.series[column]} height={48} />
    ) : undefined

  // Live mode: accumulate a rolling client-side window
  const live = useLiveSeries(isLive ? overview : null, lastUpdated)

  // Historical mode: derive series from broker-retained samples.
  // The x-axis is the richest available series, so one missing series
  // never blanks the whole chart.
  const historical = useMemo(() => {
    if (isLive || !overview) return null
    const publish = ratesFromSamples(overview.message_stats?.publish_details)
    const deliver = ratesFromSamples(overview.message_stats?.deliver_get_details)
    const totals = gaugeFromSamples(overview.queue_totals?.messages_details)
    const ready = gaugeFromSamples(overview.queue_totals?.messages_ready_details)
    const unacked = gaugeFromSamples(overview.queue_totals?.messages_unacknowledged_details)

    const rateBase = pickBaseAxis(publish, deliver)
    const rateData: ColumnarData = [
      rateBase,
      alignToAxis(rateBase, publish),
      alignToAxis(rateBase, deliver),
    ]
    const queuedBase = pickBaseAxis(totals, ready, unacked)
    const queuedData: ColumnarData = [
      queuedBase,
      alignToAxis(queuedBase, totals),
      alignToAxis(queuedBase, ready),
      alignToAxis(queuedBase, unacked),
    ]
    return { rateData, queuedData }
  }, [isLive, overview])

  const rateData: ColumnarData = isLive
    ? [live.timestamps, live.publishRates, live.deliveryRates]
    : historical?.rateData ?? [[], [], []]
  const queuedData: ColumnarData = isLive
    ? [live.timestamps, live.totalMessages, live.readyMessages, live.unackedMessages]
    : historical?.queuedData ?? [[], [], [], []]

  // Kumo's categorical palette; the header legends reuse the same colours
  const colors = useSeriesColors(QUEUED_LABELS.length)
  const rateSeries = useMemo(() => RATE_LABELS.map((label, i) => ({ label, color: colors[i] })), [colors])
  const queuedSeries = useMemo(() => QUEUED_LABELS.map((label, i) => ({ label, color: colors[i] })), [colors])

  const queueDist = useMemo(() => {
    if (!queues) return []
    const sorted = [...queues].sort((a, b) => b.messages - a.messages)
    // Qualify names with vhost so same-named queues in different vhosts
    // stay distinct segments.
    const label = (q: Queue) => (q.vhost === "/" ? q.name : `${q.vhost}/${q.name}`)
    const top = sorted.slice(0, 6).map((q) => ({
      id: `${q.vhost}|${q.name}`,
      name: label(q),
      value: q.messages,
    }))
    if (sorted.length > 6) {
      top.push({
        id: "__others__",
        name: "Others",
        value: sorted.slice(6).reduce((s, q) => s + q.messages, 0),
      })
    }
    return top
  }, [queues])

  if (error && !overview) {
    return <ErrorCard message={error} type="CONNECTION" />
  }
  if (loading && !overview) return <OverviewSkeleton />

  const ov = overview!
  const publishRate = ov.message_stats?.publish_details?.rate ?? 0
  const deliveryRate = ov.message_stats?.deliver_get_details?.rate ?? 0
  const hasAlarm = nodeStats?.mem_alarm || nodeStats?.disk_free_alarm

  return (
    <div className="space-y-5">
      {/* Stat strip, range toolbar and the graphs stack flush */}
      <div>
        {/* ── Stat cards ── */}
        <StatGrid>
          <StatCard
            title="Total Messages"
            value={ov.queue_totals?.messages ?? 0}
            icon={Inbox}
            background={spark("messages")}
          />
          <StatCard
            title="Memory"
            value={nodeStats?.mem_used ?? 0}
            format={(n) => formatBytes(n)}
            icon={MemoryStick}
            background={spark("mem_used")}
          />
          <StatCard
            title="Queues"
            value={ov.object_totals?.queues ?? 0}
            icon={Rows3}
            background={spark("queues")}
          />
          <StatCard
            title="Connections"
            value={ov.object_totals?.connections ?? 0}
            icon={Network}
            background={spark("connections")}
          />

          {/* ── Cluster details ── */}
          <StatCard title="Rates mode" value={ov.rates_mode || "—"} icon={Gauge} />
          {nodeStats && (
            <>
              <StatCard
                title="Disk free"
                value={nodeStats.disk_free ?? 0}
                format={(n) => formatBytes(n)}
                icon={HardDrive}
                background={spark("disk_free")}
              />
              <StatCard
                title="File descriptors"
                value={`${formatNumber(nodeStats.fd_used ?? 0)} / ${formatNumber(nodeStats.fd_total ?? 0)}`}
                icon={Files}
                background={spark("fd_used")}
              />
              <StatCard
                title="Erlang"
                value={`${formatNumber(nodeStats.proc_used ?? 0)} / ${formatNumber(nodeStats.proc_total ?? 0)}`}
                icon={Cpu}
                background={spark("proc_used")}
              />
            </>
          )}
        </StatGrid>

        <Band className="xl:grid-cols-3">
          {/* ── Range control ── */}
          <div className="flex h-12 items-stretch bg-card xl:col-span-3">
            <TimeRangeSelect value={range} onChange={setRange} />
            <div className="ml-auto flex items-center gap-4 px-4 text-[11px] text-muted-foreground">
              {isLive && (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  Live
                </span>
              )}
              {hasAlarm && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {nodeStats?.mem_alarm ? "Memory alarm" : "Disk alarm"}
                </Badge>
              )}
            </div>
          </div>

          {/* Each panel is nine 48px rows: title, legend, then a seven-row (336px) chart */}

          {/* ── Message rates ── */}
          <section className="bg-card">
            <BandHeader title="Message Rates" />
            <BandLegend>
              <ChartLegend.SmallItem name="Publish" color={colors[0]} value={formatRate(publishRate)} />
              <ChartLegend.SmallItem name="Deliver" color={colors[1]} value={formatRate(deliveryRate)} />
            </BandLegend>
            <TimeSeriesChart
              data={rateData}
              series={rateSeries}
              yAxisFormat={(v) => `${Math.round(v)}/s`}
              height={336}
            />
          </section>

          {/* ── Queued messages ── */}
          <section className="bg-card">
            <BandHeader title="Queued Messages" />
            <BandLegend>
              <ChartLegend.SmallItem name="Total" color={colors[0]} value={formatNumber(ov.queue_totals?.messages ?? 0)} />
              <ChartLegend.SmallItem name="Ready" color={colors[1]} value={formatNumber(ov.queue_totals?.messages_ready ?? 0)} />
              <ChartLegend.SmallItem
                name="Unacked"
                color={colors[2]}
                value={formatNumber(ov.queue_totals?.messages_unacknowledged ?? 0)}
              />
            </BandLegend>
            <TimeSeriesChart
              data={queuedData}
              series={queuedSeries}
              yAxisFormat={(v) => v.toLocaleString()}
              height={336}
            />
          </section>

          {/* ── Queue distribution: the donut carries its own legend, so it takes all eight rows ── */}
          <section className="bg-card">
            <BandHeader title="Queue Distribution" />
            <div className="h-96 p-4">
              <DistributionDonut data={queueDist} />
            </div>
          </section>
        </Band>
      </div>
    </div>
  )
}

// ── Helper components ──────────────────────────────────────────

// Continues the stat strip below it: bleeds through <main>'s side padding, and the
// 1px gap over a border-coloured background draws the hairlines between rows.
function Band({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("-mx-4 grid gap-px border-b bg-border lg:-mx-6", className)} {...props} />
}

// One 48px row, labelled like the stat tiles; children sit at the right
function BandHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-4 border-b px-4 text-[11px] text-muted-foreground">
      <h2 className="mr-auto truncate font-medium uppercase tracking-widest text-muted-foreground/70">
        {title}
      </h2>
      {children}
    </div>
  )
}

function BandLegend({ children }: { children: React.ReactNode }) {
  return <div className="flex h-12 items-center gap-4 overflow-hidden border-b px-4">{children}</div>
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <StatGrid>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex h-12 items-center justify-between bg-card px-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </StatGrid>
        <Band className="xl:grid-cols-3">
          <div className="h-12 bg-card xl:col-span-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card p-4">
              <Skeleton className="h-[400px] w-full" />
            </div>
          ))}
        </Band>
      </div>
    </div>
  )
}
