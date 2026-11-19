import { describe, expect, it } from 'vitest'
import { passwordResetEmail, RESET_TOKEN_TTL_SECONDS } from './password-reset-email'

const url = 'https://metas.example/api/auth/reset-password/abc123?callbackURL=%2Fredefinir-senha'

describe('passwordResetEmail', () => {
  it('goes to the account e-mail, with the link in both versions and the validity said', () => {
    const mail = passwordResetEmail({ name: 'Ana', email: 'ana@example.com', url })
    expect(mail.to).toBe('ana@example.com')
    expect(mail.subject).toBe('Crie uma nova senha no Metas')
    expect(mail.text).toContain(url)
    expect(mail.text).toContain('Olá, Ana!')
    expect(mail.text).toContain('O link vale por 1 hora e só pode ser usado uma vez.')
    expect(mail.html).toContain('href="https://metas.example/api/auth/reset-password/abc123?callbackURL=%2Fredefinir-senha"')
    expect(RESET_TOKEN_TTL_SECONDS).toBe(3600)
  })

  it('tells whoever did not ask that nothing changes', () => {
    expect(passwordResetEmail({ name: 'Ana', email: 'a@b.co', url }).text).toContain('sua senha continua a mesma')
  })

  it('escapes the name and the link in the HTML, and copes with an empty name', () => {
    const mail = passwordResetEmail({ name: '<b>Ana</b>', email: 'a@b.co', url: 'https://x.example/?a=1&b="2"' })
    expect(mail.html).not.toContain('<b>Ana</b>')
    expect(mail.html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
    expect(mail.html).toContain('a=1&amp;b=&quot;2&quot;')
    expect(passwordResetEmail({ name: '  ', email: 'a@b.co', url }).text.startsWith('Olá!')).toBe(true)
  })
})
