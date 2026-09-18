---
name: deploy-seguro
description: Ritual obrigatório antes de qualquer deploy, push para main, build de produção ou mudança de configuração da Netlify. Use sempre que a tarefa envolver publicar, subir, fazer deploy, dar push, mexer em netlify.toml, variáveis de ambiente da Netlify, ou quando o usuário perguntar sobre créditos e custos de build.
---

# Deploy seguro — proteger os créditos da Netlify

Os créditos do plano Free já foram zerados uma vez neste projeto. Cada build de produção consome minuto de build. O dono do projeto não é programador e não consegue prever sozinho o que dispara custo — **é responsabilidade do agente avisar antes, não depois**.

## Regra de ouro
**Deploy de produção não é ferramenta de teste.** Se a pergunta for "será que funcionou?", a resposta é teste local, não push para `main`.

## Antes de qualquer push ou deploy, verificar nesta ordem

1. **Em que branch estou?**
   `main` = produção, dispara build na Netlify.
   `development` = trabalho normal. Todo desenvolvimento acontece aqui.
   Se estiver em `main` sem motivo explícito, mudar para `development` antes de commitar.

2. **Isso podia ter sido testado localmente?**
   Testa local (sem gastar crédito): HTML/CSS/JS, lógica de front, consultas ao Supabase, regras de entitlement, progresso, migrations, schema, Edge Functions via `supabase functions serve`.
   Precisa mesmo de URL externa: apenas webhook real chegando de fora (Hubla) e teste em dispositivo de terceiro.

3. **Dá para agrupar?**
   Três ajustes pequenos = um build, não três. Se há mais coisa na fila, esperar e subir junto.

4. **Avisar o custo em voz alta.**
   Antes de executar, dizer: o que vai ser publicado, em qual branch, e que isso consome um build. Esperar o "pode".

## Nunca fazer sem confirmação explícita
- `git push origin main` ou qualquer push que atinja a branch de produção
- Mudar plano, billing ou método de pagamento na Netlify
- Criar site novo na Netlify — a decisão do projeto é **um único site**, com `development` para teste e `main` para produção
- Alterar `netlify.toml` em `main`
- Habilitar build automático em branch que não tinha

## Se o assunto for "acabaram os créditos"
Não sugerir criar conta nova nem site novo para contornar. As saídas legítimas são: reduzir frequência de build, agrupar mudanças, testar local, ou assumir o plano pago (~US$9/mês) como decisão consciente. Apresentar o custo, deixar a escolha com ele.

## Contexto técnico do build
`netlify.toml` roda `node scripts/build.mjs` e publica `dist/`. Ou seja: **existe etapa de build de verdade** — não é publicação estática direta. Quebrar o `build.mjs` derruba o deploy inteiro. Rodar o build localmente antes de subir é barato e evita um build perdido.
