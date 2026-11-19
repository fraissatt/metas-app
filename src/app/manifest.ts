import type { MetadataRoute } from 'next'
import { NAV_LINKS } from '@/lib/navigation'
import { BROWSER_CHROME, DEFAULT_THEME } from '@/lib/theme'

// The service worker (public/sw.js) keeps only static files and a static offline
// page. It does not cache pages or queue writes on purpose: the data lives in
// Postgres behind Server Actions, so cached pages would show stale goals and
// replayed writes could clash with changes made on another device.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Metas',
    short_name: 'Metas',
    description: 'Objetivos, metas semanais e tarefas do dia.',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    // On desktop Chrome and Edge the header takes the title bar (see the
    // `display-mode: window-controls-overlay` block in globals.css); anywhere
    // else this falls back to `display` above.
    display_override: ['window-controls-overlay'],
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
