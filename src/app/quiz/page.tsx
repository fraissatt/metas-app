import type { Metadata } from 'next'
import Link from 'next/link'
import { trackFunnelEvent } from '@/lib/actions/funnel'
import { createPlanFromQuiz } from '@/lib/actions/quiz'
import { OnboardingQuiz } from '@/components/onboarding-quiz'

export const metadata: Metadata = { title: 'Montar plano' }

export default function QuizPage() {
  return (
    <main className="mx-auto max-w-md p-4 md:p-8">
      <OnboardingQuiz onTrack={trackFunnelEvent} onCreate={createPlanFromQuiz} />
      <p className="mt-8 text-center text-xs">
        <Link href="/funil" className="text-muted-foreground underline-offset-4 hover:underline">
          Ver métricas do quiz
        </Link>
      </p>
    </main>
  )
}
