// Shown while any route's server data streams in. Mirrors the page shell
// (heading, then cards) so the swap to real content doesn't jump.
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl p-8" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando…
      </p>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-28 rounded-lg bg-muted" />
        <div className="h-28 rounded-lg bg-muted" />
      </div>
    </main>
  )
}
