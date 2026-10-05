import type { MetadataRoute } from 'next'
import { NAV_LINKS } from '@/lib/navigation'
import { BROWSER_CHROME, DEFAULT_THEME } from '@/lib/theme'

// No service worker on purpose: this is what makes the app installable, and the
// data lives in Postgres behind Server Actions, so caching pages offline would
// show stale goals and break writes.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Metas',
    short_name: 'Metas',
    description: 'Objetivos, metas semanais e tarefas do dia.',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    background_color: BROWSER_CHROME[DEFAULT_THEME],
    theme_color: BROWSER_CHROME[DEFAULT_THEME],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: NAV_LINKS.map((link) => ({ name: link.label, url: link.href })),
  }
}
