import { describe, expect, it } from 'vitest'
import { authErrorMessage } from '@/lib/auth-errors'

describe('authErrorMessage', () => {
  it('maps wrong credentials without saying which field is wrong', () => {
    expect(authErrorMessage({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe('E-mail ou senha incorretos')
  })
  it('maps an existing e-mail', () => {
    expect(authErrorMessage({ status: 422, code: 'USER_ALREADY_EXISTS' })).toBe('Esse e-mail já tem conta')
    expect(authErrorMessage({ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe('Esse e-mail já tem conta')
  })
  it('maps rate limiting', () => {
    expect(authErrorMessage({ status: 429 })).toBe('Muitas tentativas. Tente de novo em alguns minutos.')
  })
  it('falls back to a generic retry message', () => {
    expect(authErrorMessage({ status: 500 })).toBe('Não foi possível concluir. Tente de novo.')
    expect(authErrorMessage(undefined)).toBe('Não foi possível concluir. Tente de novo.')
  })
})
