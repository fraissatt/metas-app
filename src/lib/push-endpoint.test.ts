import { describe, expect, it } from 'vitest'
import { isAllowedPushEndpoint } from '@/lib/push-endpoint'

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://android.googleapis.com/gcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QAbc',
    'https://api.push.apple.com/3/device/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('accepts %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true)
  })

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://example.com/push',
    'https://fcm.googleapis.com.evil.example/abc',
    'https://evilpush.apple.com/abc',
    'https://notify.windows.com.evil.example/abc',
    'https://fcm.googleapis.com:444/abc',
    'https://a:b@fcm.googleapis.com/abc',
    'https://localhost/abc',
    'not a url',
  ])('rejects %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false)
  })
})
