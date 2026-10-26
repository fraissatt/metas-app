import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cron/lembrete/route'
import { sendDailyReminders } from '@/lib/push'

vi.mock('@/lib/push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/push')>()),
  sendDailyReminders: vi.fn(),
}))
const send = vi.mocked(sendDailyReminders)

function request(authorization?: string) {
  return new NextRequest('http://localhost/api/cron/lembrete', {
    headers: authorization ? { authorization } : {},
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  send.mockReset()
})

describe('GET /api/cron/lembrete', () => {
  it('refuses anyone without the cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request('Bearer wrong'))).status).toBe(401)
    expect(send).not.toHaveBeenCalled()
  })

  it('refuses everyone while CRON_SECRET is not set', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(request('Bearer '))).status).toBe(401)
  })

  it('does nothing while the VAPID keys are missing', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    const response = await GET(request('Bearer s3cret'))
    expect(response.status).toBe(200)
    expect(send).not.toHaveBeenCalled()
  })

  it('sends the reminders and reports the run', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
    send.mockResolvedValue({ sent: 2, skipped: 1, removed: 0, failed: 0 })

    const response = await GET(request('Bearer s3cret'))

    expect(await response.json()).toEqual({ sent: 2, skipped: 1, removed: 0, failed: 0 })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ publicKey: 'pub', privateKey: 'priv' }))
  })
})
