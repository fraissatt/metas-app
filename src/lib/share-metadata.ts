import type { Metadata } from 'next'
import { siteUrl } from '@/lib/site-url'

const TITLE = 'Metas · Do objetivo à tarefa do dia'
const DESCRIPTION = 'Objetivos, metas semanais e tarefas diárias em um só lugar. Entre como visitante e teste agora.'

/**
 * How a shared link previews (WhatsApp, LinkedIn, Slack). A shared link
 * usually points at the presentation page, so every page previews as the app
 * itself; the image comes from app/opengraph-image.tsx. Kept out of the
 * layout so it can be tested without loading next/font.
 */
export const SHARE_METADATA = {
  // og:image needs an absolute URL.
  metadataBase: siteUrl(),
  openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Metas', title: TITLE, description: DESCRIPTION, url: '/' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
} satisfies Metadata
