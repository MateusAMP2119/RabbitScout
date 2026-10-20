import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

/**
 * Reads the collector's samples back for the stat-tile sparklines,
 * averaged into at most POINTS buckets so a 24h window stays small.
 */

const POINTS = 120

/** Gauges drawn behind the stat tiles */
export const HISTORY_COLUMNS = [
  'messages',
  'mem_used',
  'queues',
  'connections',
  'disk_free',
  'fd_used',
  'proc_used',
] as const

export type HistoryColumn = (typeof HISTORY_COLUMNS)[number]

export interface MetricsHistory {
  /** Window bounds, unix seconds */
  from: number
  to: number
  /** Bucket starts, unix seconds; null values are gaps (nothing recorded) */
  ts: number[]
  series: Record<HistoryColumn, Array<number | null>>
}

let db: DatabaseSync | null = null

function open(): DatabaseSync | null {
  const path = process.env.METRICS_DB
  if (!path || !existsSync(path)) return null
  db ??= new DatabaseSync(path, { readOnly: true })
  return db
}

export function readHistory(seconds: number): MetricsHistory {
  const to = Math.floor(Date.now() / 1000)
  const from = to - seconds
  const series = Object.fromEntries(
    HISTORY_COLUMNS.map((c) => [c, [] as Array<number | null>]),
  ) as MetricsHistory['series']
  const history: MetricsHistory = { from, to, ts: [], series }

  const conn = open()
  if (!conn) return history

  const bucket = Math.max(1, Math.ceil(seconds / POINTS))
  const averages = HISTORY_COLUMNS.map((c) => `AVG(${c}) AS ${c}`).join(', ')
  const rows = conn
    .prepare(`SELECT ts - ts % ? AS t, ${averages} FROM samples WHERE ts >= ? GROUP BY t ORDER BY t`)
    .all(bucket, from) as Array<Record<string, number | null>>

  for (const row of rows) {
    history.ts.push(row.t as number)
    for (const c of HISTORY_COLUMNS) series[c].push(row[c])
  }
  return history
}
