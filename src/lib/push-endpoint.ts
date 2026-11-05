// The cron route POSTs to every saved endpoint, so an endpoint is a URL the
// server will call. Only the browsers' own push services are accepted:
// anything else would let a signed-in user (a guest included) point the
// server at a host of their choosing.

/** Exact hosts, and suffixes that cover a service's numbered hosts. */
const PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge on Android, Opera, Samsung Internet
  'android.googleapis.com', // older Chrome subscriptions
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari, and PWAs on iPhone and Mac
]
const PUSH_HOST_SUFFIXES = [
  '.push.apple.com',
  '.notify.windows.com', // Edge on Windows (wns2-*.notify.windows.com)
]

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  const host = url.hostname.toLowerCase()
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** More browsers than one person uses; caps how many pushes one account can make the cron send. */
export const MAX_SUBSCRIPTIONS_PER_USER = 10
