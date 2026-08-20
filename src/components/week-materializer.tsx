'use client'

import { useEffect, useRef } from 'react'

/**
 * Triggers materialisation of the current week from an effect rather than from
 * a render.
 *
 * Next's own guidance is explicit that mutations must never be a render
 * side-effect (`docs/01-app/02-guides/data-security.md`), and that they belong
 * in an effect or an action triggered from a Client Component
 * (`docs/01-app/02-guides/prefetching.md`). That is not academic here: the
 * sidebar renders `<Link href="/">`, which Next prefetches — a write in
 * `page.tsx` would create the week when the pointer crossed "Hoje".
 *
 * The ref guards against re-renders. React Strict Mode still double-invokes
 * this in development, which is why the server action recomputes what is
 * pending inside its own transaction.
 */
export function WeekMaterializer({ onMaterialize }: { onMaterialize: () => Promise<void> }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void onMaterialize()
  }, [onMaterialize])

  return null
}
