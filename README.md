# Metas

Acompanhe **objetivos**, quebre-os em **metas semanais** e execute com **tarefas diárias** — com um
quiz de onboarding que monta o primeiro plano, um funil de conversão medido no próprio app, gráficos de
progresso, sequência de semanas cumpridas e um app instalável (PWA) no celular e no desktop.

**[Ver online](https://metas-app-flax.vercel.app)** · [abrir direto no quiz](https://metas-app-flax.vercel.app/quiz)
· [ver o funil](https://metas-app-flax.vercel.app/funil)

> Entre como visitante para ver uma conta de demonstração com dados prontos (apagada após 24 h sem uso),
> ou crie sua conta com e-mail e senha.

![Tela Hoje, em tema escuro: tarefas do dia agrupadas por meta e o progresso da semana](docs/screenshots/hoje.jpg)

> As imagens deste README foram geradas com dados fictícios.

## Funcionalidades

- **Contas e modo visitante:** login com e-mail e senha (Better Auth) e visitante com dados fictícios
  gerados na hora; cada pessoa só vê os próprios dados.
- **Quiz de onboarding:** cinco perguntas (área, foco, prazo, dias da semana e maior obstáculo), com
  perguntas que mudam conforme a resposta anterior. No fim, o app mostra um plano pronto — objetivo com
  data-meta, meta semanal recorrente e tarefas nos dias escolhidos — e cria tudo com um clique. Abre
  sozinho no primeiro uso e fica disponível na tela de Objetivos.
- **Funil do quiz (`/funil`):** cada passagem pelo quiz grava eventos anônimos (etapa vista, resposta,
  resultado, plano criado). A página mostra passagens, taxa de criação do plano, tempo mediano até o
  plano, um gráfico de quantas pessoas chegaram a cada etapa com o maior abandono destacado, as respostas
  mais escolhidas e as últimas passagens.
- **Hierarquia de três níveis:** objetivo → metas semanais → tarefas diárias, com prazo e acompanhamento
  do tempo decorrido até a data-alvo.
- **Tela Hoje:** as tarefas do dia agrupadas por meta, ao lado do progresso da semana (anel de progresso
  e uma barra por dia). Marcar uma tarefa atualiza a tela na hora, antes de o servidor responder.
- **Metas recorrentes:** uma meta marcada como "repete toda semana" é recriada, com suas tarefas, a cada
  nova semana. Quem volta depois de dias fora vê o que foi planejado e repete a última semana com um clique.
- **Dashboard de objetivos:** média de conclusão das últimas 8 semanas, barras por semana, sequência de
  semanas cumpridas e quanto do prazo já passou.
- **Detalhe do objetivo:** gráfico de conclusão por semana (Recharts), linha do tempo das semanas e as
  metas de cada uma.
- **Progresso acumulado:** um contador que só cresce (tarefas concluídas desde o início) e a constância
  das últimas semanas. A constância é medida em semanas, não em dias seguidos, para não punir quem
  perde um dia.
- **Busca global (`Ctrl K`):** encontra objetivos e metas semanais, de qualquer semana, a partir de
  qualquer tela.
- **Tema claro e escuro** e **fundo interativo** (aurora ou grade de pontos, desenhado em canvas).
- **Instalável como app (PWA)** e com layout próprio para celular, com navegação inferior.

## Capturas de tela

### Objetivos

![Dashboard de objetivos com média, semanas cumpridas e sequências](docs/screenshots/objetivos.jpg)

### Detalhe de um objetivo

![Detalhe do objetivo com o gráfico de conclusão semanal](docs/screenshots/objetivo-detalhe.jpg)

### Funil do quiz (`/funil`)

![Funil do quiz com passagens, taxa de criação do plano, tempo até o plano e o abandono por etapa, com o maior abandono destacado](docs/screenshots/funil.jpg)

### Tema claro

![Tela Hoje no tema claro](docs/screenshots/tema-claro.jpg)

### Busca (`Ctrl K`)

![Paleta de busca com resultados](docs/screenshots/busca.jpg)

### No celular

![Telas Hoje e Objetivos no celular](docs/screenshots/mobile.png)

## Instalar como app (PWA)

O Metas tem manifest, ícones e atalhos (Hoje e Objetivos), então pode ser instalado:

- **Chrome / Edge (desktop):** ícone de instalar na barra de endereço.
- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone / iPad (Safari):** **Compartilhar** → **Adicionar à Tela de Início**.

Instalado, ele abre em tela cheia, sem a barra do navegador. A instalação exige HTTPS (ou `localhost`).
O app **não funciona offline** de propósito: os dados ficam no Postgres, atrás de Server Actions, e
guardar páginas em cache mostraria metas desatualizadas e quebraria as gravações.

## Stack

- [Next.js](https://nextjs.org) (App Router, Server Components e Server Actions) e React 19
- [Better Auth](https://www.better-auth.com/) para contas e sessões
- [Prisma](https://www.prisma.io/) + Postgres
- [Tailwind CSS](https://tailwindcss.com/) 4 + [shadcn/ui](https://ui.shadcn.com/) (sobre
  [Base UI](https://base-ui.com/), não Radix)
- [Recharts](https://recharts.org/) para os gráficos e [Motion](https://motion.dev/) para as animações
- [Vitest](https://vitest.dev/) + Testing Library
- Deploy na [Vercel](https://vercel.com/) com Postgres na [Neon](https://neon.com/); as migrations rodam a
  cada deploy (script `vercel-build`)

## Decisões de projeto

- **Testes contra um Postgres de verdade.** A camada de dados é testada com o banco `metas_app_test`, sem
  mocks do Prisma. Os componentes têm testes com Testing Library. A suíte tem mais de 450 testes.
- **Isolamento por usuário testado.** Toda consulta filtra pelo dono, e registros de outra pessoa se
  comportam como inexistentes; cada módulo de dados tem testes garantindo isso.
- **Tema vindo do servidor.** O tema fica em um cookie e a página já sai renderizada com ele; a cor da
  barra do navegador (`theme-color`) vem da mesma fonte da paleta.
- **Cores só por tokens.** Um teste reprova qualquer cor hexadecimal fixa nos componentes (ela ignoraria o
  tema ativo), e outros testes garantem contraste WCAG AA nas duas paletas.
- **Acessibilidade.** Link "Pular para o conteúdo", atributos ARIA, gráficos com tooltip acessível por
  foco e animações que respeitam `prefers-reduced-motion`.
- **Analytics próprio, sem serviço externo.** O funil é medido com uma tabela de eventos no próprio
  Postgres, com um identificador anônimo por passagem e nenhum dado pessoal. Os eventos são enviados em
  segundo plano e validados no servidor; uma falha na medição nunca trava o quiz.
- **Estado derivado, não armazenado.** Uma meta semanal está cumprida quando todas as suas tarefas estão
  feitas; isso é calculado na leitura, não gravado.
- **Cada funcionalidade tem spec e plano.** O raciocínio por trás das decisões está em
  [`docs/superpowers/specs`](docs/superpowers/specs) e [`docs/superpowers/plans`](docs/superpowers/plans).

## Como rodar

### Pré-requisitos

- [Node.js](https://nodejs.org/) 20.9 ou superior
- [Docker](https://www.docker.com/) (para subir o Postgres localmente com Docker Compose)
- npm (o projeto usa só npm — não use yarn, pnpm nem bun)

### Passo a passo

1. Suba o Postgres:

   ```bash
   docker compose up -d
   ```

   Isso inicia um contêiner Postgres 16 em `localhost:5433` (remapeado da porta padrão `5432` para não
   conflitar com um Postgres que você já tenha rodando) e cria o banco do app (`metas_app`) e o banco de
   testes (`metas_app_test`).

2. Copie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   ```

   A `DATABASE_URL` padrão já corresponde ao Docker Compose acima, então não precisa editar nada para
   desenvolver localmente. O `.env.example` inclui `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e
   `FUNNEL_PUBLIC`; a secret deve ser alterada para um valor único.

3. Instale as dependências:

   ```bash
   npm install
   ```

   Isso também roda `prisma generate`, pelo script `postinstall`.

4. Aplique as migrations:

   ```bash
   npx prisma migrate dev
   ```

5. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000).

## Testes

Os testes rodam contra um Postgres de verdade (`metas_app_test`, criado pelo Docker Compose acima), e não
contra um Prisma mockado — não há testes unitários com acesso a dados falso, só testes de integração com
o banco.

1. Garanta que o Postgres está rodando (`docker compose up -d`).

2. Crie o arquivo `.env.test` na raiz, apontando para o banco de testes (ele é ignorado pelo git, então
   não vem no clone):

   ```bash
   DATABASE_URL="postgresql://metas:metas@localhost:5433/metas_app_test"
   BETTER_AUTH_SECRET="test-secret"
   ```

3. Aplique as migrations no banco de testes:

   ```bash
   npm run test:migrate
   ```

4. Rode a suíte:

   ```bash
   npm run test
   ```

   Ou em modo watch:

   ```bash
   npm run test:watch
   ```

## Outros scripts

- `npm run build` — build de produção.
- `npm run start` — roda o build de produção.
- `npm run lint` — roda o linter.
- `npm run db:migrate` — aplica as migrations pendentes no banco apontado por `DATABASE_URL` (não
  interativo; use `npx prisma migrate dev` ao desenvolver novas migrations).

## Licença

[MIT](LICENSE).
