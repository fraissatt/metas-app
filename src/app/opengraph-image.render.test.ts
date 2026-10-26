// @vitest-environment node
import { describe, expect, it } from 'vitest'
import OpengraphImage from '@/app/opengraph-image'

describe('opengraph-image', () => {
  // Renders for real: an unsupported style or a missing colour would
  // otherwise only show up at build time or on a crawler's request.
  it('renders a PNG', async () => {
    const response = await OpengraphImage()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(10_000)
    expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join('')).toBe('PNG')
  }, 30_000)
})
