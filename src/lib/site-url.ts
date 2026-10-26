/**
 * The public address of the app, for absolute URLs in link previews.
 * On Vercel, production builds get VERCEL_PROJECT_PRODUCTION_URL (a host
 * without the scheme) and previews VERCEL_URL; locally, BETTER_AUTH_URL.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const host = env.VERCEL_ENV === 'production' ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL
  if (host) return new URL(`https://${host}`)
  return new URL(env.BETTER_AUTH_URL || 'http://localhost:3000')
}
