import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Placeholders shown while a route's server data streams in. Each mirrors the
 * real page's columns and card sizes, so the swap to the content doesn't jump.
 * The pulse is off under "reduce motion"; only a status line is read aloud.
 */

/** One grey block standing in for a line of text, a chart or a card. */
export function Bone({ className }: { className?: string }) {
  return <div data-bone className={cn('rounded-md bg-muted', className)} />
}

function SkeletonPage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main className={cn('mx-auto max-w-2xl', className)} aria-busy="true">
      <p role="status" className="sr-only">
        Carregando…
      </p>
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        {children}
      </div>
    </main>
  )
}

/** A framed list of rows, like a `PanelList` of tasks or goals. */
function PanelBones({ rows, rowClassName }: { rows: number; rowClassName?: string }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn('flex items-center gap-3 px-4 py-3', rowClassName)}>
          <Bone className="size-5 shrink-0 rounded-full" />
          <Bone className={cn('h-4', i % 2 ? 'w-1/2' : 'w-2/3')} />
        </div>
      ))}
    </div>
  )
}

/** Hoje: the task list beside the week's progress, then "Seus pequenos passos". */
export function TodaySkeleton() {
  return (
    <SkeletonPage className="p-8 lg:max-w-6xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4 lg:basis-3/5">
          <Bone className="h-8 w-28" />
          <Bone className="h-11 w-full rounded-lg" />
          <PanelBones rows={4} />
        </div>
        <div className="flex flex-col gap-4 lg:basis-2/5">
          <Bone className="h-8 w-56" />
          <Bone className="h-24 rounded-lg" />
          <Bone className="h-24 rounded-lg" />
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <Bone className="h-4 w-44" />
        <Bone className="h-36 rounded-lg" />
      </div>
    </SkeletonPage>
  )
}

/** Objetivos: the active cards on the left, the summary beside them. */
export function ObjectivesSkeleton() {
  return (
    <SkeletonPage className="p-4 md:p-8 lg:max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Bone className="h-8 w-36" />
        <div className="flex gap-2">
          <Bone className="h-9 w-48" />
          <Bone className="h-9 w-32" />
        </div>
      </div>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="order-2 flex flex-col gap-3 lg:order-none">
          <Bone className="h-4 w-32" />
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-3 p-4">
                <Bone className="h-5 w-2/3" />
                <div className="flex items-end justify-between gap-4">
                  <Bone className="h-8 w-16" />
                  <Bone className="h-10 w-1/2" />
                </div>
                <Bone className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
        <Bone className="order-1 h-5 w-3/4 lg:order-none" />
      </div>
    </SkeletonPage>
  )
}

/** One objective: stats, the Ritmo chart, the weekly bars and this week's goals. */
export function ObjectiveDetailSkeleton() {
  return (
    <SkeletonPage className="p-8">
      <Bone className="mb-4 h-4 w-40" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <Bone className="h-8 w-2/3" />
        <Bone className="h-9 w-36" />
      </div>
      <div className="mb-6 flex flex-col gap-2">
        <Bone className="h-4 w-1/2" />
        <Bone className="h-2.5 w-full rounded-full" />
      </div>
      <div data-skeleton="ritmo" className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-4">
        <Bone className="h-5 w-24" />
        <Bone className="h-4 w-3/4" />
        <Bone className="h-48" />
      </div>
      <Bone className="mb-6 h-48 rounded-lg" />
      <PanelBones rows={3} />
    </SkeletonPage>
  )
}

/** Any other page: a heading and a couple of cards. */
export function PageSkeleton() {
  return (
    <SkeletonPage className="p-8">
      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-40" />
        <Bone className="h-28 rounded-lg" />
        <Bone className="h-28 rounded-lg" />
      </div>
    </SkeletonPage>
  )
}
