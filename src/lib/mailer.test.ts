// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const sendMailMock = vi.hoisted(() => vi.fn(async () => ({})))
const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: sendMailMock })))
vi.mock('nodemailer', () => ({ default: { createTransport } }))

import { mailConfig, sendMail } from './mailer'

const mail = { to: 'ana@example.com', subject: 'Assunto', text: 'texto', html: '<p>texto</p>' }

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('mailConfig', () => {
  it('needs both the address and the app password, and ignores the spaces Google shows in it', () => {
    expect(mailConfig({})).toBeNull()
    expect(mailConfig({ GMAIL_USER: 'metas@gmail.com' })).toBeNull()
    expect(mailConfig({ GMAIL_APP_PASSWORD: 'abcd efgh' })).toBeNull()
    expect(mailConfig({ GMAIL_USER: ' metas@gmail.com ', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' })).toEqual({
      user: 'metas@gmail.com',
      pass: 'abcdefghijklmnop',
    })
  })
})

describe('sendMail', () => {
  it('sends through Gmail over TLS, from the configured address', async () => {
    await sendMail(mail, { GMAIL_USER: 'metas@gmail.com', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' })
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'metas@gmail.com', pass: 'abcdefghijklmnop' },
    })
    expect(sendMailMock).toHaveBeenCalledWith({ from: 'Metas <metas@gmail.com>', ...mail })
  })

  it('without configuration sends nothing and prints the message in development', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await sendMail(mail, { NODE_ENV: 'development' })
    expect(createTransport).not.toHaveBeenCalled()
    expect(info.mock.calls[0][0]).toContain('texto')
  })

  it('without configuration in production only warns, and never prints the message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await sendMail(mail, { NODE_ENV: 'production' })
    expect(warn).toHaveBeenCalledOnce()
    expect(info).not.toHaveBeenCalled()
    expect(createTransport).not.toHaveBeenCalled()
  })
})
