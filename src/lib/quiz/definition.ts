// Pure quiz definition: no next/* and no Prisma, so client components can
// import it. Step ids and option ids are stable strings; analytics and tests
// key on them.

export type StepId = 'area' | 'foco' | 'prazo' | 'dias' | 'obstaculo'

export const STEP_ORDER: readonly StepId[] = ['area', 'foco', 'prazo', 'dias', 'obstaculo']

export type Area = 'saude' | 'estudos' | 'financas' | 'carreira'
export type Focus =
  | 'correr' | 'forca' | 'sono' | 'alimentacao'
  | 'leitura' | 'idioma' | 'curso'
  | 'reserva' | 'dividas' | 'gastos'
  | 'projeto' | 'promocao' | 'emprego'
export type Weekday = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'
export type Obstacle = 'tempo' | 'constancia' | 'comeco' | 'motivacao'
export type Prazo = 1 | 3 | 6 | 12

export type QuizAnswers = {
  area: Area
  foco: Focus
  prazo: Prazo
  dias: Weekday[]
  obstaculo: Obstacle
}

export type QuizOption = { id: string; label: string; emoji?: string }

export const WEEKDAYS: readonly Weekday[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
}

const AREA_OPTIONS: QuizOption[] = [
  { id: 'saude', label: 'Saúde e corpo', emoji: '🏃' },
  { id: 'estudos', label: 'Estudos', emoji: '📚' },
  { id: 'financas', label: 'Finanças', emoji: '💰' },
  { id: 'carreira', label: 'Carreira e projetos', emoji: '🚀' },
]

const FOCO_BY_AREA: Record<Area, { title: string; options: Array<QuizOption & { id: Focus }> }> = {
  saude: {
    title: 'Na saúde, qual é o seu foco?',
    options: [
      { id: 'correr', label: 'Correr uma prova' },
      { id: 'forca', label: 'Ganhar força' },
      { id: 'sono', label: 'Dormir melhor' },
      { id: 'alimentacao', label: 'Comer melhor' },
    ],
  },
  estudos: {
    title: 'Nos estudos, qual é o seu foco?',
    options: [
      { id: 'leitura', label: 'Ler mais livros' },
      { id: 'idioma', label: 'Aprender um idioma' },
      { id: 'curso', label: 'Fazer um curso' },
    ],
  },
  financas: {
    title: 'Nas finanças, qual é o seu foco?',
    options: [
      { id: 'reserva', label: 'Montar uma reserva' },
      { id: 'dividas', label: 'Sair das dívidas' },
      { id: 'gastos', label: 'Organizar os gastos' },
    ],
  },
  carreira: {
    title: 'Na carreira, qual é o seu foco?',
    options: [
      { id: 'projeto', label: 'Tirar um projeto do papel' },
      { id: 'promocao', label: 'Conseguir uma promoção' },
      { id: 'emprego', label: 'Mudar de emprego' },
    ],
  },
}

const PRAZO_OPTIONS: QuizOption[] = [
  { id: '1', label: '1 mês' },
  { id: '3', label: '3 meses' },
  { id: '6', label: '6 meses' },
  { id: '12', label: '1 ano' },
]

const OBSTACULO_OPTIONS: QuizOption[] = [
  { id: 'tempo', label: 'Falta de tempo' },
  { id: 'constancia', label: 'Falta de constância' },
  { id: 'comeco', label: 'Não sei por onde começar' },
  { id: 'motivacao', label: 'Perco a motivação' },
]

const DIAS_OPTIONS: QuizOption[] = WEEKDAYS.map((id) => ({ id, label: WEEKDAY_LABELS[id] }))

export const AREA_IDS = Object.keys(FOCO_BY_AREA) as readonly Area[]

// Every focus option across the areas, in definition order.
export const ALL_FOCUS_OPTIONS: readonly QuizOption[] = AREA_IDS.flatMap((area) => FOCO_BY_AREA[area].options)

export function isArea(value: unknown): value is Area {
  return typeof value === 'string' && Object.hasOwn(FOCO_BY_AREA, value)
}

export function getStep(
  stepId: StepId,
  answersSoFar: Partial<QuizAnswers>,
): { id: StepId; title: string; multiple: boolean; options: QuizOption[] } {
  switch (stepId) {
    case 'area':
      return { id: 'area', title: 'O que você quer conquistar?', multiple: false, options: AREA_OPTIONS }
    case 'foco': {
      // Without an area there is nothing to branch on; fall back to the first
      // area so the step is still renderable instead of throwing.
      const area = isArea(answersSoFar.area) ? answersSoFar.area : 'saude'
      const { title, options } = FOCO_BY_AREA[area]
      return { id: 'foco', title, multiple: false, options }
    }
    case 'prazo':
      return { id: 'prazo', title: 'Em quanto tempo?', multiple: false, options: PRAZO_OPTIONS }
    case 'dias':
      return {
        id: 'dias',
        title: 'Em quais dias você pode se dedicar?',
        multiple: true,
        options: DIAS_OPTIONS,
      }
    case 'obstaculo':
      return { id: 'obstaculo', title: 'O que mais te atrapalha?', multiple: false, options: OBSTACULO_OPTIONS }
  }
}

export function optionLabel(stepId: StepId, value: string | number): string {
  const id = String(value)
  if (stepId === 'foco') {
    for (const { options } of Object.values(FOCO_BY_AREA)) {
      const found = options.find((o) => o.id === id)
      if (found) return found.label
    }
    return id
  }
  return getStep(stepId, {}).options.find((o) => o.id === id)?.label ?? id
}

const OBSTACLES: readonly string[] = OBSTACULO_OPTIONS.map((o) => o.id)
const PRAZOS: readonly number[] = [1, 3, 6, 12]

function invalid(): never {
  throw new Error('Respostas inválidas')
}

export function validateAnswers(input: unknown): QuizAnswers {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) invalid()
  const raw = input as Record<string, unknown>

  const { area, foco, prazo, dias, obstaculo } = raw
  if (!isArea(area)) invalid()
  if (!FOCO_BY_AREA[area].options.some((o) => o.id === foco)) invalid()
  if (typeof prazo !== 'number' || !PRAZOS.includes(prazo)) invalid()
  if (typeof obstaculo !== 'string' || !OBSTACLES.includes(obstaculo)) invalid()
  if (!Array.isArray(dias) || dias.length === 0) invalid()
  if (!dias.every((d) => typeof d === 'string' && (WEEKDAYS as readonly string[]).includes(d))) invalid()

  const chosen = new Set<string>(dias)
  return {
    area,
    foco: foco as Focus,
    prazo: prazo as Prazo,
    dias: WEEKDAYS.filter((d) => chosen.has(d)),
    obstaculo: obstaculo as Obstacle,
  }
}
