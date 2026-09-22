---
name: deploy-seguro
description: Ritual obrigatório antes de qualquer deploy, push para main, build de produção ou mudança de configuração da Netlify. Use sempre que a tarefa envolver publicar, subir, fazer deploy, dar push, mexer em netlify.toml, variáveis de ambiente da Netlify, ou quando o usuário perguntar sobre créditos e custos de build.
---

# Deploy seguro — proteger os créditos da Netlify

Os créditos do plano Free já foram zerados uma vez neste projeto. Cada build de produção consome minuto de build. O dono do projeto não é programador e não consegue prever sozinho o que dispara custo — **é responsabilidade do agente avisar antes, não depois**.

## Regra de ouro
**Deploy de produção não é ferramenta de teste.** Se a pergunta for "será que funcionou?", a resposta é teste local, não push para `main`.

## ⚠️ O banco TAMBÉM é produção
Mudança no Supabase não gasta crédito da Netlify, mas **chega na cliente na hora, sem passar por deploy nenhum**. Não confundir "não custa build" com "é seguro".

Isso já deu errado em 2026-09-18: uma campanha de pop-up foi ligada (`enabled = true`) enquanto a interface que a renderiza direito ainda estava só na máquina. O front antigo em produção passou a exibir o pop-up na versão feia. Só não atingiu cliente real por sorte.

**Antes de ligar qualquer coisa no banco que a cliente vê, perguntar: o front que renderiza isso já está publicado?** Se a resposta for não, a ordem é publicar primeiro e ligar depois.

Vale para: `member_offer_campaigns.enabled`, `member_survey_campaigns.enabled`, `products.enabled`, `checkout_url`, `content_url` e qualquer texto que apareça na tela.

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
- Criar site novo na Netlify — já existem TRÊS projetos e essa é a conta fechada: `7madrugadas` (produção, https://setemadrugadas.com.br), `7-amens-app-v2` (congelado desde 21/09, **não constrói mais**) e `7sacredprayers` (versão americana)
- **Religar os builds do `7-amens-app-v2`** (*Build status → Active builds*). Ele foi desligado em 21/09 de propósito: era uma cópia idêntica da produção e dobrava o custo de cada publicação. Publicar custa **1 build** hoje; religar volta a custar 2.
- Alterar `netlify.toml` em `main`
- Habilitar build automático em branch que não tinha

## Se o assunto for "acabaram os créditos"
Não sugerir criar conta nova nem site novo para contornar. As saídas legítimas são: reduzir frequência de build, agrupar mudanças, testar local, ou assumir o plano pago (~US$9/mês) como decisão consciente. Apresentar o custo, deixar a escolha com ele.

## Se der errado: rollback sem gastar crédito
1. Projeto **`7madrugadas`** na Netlify → aba **Deploys**.
2. Achar o último deploy que estava bom (pela data/hora).
3. **"Publish deploy"** nele. Volta em segundos, sem build novo, sem consumir crédito.
4. Investigar a causa depois, **no teste local** — não existe mais ambiente de validação na Netlify.

Anotar a data e o ID do deploy bom **antes** de promover. O ponto de retorno não é um commit: `6c90670` já contém o login.

## Contexto técnico do build
`netlify.toml` roda `node scripts/build.mjs` e publica `dist/`. Ou seja: **existe etapa de build de verdade** — não é publicação estática direta. Quebrar o `build.mjs` derruba o deploy inteiro. Rodar o build localmente antes de subir é barato e evita um build perdido.
