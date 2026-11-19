import { PageSkeleton } from '@/components/page-skeletons'

// Without its own file this route would fall back to a parent's skeleton,
// which mirrors a different page.
export default function Loading() {
  return <PageSkeleton />
}
