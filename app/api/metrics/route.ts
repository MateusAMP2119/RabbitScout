import { NextRequest, NextResponse } from 'next/server'
import { rabbitmqFetch } from '@/lib/rabbitmq/client'
import { RabbitMQError } from '@/lib/rabbitmq/errors'
import { readHistory } from '@/lib/metrics/history'

export const dynamic = 'force-dynamic'

const MAX_SECONDS = 86400

/**
 * Recorded metrics for the last `seconds` (capped at 24h). The session
 * cookie is checked against the broker first, since it isn't signed.
 */
export async function GET(request: NextRequest) {
  try {
    await rabbitmqFetch('whoami')
  } catch (err) {
    const status = err instanceof RabbitMQError ? err.status : 502
    return NextResponse.json({ error: 'Not authenticated' }, { status: status === 401 ? 401 : 502 })
  }

  const seconds = Number(request.nextUrl.searchParams.get('seconds'))
  if (!Number.isInteger(seconds) || seconds <= 0 || seconds > MAX_SECONDS) {
    return NextResponse.json({ error: `seconds must be an integer in 1..${MAX_SECONDS}` }, { status: 400 })
  }

  return NextResponse.json(readHistory(seconds))
}
