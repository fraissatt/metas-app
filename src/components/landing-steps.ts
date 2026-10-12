import { CalendarDays, ListChecks, Target, type LucideIcon } from 'lucide-react'
import type { LandingColor } from '@/components/landing-card'

export type FlowStep = { icon: LucideIcon; title: string; text: string; color: LandingColor }

export const STEPS: readonly FlowStep[] = [
  { icon: Target, title: 'Objetivo', text: 'Defina o destino, com prazo e progresso.', color: 'green' },
  {
    icon: CalendarDays,
    title: 'Meta da semana',
    text: 'Divida o objetivo em metas para cada semana. Elas podem se repetir.',
    color: 'blue',
  },
  { icon: ListChecks, title: 'Tarefa do dia', text: 'Veja no Hoje o passo certo para cada dia.', color: 'amber' },
]
