import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function GuestBanner() {
  return (
    <div role="status" className="border-b border-border bg-secondary text-secondary-foreground md:mx-auto md:mt-2 md:w-[calc(100%-2rem)] md:max-w-6xl md:rounded-xl md:border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-6">
        <p className="flex-1">Você está como visitante. Os dados somem após 24 h sem uso. Crie uma conta para guardá-los.</p>
        <Link href="/cadastro" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Criar conta
        </Link>
      </div>
    </div>
  )
}
