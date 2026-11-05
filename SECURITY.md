# Política de segurança

## Versões com correções

Só a versão mais recente, publicada em https://metas-app-flax.vercel.app (branch `master`), recebe correções de segurança.

## Como relatar uma vulnerabilidade

Não abra uma issue pública. Use o relato privado do GitHub:

1. Acesse a aba **Security** do repositório.
2. Clique em **Report a vulnerability**.
3. Descreva o problema, os passos para reproduzir e o impacto que você enxerga.

A resposta inicial vem em até 7 dias. Depois da correção publicada, o relato pode ser divulgado com crédito a quem encontrou, se a pessoa quiser.

Testes contra o site no ar devem usar só contas suas (ou o modo visitante) e não podem degradar o serviço para outras pessoas: nada de testes de carga, varredura em massa ou acesso a dados de terceiros.

## O que o app já faz

- **Contas e sessões:** Better Auth com e-mail e senha (mínimo de caracteres no cadastro). Cookies de sessão `HttpOnly`, `Secure` em produção e `SameSite=Lax`. Limite de tentativas de login guardado no banco, para valer entre instâncias da Vercel.
- **Isolamento entre usuários:** toda consulta e ação filtra pelo dono (`src/lib/owned.ts`). Um registro de outra pessoa responde como "não encontrado", para que ids não possam ser sondados.
- **Server Actions tratadas como endpoints públicos:** sessão conferida no servidor em cada ação, textos com tamanho máximo, datas validadas, listas com teto.
- **Visitantes:** conta temporária própria, apagada após 24 h sem uso, no máximo cerca de 200 ao mesmo tempo, criação limitada por IP e no total.
- **Lembrete diário:** só aceita endereços dos serviços de push dos navegadores, no máximo 10 aparelhos por conta; a rota do cron exige `CRON_SECRET`.
- **Cabeçalhos HTTP:** `Content-Security-Policy` (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS.
- **Dependências:** Dependabot semanal para npm e GitHub Actions, com PRs para `develop`; `npm audit` revisado nas releases.
- **Segredos:** só em variáveis de ambiente da Vercel, nunca no repositório (`.env*` no `.gitignore`, só `.env.example` versionado).
