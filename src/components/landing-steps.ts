import { CalendarDays, ListChecks, Target, type LucideIcon } from 'lucide-react'
import type { LandingColor } from '@/components/landing-card'

export type FlowStep = {
  icon: LucideIcon
  title: string
  text: string
  /** The screen of the app this step is about. */
  screen: string
  /** Two things the screen does. */
  points: readonly [string, string]
  color: LandingColor
}

export const STEPS: readonly FlowStep[] = [
  {
    icon: Target,
    title: 'Objetivo',
    text: 'Defina o destino, com prazo e progresso.',
    screen: 'Tela: Objetivos',
    points: ['Prazo e tempo decorrido', 'Semanas cumpridas e sequência'],
    color: 'green',
  },
  {
    icon: CalendarDays,
    title: 'Meta da semana',
    text: 'Divida o objetivo em metas para cada semana. Elas podem se repetir.',
    screen: 'Tela: Semana',
    points: ['Metas que se repetem toda semana', 'Progresso dia a dia'],
    color: 'blue',
  },
  {
    icon: ListChecks,
    title: 'Tarefa do dia',
    text: 'Veja no Hoje o passo certo para cada dia.',
    screen: 'Tela: Hoje',
    points: ['Marque no dia e veja o progresso mudar', 'Uma tela só para o que fazer hoje'],
    color: 'amber',
  },
]
