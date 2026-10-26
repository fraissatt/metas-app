import { NextResponse, type NextRequest } from 'next/server'
import { sendDailyReminders, vapidConfig } from '@/lib/push'

// Called by Vercel Cron once a day (vercel.json). Vercel sends
// `Authorization: Bearer <CRON_SECRET>`; anyone else gets a 401.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const config = vapidConfig()
  if (!config) return NextResponse.json({ skipped: 'VAPID keys not configured' })

  return NextResponse.json(await sendDailyReminders(config))
}
