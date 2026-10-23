import Link from 'next/link'
import { Route, Smartphone, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GuestButton } from '@/components/guest-button'
import { LandingCard, type LandingColor } from '@/components/landing-card'
import { LandingFlow } from '@/components/landing-flow'
import { buttonVariants } from '@/components/ui/button'
import { buildLandingDemo } from '@/lib/landing-demo'

type Item = { icon: LucideIcon; title: string; text: string; color: LandingColor }

const EXTRAS: Item[] = [
  { icon: User, title: 'Modo visitante', text: 'Teste com dados prontos', color: 'violet' },
  { icon: Route, title: 'Quiz de plano', text: 'Responda e receba um plano', color: 'pink' },
  { icon: Smartphone, title: 'App instalável', text: 'PWA em tela cheia', color: 'cyan' },
]

function Actions({ onEnterAsGuest }: { onEnterAsGuest: () => Promise<{ throttled: true } | void> }) {
  return (
    <div className="flex flex-wrap items-start gap-3 max-md:justify-center">
      <GuestButton variant="plain" onEnter={onEnterAsGuest} />
      <Link href="/cadastro" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
        Criar conta
      </Link>
    </div>
  )
}

export function Landing({ onEnterAsGuest }: { onEnterAsGuest: () => Promise<{ throttled: true } | void> }) {
  return (
    <>
      <main className="landing-root mx-auto flex max-w-5xl flex-col gap-14 px-4 py-10 md:px-8 md:py-16">
        <section className="flex flex-col items-start gap-5 max-md:items-center max-md:text-center">
          <h1 className="text-4xl font-bold text-accent-foreground md:text-5xl">Metas</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Do objetivo à tarefa do dia, sem se perder no meio do caminho.
          </p>
          <div className="flex flex-wrap items-start gap-3 max-md:justify-center">
            <Actions onEnterAsGuest={onEnterAsGuest} />
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

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold max-md:text-center">Como funciona</h2>
          <LandingFlow data={buildLandingDemo()} />
        </section>

        <section className="landing-reveal flex flex-col gap-6">
          <h2 className="text-2xl font-semibold max-md:text-center">E também</h2>
          <ul aria-label="E também" className="grid gap-3 sm:grid-cols-3">
            {EXTRAS.map((card, index) => (
              <LandingCard key={card.title} {...card} index={index} />
            ))}
          </ul>
        </section>

        <section className="landing-reveal flex flex-col items-start gap-4 border-t border-border pt-10 max-md:items-center max-md:text-center">
          <h2 className="text-2xl font-semibold">Pronto para começar?</h2>
          <Actions onEnterAsGuest={onEnterAsGuest} />
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-4 text-xs text-muted-foreground md:px-8">
        <a
          href="https://github.com/fraissatt/metas-app"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Código no GitHub
        </a>
        <span>Todos os direitos reservados</span>
      </footer>
    </>
  )
}
