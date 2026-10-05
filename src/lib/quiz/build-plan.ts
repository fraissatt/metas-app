import { addDays, addMonths, startOfDay } from 'date-fns'
import { getWeekBounds } from '@/lib/dates'
import { WEEKDAYS, type Focus, type Obstacle, type QuizAnswers } from './definition'

export type PlanWeek = {
  weekStart: Date
  weekEnd: Date
  recurring: boolean
  tasks: Array<{ title: string; date: Date }>
}

export type Plan = {
  objective: { title: string; startDate: Date; targetDate: Date }
  weeklyGoal: { title: string }
  weeks: PlanWeek[]
  tip: string
}

type Template = {
  objective: string
  weeklyGoal: (days: number) => string
  tasks: string[]
  shortTasks: string[]
}

const times = (n: number) => (n === 1 ? '1 vez' : `${n} vezes`)
const days = (n: number) => (n === 1 ? '1 dia' : `${n} dias`)

export const TEMPLATES: Record<Focus, Template> = {
  correr: {
    objective: 'Correr uma prova de 10 km',
    weeklyGoal: (n) => `Correr ${times(n)} na semana`,
    tasks: ['Caminhar e correr leve por 20 minutos', 'Corrida contínua de 30 minutos', 'Treino de ritmo: 5 tiros de 1 minuto', 'Corrida longa e tranquila de 45 minutos'],
    shortTasks: ['Caminhada rápida (até 30 min)', 'Corrida leve (até 20 min)', 'Tiros curtos (até 15 min)'],
  },
  forca: {
    objective: 'Ganhar força com treino regular',
    weeklyGoal: (n) => `Treinar força ${times(n)} na semana`,
    tasks: ['Treino de pernas', 'Treino de peito e costas', 'Treino de ombros e braços', 'Treino de corpo inteiro'],
    shortTasks: ['Treino de pernas (até 30 min)', 'Treino de parte superior (até 30 min)', 'Circuito de corpo inteiro (até 20 min)'],
  },
  sono: {
    objective: 'Dormir melhor todas as noites',
    weeklyGoal: (n) => `Cuidar do sono em ${days(n)} da semana`,
    tasks: ['Deitar e acordar no mesmo horário', 'Desligar as telas 1 hora antes de dormir', 'Preparar o quarto: escuro, fresco e silencioso', 'Evitar cafeína depois das 16h'],
    shortTasks: ['Definir o horário de dormir (5 min)', 'Rotina de relaxar antes de deitar (10 min)', 'Arrumar o quarto para dormir (10 min)'],
  },
  alimentacao: {
    objective: 'Comer melhor no dia a dia',
    weeklyGoal: (n) => `Cozinhar e planejar refeições em ${days(n)} da semana`,
    tasks: ['Planejar as refeições da semana', 'Preparar um almoço caseiro', 'Incluir verduras e legumes em duas refeições', 'Deixar lanches saudáveis prontos'],
    shortTasks: ['Escolher as refeições de amanhã (até 10 min)', 'Preparar um lanche saudável (até 15 min)', 'Montar um prato com verduras (até 20 min)'],
  },
  leitura: {
    objective: 'Ler 12 livros',
    weeklyGoal: (n) => `Ler em ${days(n)} da semana`,
    tasks: ['Ler 30 páginas', 'Ler um capítulo inteiro', 'Ler 20 páginas e anotar uma ideia', 'Ler por 40 minutos'],
    shortTasks: ['Ler 10 páginas (até 20 min)', 'Ler um capítulo curto (até 30 min)', 'Ler antes de dormir (até 15 min)'],
  },
  idioma: {
    objective: 'Aprender um novo idioma',
    weeklyGoal: (n) => `Estudar o idioma ${times(n)} na semana`,
    tasks: ['Fazer uma lição do curso', 'Treinar vocabulário com cartões', 'Assistir a um episódio no idioma', 'Praticar conversação por 30 minutos'],
    shortTasks: ['Uma lição rápida (até 15 min)', 'Revisar vocabulário (até 10 min)', 'Ouvir um podcast no idioma (até 20 min)'],
  },
  curso: {
    objective: 'Concluir um curso',
    weeklyGoal: (n) => `Estudar o curso ${times(n)} na semana`,
    tasks: ['Assistir a uma aula', 'Fazer os exercícios da aula', 'Revisar as anotações', 'Resolver um projeto prático'],
    shortTasks: ['Assistir a uma aula curta (até 30 min)', 'Revisar as anotações (até 15 min)', 'Fazer um exercício (até 20 min)'],
  },
  reserva: {
    objective: 'Montar uma reserva de emergência',
    weeklyGoal: (n) => `Cuidar da reserva em ${days(n)} da semana`,
    tasks: ['Definir o valor da reserva e a meta mensal', 'Transferir o valor combinado para a reserva', 'Revisar os gastos da semana', 'Cortar um gasto que não faz falta'],
    shortTasks: ['Anotar os gastos de hoje (até 10 min)', 'Fazer a transferência para a reserva (até 5 min)', 'Revisar um gasto fixo (até 15 min)'],
  },
  dividas: {
    objective: 'Sair das dívidas',
    weeklyGoal: (n) => `Avançar na quitação das dívidas em ${days(n)} da semana`,
    tasks: ['Listar todas as dívidas com valor e juros', 'Escolher a dívida prioritária', 'Negociar uma dívida', 'Pagar uma parcela ou antecipar um valor'],
    shortTasks: ['Listar uma dívida com valor e juros (até 15 min)', 'Conferir os vencimentos (até 10 min)', 'Pedir uma proposta de negociação (até 20 min)'],
  },
  gastos: {
    objective: 'Organizar os gastos do mês',
    weeklyGoal: (n) => `Registrar e revisar os gastos em ${days(n)} da semana`,
    tasks: ['Anotar todos os gastos do dia', 'Classificar os gastos por categoria', 'Montar o orçamento do mês', 'Revisar o orçamento e ajustar'],
    shortTasks: ['Anotar os gastos de hoje (até 10 min)', 'Classificar os gastos (até 15 min)', 'Conferir o saldo do mês (até 10 min)'],
  },
  projeto: {
    objective: 'Tirar um projeto do papel',
    weeklyGoal: (n) => `Trabalhar no projeto ${times(n)} na semana`,
    tasks: ['Escrever o objetivo do projeto em uma frase', 'Quebrar o projeto em etapas', 'Executar a próxima etapa', 'Mostrar o progresso para alguém'],
    shortTasks: ['Escrever o próximo passo (até 10 min)', 'Avançar uma etapa pequena (até 30 min)', 'Anotar ideias do projeto (até 15 min)'],
  },
  promocao: {
    objective: 'Conseguir uma promoção',
    weeklyGoal: (n) => `Investir na promoção em ${days(n)} da semana`,
    tasks: ['Listar suas entregas e resultados recentes', 'Conversar com seu gestor sobre expectativas', 'Estudar uma habilidade pedida no próximo cargo', 'Registrar uma conquista da semana'],
    shortTasks: ['Anotar uma conquista de hoje (até 10 min)', 'Estudar uma habilidade nova (até 30 min)', 'Preparar um tópico para o gestor (até 15 min)'],
  },
  emprego: {
    objective: 'Mudar de emprego',
    weeklyGoal: (n) => `Buscar uma nova vaga em ${days(n)} da semana`,
    tasks: ['Atualizar o currículo e o perfil profissional', 'Enviar candidaturas para vagas interessantes', 'Entrar em contato com alguém da área', 'Treinar respostas de entrevista'],
    shortTasks: ['Atualizar um trecho do currículo (até 20 min)', 'Enviar uma candidatura (até 30 min)', 'Mandar uma mensagem de networking (até 10 min)'],
  },
}

