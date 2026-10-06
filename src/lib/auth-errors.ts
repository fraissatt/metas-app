export const PASSWORD_MIN_LENGTH = 8

const GENERIC = 'Não foi possível concluir. Tente de novo.'

export function authErrorMessage(error: { status?: number; code?: string } | null | undefined): string {
  if (!error) return GENERIC
  if (error.status === 429) return 'Muitas tentativas. Tente de novo em alguns minutos.'
  if (error.code?.startsWith('USER_ALREADY_EXISTS')) return 'Esse e-mail já tem conta'
  if (error.status === 401 || error.code === 'INVALID_EMAIL_OR_PASSWORD') return 'E-mail ou senha incorretos'
  return GENERIC
}
