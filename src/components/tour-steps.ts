import { CalendarDays, ListChecks, Palette, Search, Target, type LucideIcon } from 'lucide-react'
import type { LandingColor } from '@/components/landing-card'

export type TourStep = { id: string; title: string; text: string; icon: LucideIcon; color: LandingColor }

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'objetivos',
    title: 'Objetivos',
    text: 'Tudo começa com um objetivo: o destino, com prazo e progresso.',
    icon: Target,
    color: 'green',
  },
  {
    id: 'metas',
    title: 'Metas semanais',
    text: 'Cada objetivo se divide em metas por semana. As metas podem se repetir toda semana.',
    icon: CalendarDays,
    color: 'blue',
  },
  {
    id: 'tarefas',
    title: 'Tarefas diárias',
    text: 'As tarefas de cada meta aparecem no Hoje, no dia em que você vai fazê-las.',
    icon: ListChecks,
    color: 'amber',
  },
  {
    id: 'busca',
    title: 'Busca',
    text: 'Aperte Ctrl K para achar objetivos e metas de qualquer semana.',
    icon: Search,
    color: 'violet',
  },
  {
    id: 'aparencia',
    title: 'Aparência',
    text: 'No menu da sua conta você troca o tema e o fundo, e pode rever este tour.',
    icon: Palette,
    color: 'cyan',
  },
]
