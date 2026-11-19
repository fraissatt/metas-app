import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServiceWorkerRegister } from './service-worker-register'

const register = vi.fn(async () => ({}))

afterEach(() => {
  register.mockClear()
  vi.unstubAllEnvs()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

function stubWorker() {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } })
}

describe('ServiceWorkerRegister', () => {
  it('registers /sw.js in production, at the root scope, bypassing the HTTP cache', () => {
    vi.stubEnv('NODE_ENV', 'production')
    stubWorker()
    render(<ServiceWorkerRegister />)
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' })
  })

  it('does nothing in development, where the worker would cache unhashed files', () => {
    vi.stubEnv('NODE_ENV', 'development')
    stubWorker()
    render(<ServiceWorkerRegister />)
    expect(register).not.toHaveBeenCalled()
  })

  it('does nothing where service workers do not exist', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow()
  })
})
