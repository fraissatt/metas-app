export const NAV_LINKS = [
  { href: '/', label: 'Hoje' },
  { href: '/objectives', label: 'Objetivos' },
] as const

export function isLinkActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}