export const TIPS: Record<Obstacle, string> = {
  tempo: 'Como seu obstáculo é tempo, as tarefas são curtas.',
  constancia: 'A meta se repete toda semana para virar hábito.',
  comeco: 'As primeiras tarefas são simples para você começar hoje.',
  motivacao: 'Cada semana cumprida vira uma sequência 🔥 no painel.',
}

export function buildPlan(answers: QuizAnswers, today: Date): Plan {
  const template = TEMPLATES[answers.foco]
  const titles = answers.obstaculo === 'tempo' ? template.shortTasks : template.tasks
  const startDate = startOfDay(today)
  const { weekStart, weekEnd } = getWeekBounds(today)

  const offsets = answers.dias.map((d) => WEEKDAYS.indexOf(d))
  const tasksFor = (start: Date, onlyFrom?: Date) =>
    offsets
      .map((offset) => addDays(start, offset))
      .filter((date) => !onlyFrom || date >= onlyFrom)
      .map((date, i) => ({ title: titles[i % titles.length], date }))

  // Rotation restarts per week, so the full next week must be built from its
  // own list rather than sliced from the partial current week. For the partial
  // week, rotation follows the remaining days in order.
  const current = tasksFor(weekStart, startDate)
  const full = current.length === offsets.length
  const weeks: PlanWeek[] = []

  if (full) {
    weeks.push({ weekStart, weekEnd, recurring: true, tasks: current })
  } else {
    if (current.length > 0) weeks.push({ weekStart, weekEnd, recurring: false, tasks: current })
    const next = getWeekBounds(addDays(weekStart, 7))
    weeks.push({ ...next, recurring: true, tasks: tasksFor(next.weekStart) })
  }

  return {
    objective: {
      title: template.objective,
      startDate,
      targetDate: startOfDay(addMonths(today, answers.prazo)),
    },
    weeklyGoal: { title: template.weeklyGoal(answers.dias.length) },
    weeks,
    tip: TIPS[answers.obstaculo],
  }
}
