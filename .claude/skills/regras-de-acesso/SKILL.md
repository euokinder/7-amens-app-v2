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

## ⚠️ Só DOIS conteúdos são trancados por produto

Os dois pedidos pelo Caio em **2026-09-24**. ⏳ Construídos no teste local, **ainda NÃO publicados** — conferir o CLAUDE.md antes de supor que estão no ar.

| Conteúdo | Produto | Páginas |
|---|---|---|
| Central dos Quatro Arcanjos | `upsell_01` | `arcanjos.html`, `arcanjo.html`, `oracao-arcanjo.html` |
| Cântico Angelical | `upsell_02` (na Hubla, "Músicas dos Anjos": mesmo produto, nome novo) | `cantico.html`, `cantico-dia.html` |

- Comprou → o card da home abre o conteúdo. Não comprou → selo "🔒 EXTRA", botão "Adquirir" e página de oferta (`oferta-arcanjos.html` / `oferta-cantico.html`). (Até o desenho novo da home, de 24/09, o botão dizia "Desbloquear".)
- **Os dois são assinatura mensal, e cancelar NÃO tira.** Só **reembolso ou estorno** tiram. A `member-api` separa os dois casos pelas faturas da assinatura (`conteudosDela`, lista `FICA_DEPOIS_DE_CANCELAR`) e manda o resultado no campo `conteudos` do snapshot.
- Revogação feita no painel tira (grava `source = 'manual'`).
- O Cântico abre **um dia por vez**, com a mesma âncora das madrugadas (`calcularCantico`, em `js/trava.js`). Tem "Concluí este dia" só para ela se achar: o número "Orações" do painel não conta esses dias.
- Tudo o mais continua como descrito abaixo: **nenhum outro conteúdo é trancado por produto**, e não trancar outro sem o Caio pedir.

O texto abaixo é o registro de 2026-09-18 e continua valendo para todo o resto do app.

**Quem compra o produto principal tem acesso total ao aplicativo.** Os entitlements de upsell existem hoje apenas para a operação **saber quem comprou o quê** — não gateiam conteúdo.

Verificado no código em 2026-09-18:
- O único bloqueio do app é o login: `products.includes('principal')` na `member-api`.
- Existe **uma única** checagem de produto no frontend inteiro, em `js/member.js`, e ela só troca o texto de um card extra na home ("Acessar meu conteúdo" vs "Conhecer este conteúdo"). Nunca esconde nem bloqueia conteúdo.
- Os três upsells estão com `enabled = false` e `checkout_url`/`content_url` nulos, então nem chegam a renderizar.

**Nunca implementar bloqueio de conteúdo por upsell sem o Caio pedir explicitamente.** Liberar ou revogar um upsell hoje não muda nada para a cliente, e isso é intencional.

## Cards da Home — o "Adquirir" (antes, "Desbloquear")

A ideia registrada: tem direito → entra; não tem → um botão de compra, transformando o app em consumo **e** venda de complementos sem mandar a cliente para fora. **Desde 2026-09-24 ela existe em dois cards, o da Central dos Quatro Arcanjos e o do Cântico Angelical** — escritos direto no `index.html` e comandados pelo `js/member.js`, **não** pelo catálogo. No desenho novo da home (24/09): tem direito → selo "LIBERADO" e "Acessar conteúdo"; não tem → selo "🔒 EXTRA" e "Adquirir". ⚠️ Não ativar `products.enabled` do `upsell_01` nem do `upsell_02`: o código antigo do catálogo (`member-extras`) criaria um segundo card, genérico, no fim da home.
Cards da home nova, na ordem (⏳ só no local): **"Escolha um conteúdo"** — 7 Orações Sagradas · Grupo no WhatsApp · Mensagem do Dia; **"Conteúdos Exclusivos"** — Central dos Quatro Arcanjos · Cântico Angelical · Fale Conosco. Saíram da home a pedido do Caio: Novena Desatadora dos Nós, Pai Nosso e Lojinha (as páginas continuam existindo).

## Ofertas dentro do app

`member_offer_campaigns` + `member_offer_events` + função `claim_member_offer(customer_id)`.
Uma campanha só aparece se estiver `enabled`, tiver `target_url` https, a cliente tiver **todos** os `required_product_keys` e **nenhum** dos `excluded_product_keys`. O registro de exibição é **no servidor**, para a mesma oferta não repetir em outro navegador ou aparelho.

## Progresso

`prayer_progress`, chave `(customer_id, prayer_key)`. Formato de `prayer_key` validado por regex, **no banco e na `member-api`**: `principal:0-7` ou `desatadora:1-9` — e `cantico:0-7`, ⏳ só depois de rodar `supabase/cantico-angelical.sql` (a ordem é banco → função → site).

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
