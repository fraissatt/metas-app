import { TodaySkeleton } from '@/components/page-skeletons'

// Shown while Hoje streams in. It lives in this route group so the other pages,
// which fall back to the root skeleton, never flash Hoje's columns.
export default function Loading() {
  return <TodaySkeleton />
}
