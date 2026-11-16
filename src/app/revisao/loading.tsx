import { PageSkeleton } from '@/components/page-skeletons'

// Each route that wants a skeleton has its own loading file, and the root has
// none: a dynamic route is prefetched only down to its first loading boundary,
// so a root one would show first and then swap for the page-shaped one. Routes
// without a file keep the old page on screen while the top bar runs.
export default function Loading() {
  return <PageSkeleton />
}
