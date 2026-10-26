import { describe, expect, it } from 'vitest'
import { alt, contentType, size } from '@/app/opengraph-image'
import { SHARE_METADATA as metadata } from '@/lib/share-metadata'

describe('link previews', () => {
  it('declares a 1200x630 PNG with a description of the app', () => {
    expect(size).toEqual({ width: 1200, height: 630 })
    expect(contentType).toBe('image/png')
    expect(alt).toMatch(/^Metas: do objetivo à tarefa do dia/)
  })

  it('gives every page an Open Graph title and description and a large Twitter card', () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL)
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      locale: 'pt_BR',
      siteName: 'Metas',
      title: 'Metas · Do objetivo à tarefa do dia',
    })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
  })
})
