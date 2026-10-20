import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { setTimeout as sleep } from 'node:timers/promises'
import { getRabbitMQBaseUrl } from '@/lib/rabbitmq/config'
import type { NodeStats, Overview } from '@/lib/rabbitmq/types'

/**
 * Records the dashboard's broker metrics into a SQLite file, one row per
 * interval, so history outlives the broker's own 24h, restart-wiped window.
 * Gauges are stored as-is; publish/deliver_get are raw cumulative counters
 * (rates are derived at read time, a drop means the broker restarted).
 */

const OVERVIEW_COLUMNS = [
  'node',
  'queue_totals.messages',
  'queue_totals.messages_ready',
  'queue_totals.messages_unacknowledged',
  'message_stats.publish',
  'message_stats.deliver_get',
].join(',')

const NODE_COLUMNS = 'name,mem_used,disk_free,fd_used,proc_used'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS samples (
    ts          INTEGER PRIMARY KEY,
    messages    INTEGER,
    ready       INTEGER,
    unacked     INTEGER,
    publish     INTEGER,
    deliver_get INTEGER,
    mem_used    INTEGER,
    disk_free   INTEGER,
    fd_used     INTEGER,
    proc_used   INTEGER
  ) STRICT
`

async function getJson<T>(path: string, auth: string): Promise<T> {
  const response = await fetch(`${getRabbitMQBaseUrl()}/api/${path}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`GET /api/${path}: ${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

async function record(auth: string, insert: StatementSync, prune: StatementSync, retentionSec: number) {
  const [ov, nodes] = await Promise.all([
    getJson<Overview>(`overview?columns=${OVERVIEW_COLUMNS}`, auth),
    getJson<NodeStats[]>(`nodes?columns=${NODE_COLUMNS}`, auth),
  ])
  const node = nodes.find((n) => n.name === ov.node)
  const ts = Math.round(Date.now() / 1000)

  insert.run(
    ts,
    ov.queue_totals?.messages ?? null,
    ov.queue_totals?.messages_ready ?? null,
    ov.queue_totals?.messages_unacknowledged ?? null,
    ov.message_stats?.publish ?? null,
    ov.message_stats?.deliver_get ?? null,
    node?.mem_used ?? null,
    node?.disk_free ?? null,
    node?.fd_used ?? null,
    node?.proc_used ?? null,
  )
  prune.run(ts - retentionSec)
}

/** Runs forever; off unless METRICS_DB is set. */
export async function startCollector() {
  const {
    METRICS_DB,
    METRICS_USERNAME,
    METRICS_PASSWORD,
    METRICS_INTERVAL_SECONDS,
    METRICS_RETENTION_DAYS,
  } = process.env
  if (!METRICS_DB) return
  if (!METRICS_USERNAME || !METRICS_PASSWORD || !METRICS_INTERVAL_SECONDS || !METRICS_RETENTION_DAYS) {
    console.error(
      '[metrics] METRICS_DB is set but METRICS_USERNAME, METRICS_PASSWORD, METRICS_INTERVAL_SECONDS or METRICS_RETENTION_DAYS is missing; not recording',
    )
    return
  }

  const auth = Buffer.from(`${METRICS_USERNAME}:${METRICS_PASSWORD}`).toString('base64')
  const intervalMs = Number(METRICS_INTERVAL_SECONDS) * 1000
  const retentionSec = Number(METRICS_RETENTION_DAYS) * 86400

  const db = new DatabaseSync(METRICS_DB)
  // WAL lets the dashboard's reads run alongside these writes
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(SCHEMA)
  const insert = db.prepare(
    'INSERT OR REPLACE INTO samples (ts, messages, ready, unacked, publish, deliver_get, mem_used, disk_free, fd_used, proc_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const prune = db.prepare('DELETE FROM samples WHERE ts < ?')
  console.log(`[metrics] recording every ${METRICS_INTERVAL_SECONDS}s into ${METRICS_DB}`)

  // Log only on state changes, so a broker outage doesn't flood the logs
  let failing = false
  for (;;) {
    // Sleep to the next interval boundary, keeping timestamps on a fixed grid
    await sleep(intervalMs - (Date.now() % intervalMs))
    try {
      await record(auth, insert, prune, retentionSec)
      if (failing) console.log('[metrics] recording again')
      failing = false
    } catch (err) {
      if (!failing) console.error('[metrics] sample failed, retrying each interval:', err)
      failing = true
    }
  }
}
