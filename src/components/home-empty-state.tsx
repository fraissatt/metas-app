import Link from 'next/link'

const COPY = {
  'no-objective': {
    heading: 'Comece pelo primeiro objetivo',
    body: 'Um objetivo se divide em metas semanais, e cada meta em tarefas do dia.',
    cta: 'Criar meu primeiro objetivo',
    href: '/objectives/new',
  },
  'no-goal': {
    heading: 'Defina a primeira meta semanal',
    body: 'Seu objetivo já existe. Falta quebrá-lo em uma meta para esta semana.',
    cta: 'Escolher um objetivo',
    href: '/objectives',
  },
} as const

export function HomeEmptyState({ variant }: { variant: keyof typeof COPY }) {
  const { heading, body, cta, href } = COPY[variant]

  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Link href={href} className="inline-flex items-center gap-2 text-primary hover:underline">
        {cta}
      </Link>
    </section>
  )
}
