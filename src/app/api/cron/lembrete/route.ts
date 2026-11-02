import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { sendDailyReminders, vapidConfig } from '@/lib/push'

// Called by Vercel Cron once a day (vercel.json). Vercel sends
// `Authorization: Bearer <CRON_SECRET>`; anyone else gets a 401.
export const dynamic = 'force-dynamic'

// Compared as fixed-length digests in constant time, so response timing
// says nothing about how much of a guessed secret was right.
function matchesSecret(header: string | null, secret: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(header ?? ''), digest(`Bearer ${secret}`))
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || !matchesSecret(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const config = vapidConfig()
  if (!config) return NextResponse.json({ skipped: 'VAPID keys not configured' })

  return NextResponse.json(await sendDailyReminders(config))
}
