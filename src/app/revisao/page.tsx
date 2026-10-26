import type { Metadata } from 'next'
import Link from 'next/link'
import { finishWeekReview, getWeekReview } from '@/lib/actions/weekReview'
import { WeekReview } from '@/components/week-review'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Revisão da semana' }

// Which week is reviewed depends on today's date, so never prerender.
export const dynamic = 'force-dynamic'

export default async function WeekReviewPage() {
  const review = await getWeekReview()

  return (
    <main className="mx-auto max-w-2xl p-8">
      {review ? (
        <WeekReview review={review} onFinish={finishWeekReview} />
      ) : (
        <section className="mx-auto flex max-w-sm flex-col items-center gap-4 py-12 text-center">
          <h1 className="text-2xl font-semibold text-muted-foreground">Ainda não há uma semana para revisar.</h1>
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            Voltar para Hoje
          </Link>
        </section>
      )}
    </main>
  )
}
