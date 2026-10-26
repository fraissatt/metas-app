import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { keyToBytes, useDailyReminder } from '@/components/use-daily-reminder'
import { removeReminderSubscription, saveReminderSubscription } from '@/lib/actions/reminders'

vi.mock('@/lib/actions/reminders', () => ({
  saveReminderSubscription: vi.fn(),
  removeReminderSubscription: vi.fn(),
}))

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

type FakeSubscription = { endpoint: string; toJSON: () => object; unsubscribe: () => Promise<boolean> }

function fakeBrowser({ subscribed = false, permission = 'default' } = {}) {
  let current: FakeSubscription | null = null
  const makeSubscription = (): FakeSubscription => ({
    endpoint: 'https://push.example.com/1',
    toJSON: () => ({ endpoint: 'https://push.example.com/1', keys: { p256dh: 'k', auth: 'a' } }),
    unsubscribe: vi.fn(async () => {
      current = null
      return true
    }),
  })
  if (subscribed) current = makeSubscription()

  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = makeSubscription()
      return current
    }),
  }
  const registration = { pushManager }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: vi.fn(async () => registration), ready: Promise.resolve(registration) },
  })
  vi.stubGlobal('PushManager', function PushManager() {})
  vi.stubGlobal('Notification', { permission })
  return pushManager
}

beforeEach(() => {
  vi.mocked(saveReminderSubscription).mockReset()
  vi.mocked(removeReminderSubscription).mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('useDailyReminder', () => {
  it('offers nothing without the public key or without push support', () => {
    fakeBrowser()
    expect(renderHook(() => useDailyReminder(undefined)).result.current.state).toBe('hidden')

    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    expect(renderHook(() => useDailyReminder(KEY)).result.current.state).toBe('hidden')
  })

  it('asks iPhone browser tabs to install the app first', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    expect(renderHook(() => useDailyReminder(KEY)).result.current.state).toBe('install')
    vi.restoreAllMocks()
  })

  it('reads whether this browser is already subscribed, or blocked', async () => {
    fakeBrowser({ subscribed: true })
    const on = renderHook(() => useDailyReminder(KEY))
    await waitFor(() => expect(on.result.current.state).toBe('on'))
    // Saved again for whoever is signed in now (another account on this browser).
    expect(saveReminderSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example.com/1',
      keys: { p256dh: 'k', auth: 'a' },
    })

    fakeBrowser({ permission: 'denied' })
    const blocked = renderHook(() => useDailyReminder(KEY))
    await waitFor(() => expect(blocked.result.current.state).toBe('blocked'))
  })

  it('subscribes with the VAPID key and saves the subscription, then turns it off again', async () => {
    const pushManager = fakeBrowser()
    const { result } = renderHook(() => useDailyReminder(KEY))
    await waitFor(() => expect(result.current.state).toBe('off'))

    await act(() => result.current.toggle())

    expect(pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyToBytes(KEY) })
    expect(saveReminderSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example.com/1',
      keys: { p256dh: 'k', auth: 'a' },
    })
    expect(result.current.state).toBe('on')

    await act(() => result.current.toggle())

    expect(removeReminderSubscription).toHaveBeenCalledWith('https://push.example.com/1')
    expect(result.current.state).toBe('off')
  })

  it('shows blocked when the person refuses the permission prompt', async () => {
    const pushManager = fakeBrowser()
    const { result } = renderHook(() => useDailyReminder(KEY))
    await waitFor(() => expect(result.current.state).toBe('off'))
    pushManager.subscribe.mockImplementation(async () => {
      vi.stubGlobal('Notification', { permission: 'denied' })
      throw new DOMException('denied', 'NotAllowedError')
    })

    await act(() => result.current.toggle())

    expect(result.current.state).toBe('blocked')
    expect(saveReminderSubscription).not.toHaveBeenCalled()
  })
})

describe('useDailyReminder when saving fails', () => {
  it('undoes the browser subscription, so the item never shows on without a saved row', async () => {
    const pushManager = fakeBrowser()
    vi.mocked(saveReminderSubscription).mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useDailyReminder(KEY))
    await waitFor(() => expect(result.current.state).toBe('off'))

    await act(() => result.current.toggle())

    const subscription = await pushManager.subscribe.mock.results[0].value
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(result.current.state).toBe('off')
  })
})

describe('keyToBytes', () => {
  it('decodes URL-safe base64 into the 65-byte public key', () => {
    const bytes = keyToBytes(KEY)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
  })
})
