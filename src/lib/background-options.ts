export type BackgroundStyle = 'aurora' | 'pontos' | 'nenhum'

export const DEFAULT_BACKGROUND: BackgroundStyle = 'aurora'
export const BACKGROUND_COOKIE = 'fundo'
export const BACKGROUND_STYLES: readonly BackgroundStyle[] = ['aurora', 'pontos', 'nenhum']
export const BACKGROUND_LABELS: Record<BackgroundStyle, string> = {
  aurora: 'Aurora',
  pontos: 'Grade de pontos',
  nenhum: 'Nenhum',
}

// Exact match: the cookie is only written by setBackground, so anything else
// is tampering or a stale format and gets the default.
export function parseBackground(value: string | undefined): BackgroundStyle {
  return BACKGROUND_STYLES.includes(value as BackgroundStyle) ? (value as BackgroundStyle) : DEFAULT_BACKGROUND
}
