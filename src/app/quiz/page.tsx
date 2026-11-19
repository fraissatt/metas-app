import type { Metadata } from 'next'
import { trackFunnelEvent } from '@/lib/actions/funnel'
import { createPlanFromQuiz } from '@/lib/actions/quiz'
import { OnboardingQuiz } from '@/components/onboarding-quiz'
import { PageFooter } from '@/components/page-footer'

export const metadata: Metadata = { title: 'Montar plano' }

export default function QuizPage() {
  return (
    <>
      <main className="mx-auto max-w-md p-4 md:p-8">
        <OnboardingQuiz onTrack={trackFunnelEvent} onCreate={createPlanFromQuiz} />
      </main>
      <PageFooter />
    </>
  )
}
