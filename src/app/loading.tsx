import { PageSkeleton } from '@/components/page-skeletons'

// The fallback for any route without its own loading file: a heading and a
// couple of cards. Hoje, Objetivos and each objective have their own, shaped
// like their pages.
export default function Loading() {
  return <PageSkeleton />
}
