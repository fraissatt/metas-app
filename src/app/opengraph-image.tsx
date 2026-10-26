import { ImageResponse } from 'next/og'

import { readDarkPalette, withAlpha, type DarkPalette } from '@/lib/dark-palette'

// The preview card that WhatsApp, LinkedIn and Slack show for a shared link,
// in the dark theme's colours so it looks like the app it opens. No font
// weights: next/og ships only Geist Regular, and hierarchy here comes from size.

export const alt = 'Metas: do objetivo à tarefa do dia. Objetivos, metas semanais e tarefas diárias em um só lugar.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Tone = 'done' | 'partial' | 'empty'

const WEEK: Tone[] = ['done', 'done', 'done', 'partial', 'done', 'empty', 'empty']
const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

// Twelve weeks of a fixed, believable streak (columns are weeks, Monday on
// top), denser towards the right: the habit taking hold.
const YEAR: Tone[][] = Array.from({ length: 12 }, (_, week) =>
  Array.from({ length: 7 }, (_, day): Tone => {
    const seed = (week * 7 + day * 3) % 10
    if (day >= 5 && seed < 6) return 'empty'
    if (seed < 10 - Math.floor(week / 2) - 4) return seed % 3 === 0 ? 'partial' : 'empty'
    return 'done'
  }),
)

// The same three tones as the app's day dots (components/dot.tsx).
function toneColor(colors: DarkPalette, tone: Tone): string {
  if (tone === 'done') return colors.primary
  return tone === 'partial' ? withAlpha(colors.primary, 0.35) : colors.muted
}

function Dot({ color, size: dotSize }: { color: string; size: number }) {
  return (
    <div
      style={{
        width: dotSize,
        height: dotSize,
        borderRadius: dotSize >= 30 ? dotSize : 5,
        background: color,
      }}
    />
  )
}

export default async function OpengraphImage() {
  const colors = await readDarkPalette()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: colors.background,
          color: colors.foreground,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: 560 }}>
          <div style={{ display: 'flex', fontSize: 34, color: colors.primary }}>Metas</div>
          <div style={{ display: 'flex', marginTop: 36, fontSize: 64, lineHeight: 1.1 }}>
            Do objetivo à tarefa do dia
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 28, lineHeight: 1.4, color: colors['muted-foreground'] }}>
            Objetivos, metas semanais e tarefas diárias em um só lugar.
          </div>
          <div style={{ display: 'flex', marginTop: 44, fontSize: 24, color: colors.primary }}>
            1% melhor a cada dia feito · 37× em um ano
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 420,
            borderRadius: 20,
            border: `2px solid ${colors.border}`,
            background: colors.card,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 44 }}>5</span>
              <span style={{ marginLeft: 12, fontSize: 22, color: colors['muted-foreground'] }}>de 7 dias feitos</span>
            </div>
            <div style={{ display: 'flex', marginTop: 20, gap: 14 }}>
              {WEEK.map((tone, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Dot color={toneColor(colors, tone)} size={36} />
                  <span style={{ fontSize: 16, color: colors['muted-foreground'] }}>{WEEKDAYS[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', height: 2, background: colors.border }} />

          <div style={{ display: 'flex', flexDirection: 'column', padding: '28px 32px' }}>
            <span style={{ fontSize: 20, color: colors['muted-foreground'] }}>Seus pequenos passos</span>
            <div style={{ display: 'flex', marginTop: 18, gap: 8 }}>
              {YEAR.map((week, w) => (
                <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {week.map((tone, d) => (
                    <Dot key={d} color={toneColor(colors, tone)} size={20} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
