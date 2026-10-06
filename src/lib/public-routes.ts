export const AUTH_PAGES = ['/entrar', '/cadastro'] as const

export function isFunnelPublic(env: Record<string, string | undefined> = process.env): boolean {
  return env.FUNNEL_PUBLIC === 'true'
}

export function isPublicPath(pathname: string, funnelPublic: boolean): boolean {
  if ((AUTH_PAGES as readonly string[]).includes(pathname)) return true
  return funnelPublic && pathname === '/funil'
}
