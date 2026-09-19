---
name: regras-de-acesso
description: Regras de negócio de login, entitlements, reembolso e liberação de conteúdo do app 7 Améns. Use sempre que a tarefa envolver login, acesso, quem pode ver o quê, produtos, upsell, card bloqueado ou desbloqueado, reembolso, webhook da Hubla, ou qualquer mexida nas tabelas customers, products, entitlements, member_sessions e prayer_progress.
---

# Regras de acesso — 7 Améns

Estas regras são decisão de negócio tomada pelo dono do projeto. **Não improvisar, não "melhorar" por conta própria, não aplicar boas práticas genéricas de SaaS por cima delas.** Se algo aqui parecer errado, apontar e perguntar — nunca mudar sozinho.

## Identidade e login

**O e-mail é a identidade.** A cliente digita o mesmo e-mail que usou na compra e entra. Sem senha, sem OTP, sem código no e-mail, sem confirmação.

O risco de compartilhamento de acesso **é conhecido e aceito conscientemente**. O público é mulher católica brasileira 45+, e a fricção de autenticação tradicional foi julgada pior para o negócio do que o compartilhamento. Não propor login com senha, magic link ou 2FA como "correção" — já foi decidido.

O que já existe no banco para isso:
- `customers` — e-mail normalizado (minúsculo, sem espaços) e validado por regex. O e-mail é `unique`.
- `member_sessions` — sessões opacas de 90 dias. **Só o hash do token é guardado** (`token_hash`, sha-256 em hex). Acesso é revalidado a cada consulta.
- `member_login_limits` + função `allow_member_login(bucket_key)` — limite de 20 tentativas por janela de 10 minutos.

## Entitlements — quem pode o quê

Modelo: `products` (catálogo) + `entitlements` (o que cada cliente possui). **Nunca reduzir isso a uma coluna `tem_acesso = true`** — o catálogo vai crescer (novenas, jornadas de 21/30 dias, materiais).

- **Produto principal:** `key = 'principal'`. Só quem o tem **ativo** entra no app. Libera todo o conteúdo base atual. Acesso **vitalício**.
- **Extras:** entitlements independentes (`upsell_01`, `upsell_02`, `upsell_03` já semeados). A cliente pode ter principal + extra A sem ter extra B.
- `entitlements.status` aceita `'active'`, `'refunded'`, `'revoked'`. Chave primária é `(customer_id, product_key)`.

## Reembolso — comportamento exato

| Situação | Resultado |
|---|---|
| Reembolso do **principal** | Perde o acesso ao app inteiro |
| Reembolso de um **extra** | Continua no app, perde só aquele extra |
| Compra de um extra Y | Libera Y **e para de oferecer Y para ela** |

Reembolso **não apaga a linha** — muda `status` para `'refunded'`. Preserva histórico e mantém o webhook idempotente.

## ⚠️ HOJE o app NÃO bloqueia nada por produto

**Quem compra o produto principal tem acesso total ao aplicativo.** Os entitlements de upsell existem hoje apenas para a operação **saber quem comprou o quê** — não gateiam conteúdo.

Verificado no código em 2026-09-18:
- O único bloqueio do app é o login: `products.includes('principal')` na `member-api`.
- Existe **uma única** checagem de produto no frontend inteiro, em `js/member.js`, e ela só troca o texto de um card extra na home ("Acessar meu conteúdo" vs "Conhecer este conteúdo"). Nunca esconde nem bloqueia conteúdo.
- Os três upsells estão com `enabled = false` e `checkout_url`/`content_url` nulos, então nem chegam a renderizar.

**Nunca implementar bloqueio de conteúdo por upsell sem o Caio pedir explicitamente.** Liberar ou revogar um upsell hoje não muda nada para a cliente, e isso é intencional.

## Cards da Home — desenho FUTURO, não implementado

Quando o Caio decidir ativar, a ideia registrada é: tem direito → entra; não tem → "Desbloquear", transformando o app em consumo **e** venda de complementos sem mandar a cliente para fora. Depende de ativar o produto e preencher `checkout_url` e `content_url`.
Cards atuais: 7 Orações Sagradas · Mensagem do Dia · Pai Nosso · Novena Desatadora dos Nós · Lojinha.

## Ofertas dentro do app

`member_offer_campaigns` + `member_offer_events` + função `claim_member_offer(customer_id)`.
Uma campanha só aparece se estiver `enabled`, tiver `target_url` https, a cliente tiver **todos** os `required_product_keys` e **nenhum** dos `excluded_product_keys`. O registro de exibição é **no servidor**, para a mesma oferta não repetir em outro navegador ou aparelho.

## Progresso

`prayer_progress`, chave `(customer_id, prayer_key)`. Formato de `prayer_key` validado por regex: `principal:0-7` ou `desatadora:1-9`.

**Progresso vive na nuvem, não em `localStorage`.** Trocou de aparelho, continua de onde parou.

Regra da jornada: **perdeu um dia, não reinicia e não faz duas orações no mesmo dia.** Continua do ponto onde parou, no dia seguinte.

## Segurança do banco — o que não pode quebrar

Todas as tabelas têm **RLS ligado**, com `anon` e `authenticated` revogados e acesso exclusivo de `service_role`. Toda leitura e escrita passa pela Edge Function `member-api`.

Isso significa:
- **Nunca** expor a `service_role key` no frontend. O front fala com a Edge Function, não com o banco.
- **Nunca** criar policy para `anon` ou `authenticated` "para facilitar". Quebra o modelo inteiro.
- Tabela nova nasce com RLS ligado e o mesmo padrão `backend_only`.

## Hubla — integração de pagamento

A Hubla é a **fonte da verdade** de compras e reembolsos. Fluxo-alvo:
compra → webhook → identifica e-mail + produto + status → cria/atualiza entitlement no Supabase → app consulta → card libera sozinho.

- Webhooks **precisam ser idempotentes**: o mesmo evento chegando duas vezes não pode duplicar entitlement nem inconsistir o banco. Guardar o id do evento e ignorar repetido.
- `hubla_events` **já existe e está em uso** desde 2026-09-18, junto com a Edge Function `hubla-webhook`. Não existe `webhook_logs` — o registro de cada evento vive em `hubla_events`.
- **Toda informação sobre a Hubla vem exclusivamente de https://hubla.gitbook.io/docs.** Não inferir formato de payload por analogia com Kiwify, Hotmart ou Stripe — buscar na documentação e confirmar o campo real antes de escrever código.
