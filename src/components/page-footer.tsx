import Link from 'next/link'

/**
 * Secondary links at the end of a page. Rendered after `<main>`, not inside
 * it: a footer inside main is not exposed as the page's footer landmark, and
 * these links are about the app, not the page's content.
 */
export function PageFooter() {
  return (
    <footer className="mx-auto max-w-2xl px-4 pb-8 text-center text-xs md:px-8">
      <Link href="/funil" className="text-muted-foreground underline-offset-4 hover:underline">
        Ver métricas do quiz
      </Link>
    </footer>
  )
}
