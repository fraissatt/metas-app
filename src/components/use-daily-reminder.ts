'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { removeReminderSubscription, saveReminderSubscription } from '@/lib/actions/reminders'

/**
 * - `hidden`: no keys configured, or a browser without push: nothing to offer.
 * - `install`: an iPhone/iPad browser tab; push only works from the installed app.
 * - `blocked`: the person denied notifications in the browser's settings.
 */
export type ReminderState = 'hidden' | 'install' | 'blocked' | 'off' | 'on'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** The VAPID public key, from URL-safe base64 to the bytes `subscribe` expects. */
export function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function isAppleMobileTab(): boolean {
  // iPadOS Safari reports a Mac user agent; touch points tell them apart.
  const apple =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  const installed =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return apple && !installed
}

// Browser capabilities never change while the page is open.
const subscribeNever = () => () => {}
const onServer = () => false

/** The daily reminder for this browser: where it stands, and turning it on or off. */
export function useDailyReminder(publicKey: string | undefined = PUBLIC_KEY) {
  const supported = useSyncExternalStore(subscribeNever, pushSupported, onServer)
  const appleTab = useSyncExternalStore(subscribeNever, isAppleMobileTab, onServer)
  const [state, setState] = useState<ReminderState>('hidden')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!publicKey || !supported) return

    let cancelled = false
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (subscription) {
          // Saved again on every visit: the upsert moves the row to whoever is
          // signed in on this browser now, and recreates it if it was lost, so
          // "on" here always means this person gets the reminder.
          await saveReminderSubscription(subscription.toJSON())
          if (!cancelled) setState('on')
        } else if (!cancelled) {
          setState(Notification.permission === 'denied' ? 'blocked' : 'off')
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [publicKey, supported])

  async function turnOn() {
    if (!publicKey) return
    const registration = await navigator.serviceWorker.ready
    // Asks for permission here, right after the person's click.
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(publicKey),
    })
    try {
      await saveReminderSubscription(subscription.toJSON())
    } catch (error) {
      // Not saved means no reminder: undo the browser side too, so the item
      // never shows "on" for a subscription the server does not know.
      await subscription.unsubscribe()
      throw error
    }
    setState('on')
  }

  async function turnOff() {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await removeReminderSubscription(subscription.endpoint)
      await subscription.unsubscribe()
    }
    setState('off')
  }

  async function toggle() {
    if (busy || (state !== 'on' && state !== 'off')) return
    setBusy(true)
    try {
      await (state === 'on' ? turnOff() : turnOn())
    } catch {
      setState(Notification.permission === 'denied' ? 'blocked' : state)
    } finally {
      setBusy(false)
    }
  }

  if (!publicKey) return { state: 'hidden' as const, busy, toggle }
  if (!supported) return { state: appleTab ? ('install' as const) : ('hidden' as const), busy, toggle }
  return { state, busy, toggle }
}
