# App Pessoal de Metas Diárias/Semanais — Design

Data: 2026-07-29

## Contexto e objetivo

App pessoal para visão interativa e clara de objetivos diários e semanais. Uso diário, de longo prazo — vai se tornar parte da rotina do usuário. Projeto também serve como prática deliberada de uma stack diferente da usada no trabalho (Java/Spring Boot), com foco em React/TypeScript e no "lado mercado/frontend moderno".

## Stack

- **Frontend + Backend:** Next.js (React + TypeScript), fullstack via API routes / server actions
- **ORM:** Prisma
- **Banco de dados:** PostgreSQL, local via Docker Desktop (Docker Compose) em desenvolvimento
- **Gerenciador de pacotes:** npm
- **Estilo/UI:** Tailwind CSS + shadcn/ui (componentes copiados para o código, não uma dependência black-box)
- **Gráficos:** Recharts
- **Deploy futuro:** Vercel (free tier)

### Por que essa stack

- Prioridade definida: praticar algo novo, saindo de Java/Spring Boot em direção a React/TypeScript.
- Next.js fullstack reduz atrito de manutenção a longo prazo frente a um backend separado (ex: FastAPI): um único codebase, sem CORS, sem gerenciar dois deploys — relevante porque o app será usado diariamente por muito tempo.
- Hospedagem mais simples (Vercel free tier, sem backend "dormindo" por inatividade).
- Caminho mais direto para um PWA no futuro (acesso via celular).
- O resultado visual/interatividade não depende do backend, e sim do React e das bibliotecas de UI/gráfico — essas poderiam ser usadas com qualquer backend. A escolha do Next.js foi por arquitetura/conveniência, não pela aparência final.
- Análise de dados fica em aberto para o futuro: dá para plugar depois um serviço Python separado (ex: FastAPI ou script) lendo diretamente do mesmo Postgres, sem reescrever o app. O schema é desenhado desde já pensando em consultas históricas (ex: "cumprimento de metas por período").

### Autenticação

Sem autenticação na v1 — uso é individual e o app não será exposto com dados sensíveis de terceiros. O schema já é preparado para receber um `userId` no futuro sem precisar ser redesenhado (todas as tabelas ficam sob um `Objective` raiz, então basta adicionar `userId` ali quando for necessário).

## Modelo de dados

Hierarquia: **Objetivo (longo prazo) → Meta Semanal → Tarefa Diária**, com progresso agregado subindo naturalmente pela cadeia.

Convenção de semana: **segunda-feira a domingo** (`weekStart` = segunda, `weekEnd` = domingo).

```prisma
model Objective {
  id          String        @id @default(cuid())
  title       String
  description String?
  startDate   DateTime
  targetDate  DateTime?
  status      Status        @default(ACTIVE)
  weeklyGoals WeeklyGoal[]
  createdAt   DateTime      @default(now())
}

model WeeklyGoal {
  id           String      @id @default(cuid())
  title        String
  objective    Objective   @relation(fields: [objectiveId], references: [id])
  objectiveId  String
  weekStart    DateTime
  weekEnd      DateTime
  status       Status      @default(ACTIVE)
  dailyTasks   DailyTask[]
}

model DailyTask {
  id           String      @id @default(cuid())
  title        String
  weeklyGoal   WeeklyGoal  @relation(fields: [weeklyGoalId], references: [id])
  weeklyGoalId String
  date         DateTime
  completed    Boolean     @default(false)
  completedAt  DateTime?
}

enum Status {
  ACTIVE
  COMPLETED
  ABANDONED
}
```

Consultas que esse modelo já suporta de forma simples:
- Tarefas do dia (`WHERE date = hoje`)
- Progresso semanal (agregando `DailyTask.completed` por `WeeklyGoal`)
- Progresso do objetivo (agregando metas semanais concluídas)

## MVP

- CRUD de Objetivo → Meta Semanal → Tarefa Diária, com navegação entre níveis
- Marcar tarefas como concluídas
- Visão do dia (tarefas de hoje) com toggle de concluído
- Visão da semana (lista/calendário com progresso agregado)
- Gráfico simples de progresso por objetivo (Recharts)
- Sem login

## Fora do MVP (evoluções futuras possíveis)

- Streaks/consistência
- Histórico avançado
- Multiusuário/login completo (senha única via env var + cookie de sessão, ou algo mais robusto)
- Camada analítica em Python lendo do mesmo Postgres
- PWA

## Localização e setup do projeto

- Pasta: `C:\Users\João Vítor Mamede\projects\metas-app` (novo repositório git)
- Postgres de desenvolvimento via Docker Compose — requer Docker Desktop instalado manualmente antes do primeiro `docker compose up`

## Roadmap de implementação

1. **Setup:** `create-next-app` (TypeScript, Tailwind, App Router), Prisma, shadcn/ui, Docker Compose para Postgres local
2. **CRUD básico:** Objetivos → Metas Semanais → Tarefas Diárias, com navegação entre níveis
3. **Visão do dia:** tela principal com tarefas de hoje e toggle de concluído
4. **Visão da semana:** lista/calendário com progresso agregado
5. **Gráfico de progresso:** por objetivo, usando Recharts
6. **Polish visual:** layout, cores, responsividade
