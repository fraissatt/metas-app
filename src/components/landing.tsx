import Link from 'next/link'
import { CalendarDays, ListChecks, Route, Smartphone, Target, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GuestButton } from '@/components/guest-button'
import { LandingCard, type LandingColor } from '@/components/landing-card'
import { buttonVariants } from '@/components/ui/button'

const CARDS: { icon: LucideIcon; title: string; text: string; color: LandingColor }[] = [
  { icon: Target, title: 'Objetivos', text: 'O destino, com prazo e progresso', color: 'green' },
  { icon: CalendarDays, title: 'Metas semanais', text: 'O que fazer em cada semana', color: 'blue' },
  { icon: ListChecks, title: 'Tarefas diárias', text: 'O passo de hoje, na tela Hoje', color: 'amber' },
  { icon: User, title: 'Modo visitante', text: 'Teste com dados prontos', color: 'violet' },
  { icon: Route, title: 'Quiz de plano', text: 'Responda e receba um plano', color: 'pink' },
  { icon: Smartphone, title: 'App instalável', text: 'PWA em tela cheia', color: 'cyan' },
]

export function Landing({ onEnterAsGuest }: { onEnterAsGuest: () => Promise<{ throttled: true } | void> }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:px-8 md:py-16">
      <section className="flex flex-col items-start gap-5">
        <h1 className="text-4xl font-bold text-accent-foreground md:text-5xl">Metas</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Do objetivo à tarefa do dia, sem se perder no meio do caminho.
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <GuestButton variant="plain" onEnter={onEnterAsGuest} />
          <Link href="/cadastro" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Criar conta
          </Link>
          <Link
            href="/entrar"
            className="self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Já tenho conta
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Conta de demonstração com dados prontos. Os dados somem após 24 h sem uso.
        </p>
      </section>

      <section>
        <h2 className="sr-only">O que o Metas oferece</h2>
        <ul aria-label="O que o Metas oferece" className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((card, index) => (
            <LandingCard key={card.title} {...card} index={index} />
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <a
          href="https://github.com/fraissatt/metas-app"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Código no GitHub
        </a>
        <span>Todos os direitos reservados</span>
      </footer>
    </main>
  )
}
