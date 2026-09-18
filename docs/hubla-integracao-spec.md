# Integração Hubla → Supabase
## 7 Améns da Madrugada

### Objetivo deste documento

Este documento define como integrar a Hubla ao aplicativo **7 Améns da Madrugada**, hospedado no frontend pela Netlify e usando Supabase como backend/banco de dados.

A Hubla será responsável por dizer ao nosso sistema:

- quem é o comprador;
- qual produto ele possui;
- quando um produto deve ser liberado;
- quando o acesso a um produto deve ser removido;
- mudanças financeiras importantes como reembolso, disputa e chargeback.

O Supabase será responsável por transformar essas informações em:

- acesso ou bloqueio ao aplicativo;
- acesso ou bloqueio aos produtos extras;
- armazenamento dos usuários;
- armazenamento dos direitos de acesso;
- progresso das orações;
- histórico dos eventos recebidos.

A Netlify **não precisa participar da comunicação Hubla → backend**.

A arquitetura recomendada é:

```text
CLIENTE
   ↓
HUBLA / CHECKOUT
   ↓
Webhook
   ↓
SUPABASE EDGE FUNCTION
   ↓
SUPABASE POSTGRES
   ↓
APP / SITE NA NETLIFY
```

A Hubla permite configurar uma URL para receber notificações em tempo real, filtradas por produtos e pelos eventos desejados.

---

# 1. A conclusão mais importante

Para o nosso projeto, a fonte principal de verdade para **ACESSO** deve ser:

```text
customer.member_added
customer.member_removed
```

Não devemos basear a liberação/bloqueio do aplicativo principalmente em:

```text
invoice.payment_succeeded
invoice.refunded
```

Os eventos de membro são semanticamente exatamente o que precisamos.

A Hubla define:

```text
customer.member_added
```

como o evento disparado quando um membro passa a ter acesso a determinado produto.

E:

```text
customer.member_removed
```

como o evento disparado quando o membro deixa de ter acesso a determinado produto.

Isso combina perfeitamente com nossa arquitetura:

```text
Produto principal:
member_added   → libera aplicativo
member_removed → bloqueia aplicativo

Produto extra:
member_added   → libera somente o extra
member_removed → bloqueia somente o extra
```

Essa escolha também resolve vários problemas de order bump, reembolso parcial e múltiplos produtos que seriam mais complicados se usássemos somente os eventos financeiros.

---

# 2. Eventos da Hubla que devemos configurar

A Hubla possui dezenas de eventos. Nosso sistema **não precisa ouvir todos eles**.

A própria Hubla recomenda escutar apenas os eventos necessários para evitar carga e complexidade desnecessárias.

Para este aplicativo devemos configurar:

| Evento | Usaremos? | Função |
|---|---:|---|
| `customer.member_added` | **SIM — obrigatório** | Conceder acesso ao produto |
| `customer.member_removed` | **SIM — obrigatório** | Remover acesso ao produto |
| `invoice.status_updated` | **SIM — recomendado** | Auditoria financeira, disputa, chargeback etc. |
| `invoice.payment_succeeded` | Não necessário para entitlement | Compra paga, mas member_added já resolve acesso |
| `invoice.refunded` | Não necessário como fonte principal | Pode servir para auditoria, mas não deve comandar entitlement |
| `refund_request.created` | NÃO | Pedido de reembolso não significa reembolso concluído |
| `refund_request.accepted` | Opcional | Auditoria |
| `subscription.*` | Não no MVP atual | Só será necessário se criarmos lógica própria para recorrências |

A Hubla possui oficialmente eventos separados para membro, assinatura, fatura, parcelamento e solicitação de reembolso.

### Regra recomendada

Criar uma regra na Hubla chamada, por exemplo:

```text
7 Améns — App Access
```

Produtos:

```text
Produto principal
Todos os extras que aparecerão no app
```

Eventos:

```text
customer.member_added
customer.member_removed
invoice.status_updated
```

Destino:

```text
https://<SUPABASE-PROJECT>.supabase.co/functions/v1/hubla-webhook
```

Esse endpoint deve ser uma Supabase Edge Function.

---

# 3. O evento mais importante: `customer.member_added`

A Hubla envia:

```json
{
  "type": "customer.member_added",
  "event": {
    "product": {
      "id": "...",
      "name": "..."
    },
    "subscription": {
      "id": "...",
      "payerId": "...",
      "type": "one_time",
      "status": "active",
      "modifiedAt": "...",
      "version": 4
    },
    "user": {
      "id": "...",
      "firstName": "...",
      "lastName": "...",
      "email": "...",
      "phone": "..."
    }
  },
  "version": "2.0.0"
}
```

O payload oficial para pagamento único contém exatamente esses elementos.

Para nosso sistema interessam principalmente:

```text
type

event.product.id
event.product.name

event.user.id
event.user.email
event.user.firstName
event.user.lastName

event.subscription.id
event.subscription.type
event.subscription.status
event.subscription.version
event.subscription.modifiedAt
```

A Hubla define:

`event.product.id`
= identificador único do produto.

`event.user.id`
= identificador único do comprador.

`event.user.email`
= e-mail do comprador.

`event.subscription.id`
= identificador único da assinatura/relação comercial.

---

# 4. O evento `customer.member_removed`

A estrutura é praticamente a mesma.

Exemplo conceitual:

```json
{
  "type": "customer.member_removed",
  "event": {
    "product": {
      "id": "PRODUTO_X",
      "name": "Produto X"
    },
    "subscription": {
      "id": "...",
      "type": "one_time",
      "status": "inactive",
      "credits": 0
    },
    "user": {
      "id": "...",
      "email": "cliente@email.com"
    }
  }
}
```

Para pagamento único, a documentação mostra `subscription.type = "one_time"` e, no evento de acesso removido, `subscription.status = "inactive"`.

Portanto:

```text
customer.member_removed
         ↓
event.product.id
         ↓
Descobrimos exatamente QUAL acesso remover.
```

Isso é crucial para nosso projeto.

---

# 5. Produto principal versus extras

Nunca devemos identificar um produto pelo nome.

Errado:

```text
if product.name === "7 Améns"
```

Certo:

```text
if product.id === "ID_REAL_DO_PRODUTO"
```

A Hubla possui um identificador único para cada produto e utiliza esse mesmo ID para mapear produtos em integrações externas. A própria documentação de integração com áreas de membros orienta copiar o **identificador único do produto (ID)** para criar o mapeamento.

No Supabase devemos ter:

```text
products
```

Exemplo:

| hubla_product_id | slug | tipo |
|---|---|---|
| `abc123` | `7-amens` | `main` |
| `def456` | `novena-desatadora` | `addon` |
| `ghi789` | `produto-extra-x` | `addon` |

Assim, quando chegar:

```json
"product": {
  "id": "def456"
}
```

sabemos:

```text
def456
↓
Novena Desatadora
↓
addon
```

---

# 6. Regra exata de acesso do nosso negócio

## Compra do produto principal

Hubla:

```text
customer.member_added
product.id = MAIN_PRODUCT_ID
```

Supabase:

```text
cliente existe?
  não → criar cliente
  sim → atualizar dados

entitlement principal:
  status = active
```

Resultado:

```text
cliente pode entrar no aplicativo
```

---

## Compra de um extra

Hubla:

```text
customer.member_added
product.id = ADDON_X_ID
```

Supabase:

```text
entitlement addon X = active
```

Resultado:

```text
aplicativo continua normal
addon X agora aparece desbloqueado
```

A interface também deixa de mostrar CTA do tipo:

```text
Desbloquear produto X
```

---

# 7. Reembolso do principal

Quando a Hubla retirar o acesso ao produto principal:

```text
customer.member_removed
product.id = MAIN_PRODUCT_ID
```

nosso sistema deve fazer:

```text
principal entitlement = revoked
```

Resultado:

```text
APP ACCESS = false
```

A cliente não consegue mais acessar o aplicativo.

### Importante

**Não apagar a conta.**

**Não apagar o progresso.**

**Não apagar os demais dados.**

Somente revogar o entitlement.

Dessa forma, se acontecer posteriormente uma recompra ou reativação:

```text
customer.member_added
```

o entitlement volta a:

```text
active
```

e todo o progresso anterior continua existindo.

Essa preservação de dados é uma decisão da arquitetura do nosso aplicativo.

---

# 8. Reembolso somente de um extra

Exemplo:

Cliente possui:

```text
7 Améns                  ACTIVE
Novena Desatadora        ACTIVE
Produto Extra B          ACTIVE
```

Ela pede reembolso apenas da Novena.

Hubla manda:

```text
customer.member_removed

product.id = NOVENA_ID
```

Resultado:

```text
7 Améns                  ACTIVE
Novena Desatadora        REVOKED
Produto Extra B          ACTIVE
```

O aplicativo continua funcionando.

Somente a Novena é bloqueada.

Essa é justamente uma das principais razões para usar `customer.member_removed`, porque o evento identifica um determinado produto.

---

# 9. Por que NÃO devemos usar apenas `invoice.refunded`

A documentação da Hubla apresenta três problemas importantes.

## Problema 1 — reembolso parcial

A documentação informa que:

```text
invoice.refunded
```

corresponde ao reembolso total.

No reembolso parcial, pode ocorrer apenas:

```text
invoice.status_updated
status = refunded
```



Portanto:

```text
invoice.refunded = não cobre todos os cenários.
```

---

## Problema 2 — order bump

A documentação atual avisa que os exemplos antigos de payload estão em **modo de compatibilidade**.

Na integração recomendada:

- o bloco `products` possui outro formato;
- uma venda contendo order bump pode gerar **um único aviso**, em vez de vários.

Portanto, assumir:

```text
1 webhook de invoice = 1 produto
```

é perigoso.

---

## Problema 3 — precisamos saber qual produto perdeu acesso

Imagine uma compra:

```text
Principal
+
Order bump A
+
Order bump B
```

Se posteriormente houver alteração financeira parcial, tentar reconstruir entitlement apenas pela fatura cria complexidade desnecessária.

O evento:

```text
customer.member_removed
```

já nos diz diretamente:

```text
este usuário perdeu acesso a ESTE produto
```

Por isso ele será a nossa fonte canônica de entitlement.

---

# 10. Para que servirá `invoice.status_updated`

Apesar de não comandar o entitlement primariamente, devemos escutá-lo.

A própria Hubla chama esse evento de evento **“guarda-chuva”**, pois ele representa qualquer mudança de status da fatura.

Status possíveis:

```text
unpaid
paid
overdue
refunded
disputed
chargeback
canceled
```

E `invoice.status_updated` é particularmente importante porque alguns estados, como `disputed` e `chargeback`, não possuem um evento específico separado.

No nosso sistema ele servirá para:

```text
auditoria
logs
diagnóstico
reconciliação
chargeback
disputa
investigação de inconsistências
```

Não será a fonte principal que altera `entitlements`.

---

# 11. Chargeback

Chargeback aparece como:

```text
invoice.status_updated
event.invoice.status = "chargeback"
```

A própria documentação da Hubla faz esse mapeamento explicitamente.

Devemos armazenar esse evento.

Idealmente o acesso correspondente também acabará refletido pela Hubla através de:

```text
customer.member_removed
```

e essa remoção será o comando definitivo de entitlement.

O `invoice.status_updated` serve para sabermos:

```text
essa venda sofreu chargeback
```

e detectarmos qualquer discrepância.

---

# 12. Disputa

Também pode chegar:

```text
invoice.status_updated
status = disputed
```

Uma disputa não deve ser confundida automaticamente com um reembolso definitivo.

Existe ainda um detalhe importante.

Se uma disputa for resolvida a favor do vendedor:

```text
disputed → paid
```

a Hubla informa que dispara somente:

```text
invoice.status_updated
```

e **não** `invoice.payment_succeeded`.

Isso é mais um motivo para não construir o sistema baseado apenas em:

```text
payment_succeeded
refunded
```

---

# 13. Solicitação de reembolso NÃO significa reembolso

A Hubla possui:

```text
refund_request.created
refund_request.accepted
refund_request.canceled
refund_request.rejected
```

Uma solicitação criada ainda pode ser:

```text
cancelada pelo comprador
ou
rejeitada pelo vendedor
```

A documentação também mostra vários estados internos:

```text
created
pending
rejected
accepted
processing
canceled
```



Portanto jamais fazer:

```text
refund_request.created
↓
revogar acesso
```

Isso poderia retirar acesso de alguém cujo reembolso posteriormente fosse rejeitado ou cancelado.

Para o MVP não precisamos nem ouvir esses eventos.

---

# 14. Identificação da cliente

Nossa UX foi definida como:

```text
Digite o mesmo e-mail usado na compra.
```

O evento de membro contém:

```text
event.user.id
event.user.email
```

A Hubla define `event.user.id` como identificador único do comprador e `event.user.email` como e-mail do comprador.

O Supabase deve guardar ambos.

Exemplo:

```text
profile:

id interno: UUID
hubla_user_id: J0km...
email: maria@email.com
first_name: Maria
last_name: Silva
```

### Não usar somente e-mail como chave interna

Para o usuário:

```text
email = login
```

Para o banco:

```text
hubla_user_id = identidade externa estável da Hubla
```

Essa separação deixa a arquitetura mais resistente.

O e-mail recebido deve ser normalizado:

```text
trim()
lowercase()
```

Exemplo:

```text
 Maria@Email.COM
```

vira:

```text
maria@email.com
```

---

# 15. `user.email` versus `payer.email`

Os eventos financeiros podem possuir tanto informações de `user` quanto de `payer`.

A documentação define o e-mail do payer como o e-mail do comprador cadastrado utilizado no momento da compra.

Entretanto, para nosso entitlement é melhor utilizar:

```text
event.user.id
event.user.email
```

do evento `customer.member_*`, porque é justamente aquele **usuário** para o qual a Hubla está concedendo/removendo o acesso.

Podemos armazenar `payer.email` nos eventos financeiros para auditoria, mas não precisamos utilizá-lo para controlar o login do aplicativo.

---

# 16. Banco de dados recomendado

## `profiles`

```text
id UUID PK
hubla_user_id TEXT UNIQUE
email TEXT UNIQUE
first_name TEXT
last_name TEXT
phone TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

## `products`

```text
id UUID PK
hubla_product_id TEXT UNIQUE NOT NULL
slug TEXT UNIQUE NOT NULL
name TEXT
type TEXT
active BOOLEAN
created_at TIMESTAMPTZ
```

`type`:

```text
main
addon
```

Exemplo:

```text
7-amens                main
novena-desatadora      addon
extra-x                 addon
```

---

# 17. `entitlements`

Essa é a tabela mais importante para acesso.

```text
id UUID PK

profile_id UUID
product_id UUID

status TEXT

source TEXT

hubla_subscription_id TEXT
hubla_user_id TEXT

granted_at TIMESTAMPTZ
revoked_at TIMESTAMPTZ

last_subscription_version INTEGER
last_modified_at TIMESTAMPTZ

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Constraint fundamental:

```text
UNIQUE(profile_id, product_id)
```

Status:

```text
active
revoked
```

Nunca criar dez entitlements iguais se a Hubla repetir o evento.

Devemos atualizar o registro existente.

---

# 18. Acesso geral ao aplicativo

Não precisamos manter um boolean independente como:

```text
profiles.can_access_app = true
```

Acesso deve ser derivado dos entitlements.

Conceitualmente:

```sql
EXISTS (
    entitlement
    WHERE profile = cliente
    AND product.type = 'main'
    AND entitlement.status = 'active'
)
```

Se existe:

```text
APP ACCESS = true
```

Se não existe:

```text
APP ACCESS = false
```

Isso evita situações como:

```text
entitlement revogado
mas
can_access_app ainda true
```

---

# 19. Extras

Para cada card premium:

```text
usuário possui entitlement ativo?
```

Sim:

```text
Abrir
```

Não:

```text
Desbloquear
```

Exemplo:

```text
Novena Desatadora

entitlement active:
[Acessar]

sem entitlement:
[Desbloquear]
```

---

# 20. Progresso

O progresso deve ser completamente independente da Hubla.

Hubla:

```text
quem pode acessar
```

Supabase:

```text
onde essa pessoa parou
```

Exemplo de tabela:

```text
progress

id
profile_id
module_slug
step
completed
data JSONB
updated_at
```

Um reembolso deve modificar entitlement, **não progresso**.

---

# 21. Histórico bruto de eventos Hubla

Criar uma tabela:

```text
hubla_events
```

Campos recomendados:

```text
id UUID

idempotency_key TEXT UNIQUE

event_type TEXT
payload_version TEXT

sandbox BOOLEAN

hubla_user_id TEXT
hubla_product_id TEXT

subscription_id TEXT
invoice_id TEXT

entity_version INTEGER

payload JSONB

processing_status TEXT
error TEXT

received_at TIMESTAMPTZ
processed_at TIMESTAMPTZ
```

A coluna:

```text
payload JSONB
```

é extremamente importante.

Ela permite guardar exatamente o webhook recebido.

Se daqui a seis meses houver algum problema, podemos descobrir:

```text
o que a Hubla realmente enviou?
```

sem depender apenas dos dados transformados.

---

# 22. Idempotência — obrigatório

A Hubla pode entregar o mesmo evento mais de uma vez.

Ela envia o header:

```text
x-hubla-idempotency
```

com um identificador único.

A própria Hubla recomenda armazenar esse valor e verificar se o evento já foi processado.

Portanto:

```text
recebe webhook
↓
pega x-hubla-idempotency
↓
já existe no banco?
```

Se SIM:

```text
retornar 200
não processar novamente
```

Se NÃO:

```text
registrar
processar
```

Constraint no banco:

```text
UNIQUE(idempotency_key)
```

Isso evita:

```text
evento duplicado
↓
dois usuários
dois entitlements
duas revogações
etc.
```

---

# 23. A ordem dos eventos NÃO é garantida

A Hubla declara explicitamente:

> a entrega dos eventos não é garantida na ordem em que foram gerados.

Por exemplo, eventos de assinatura, fatura, pagamento e member_added podem chegar em sequência diferente da lógica cronológica.

Portanto nosso backend jamais deve pensar:

```text
primeiro sempre chegará pagamento
depois member_added
```

Cada evento deve conseguir ser processado de forma independente.

---

# 24. `version` e `modifiedAt`

A Hubla recomenda usar:

```text
version
createdAt
modifiedAt
```

para evitar que um evento antigo sobrescreva um estado mais novo.

As entidades de assinatura e fatura carregam versões incrementais.

Por isso devemos armazenar:

```text
last_subscription_version
last_modified_at
```

Antes de aplicar uma atualização:

```text
nova version > version salva?
```

Sim:

```text
processar
```

Menor:

```text
evento atrasado
ignorar mudança de estado
mas preservar no log
```

Se houver situação ambígua:

```text
mesma version
estado conflitante
```

não fazer alteração silenciosa.

Registrar como:

```text
needs_reconciliation
```

e investigar.

---

# 25. Autenticação do webhook

Toda requisição da Hubla possui:

```text
x-hubla-token
```

O token pode ser encontrado em:

```text
Hubla
→ Integrações
→ Webhook
→ Autenticação
→ Hubla Webhook Token
```

A Hubla recomenda explicitamente validar esse token.

No Supabase:

```text
HUBLA_WEBHOOK_TOKEN
```

deve ser um secret da Edge Function.

Nunca:

```text
frontend JavaScript
GitHub público
Netlify HTML
localStorage
```

O navegador da cliente nunca precisa conhecer esse token.

---

# 26. Headers que a Hubla envia

A documentação lista:

```text
Content-Type: application/json

x-hubla-token

x-hubla-sandbox

x-hubla-idempotency
```



Nosso endpoint deve ler todos.

---

# 27. Sandbox

A Hubla possui um ambiente de testes de webhook.

No painel:

```text
Regra de webhook
→ Mais opções
→ Testar configuração
→ Enviar eventos
```

A Hubla envia payloads fictícios simulando vários cenários sem afetar dados reais da aplicação.

O webhook possui:

```text
x-hubla-sandbox
```

Portanto nossa Edge Function deve fazer:

```text
sandbox == true
↓
registrar evento
↓
NÃO alterar entitlement de produção
↓
retornar 200
```

Isso evita que testes criem usuários e acessos reais.

---

# 28. Fluxo do endpoint

Pseudoimplementação:

```text
POST /hubla-webhook

1. Verificar método POST

2. Ler:
   x-hubla-token
   x-hubla-idempotency
   x-hubla-sandbox

3. Validar x-hubla-token

4. Validar JSON

5. Verificar idempotency_key

6. Registrar payload bruto

7. Se sandbox:
      marcar como sandbox
      retornar 200

8. Identificar payload.type

9. Processar evento

10. Registrar resultado

11. Retornar 200/201/202
```

---

# 29. Dispatcher de eventos

Conceitualmente:

```javascript
switch (payload.type) {

  case "customer.member_added":
    grantEntitlement(payload)
    break

  case "customer.member_removed":
    revokeEntitlement(payload)
    break

  case "invoice.status_updated":
    updateInvoiceAudit(payload)
    break

  default:
    logIgnoredEvent(payload)
}
```

Eventos válidos mas desconhecidos não precisam gerar erro.

Podemos:

```text
registrar
ignorar
retornar 200
```

Assim não causamos retentativas infinitas por algo que conscientemente não utilizamos.

---

# 30. Algoritmo de `member_added`

```text
1. Extrair:
   hubla_user_id
   email
   nome
   product_id
   subscription_id
   subscription.version
   subscription.modifiedAt

2. Normalizar email

3. Encontrar produto por:
   products.hubla_product_id

4. Produto não existe?
   registrar erro de configuração
   não conceder produto errado

5. Upsert profile

6. Upsert entitlement:
   status = active
   granted_at = agora
   revoked_at = null
   source = hubla

7. Salvar IDs Hubla

8. Finalizar evento.
```

Não mapear produtos automaticamente pelo nome.

Produto desconhecido deve ser tratado como erro de configuração.

---

# 31. Algoritmo de `member_removed`

```text
1. Extrair user.id
2. Extrair product.id
3. Localizar profile
4. Localizar produto
5. Localizar entitlement(profile, product)

6. Atualizar:
   status = revoked
   revoked_at = agora

7. NÃO excluir profile

8. NÃO excluir progresso

9. NÃO revogar outros produtos.
```

Essa última regra é fundamental.

Nunca:

```text
member_removed addon
↓
UPDATE todos os entitlements do cliente
```

Sempre:

```text
revoke SOMENTE event.product.id
```

---

# 32. Recompra

Se posteriormente chegar:

```text
customer.member_added
```

para um entitlement anteriormente revogado:

```text
status = active
revoked_at = null
granted_at = nova data
```

Resultado:

```text
acesso restaurado
progresso preservado
```

---

# 33. Faturas

Para `invoice.status_updated`, armazenar ao menos:

```text
invoice.id
invoice.orderId
invoice.status
invoice.version
invoice.modifiedAt
invoice.subscriptionId
user.id
user.email
product(s)
payload completo
```

Status suportados oficialmente:

```text
unpaid
paid
overdue
refunded
disputed
chargeback
canceled
```



Criar opcionalmente:

```text
hubla_invoices
```

ou simplesmente manter inicialmente dentro do:

```text
hubla_events.payload
```

Para o MVP, guardar raw payload é suficiente para auditoria.

---

# 34. Não processar duas trilhas financeiras simultaneamente

A Hubla explica que uma mesma alteração pode produzir:

```text
invoice.status_updated
+
evento específico
```

Exemplo:

```text
invoice.status_updated
+
invoice.payment_succeeded
```

ou:

```text
invoice.status_updated
+
invoice.refunded
```

A documentação recomenda escolher uma trilha para não processar a mesma mudança duas vezes.

Nossa escolha:

```text
ACESSO:
customer.member_*

FINANCEIRO/AUDITORIA:
invoice.status_updated
```

Isso deixa a arquitetura muito mais simples.

---

# 35. Por que não precisamos de `invoice.payment_succeeded`

A Hubla diz que `invoice.payment_succeeded` é o gatilho tradicional de “compra aprovada” e pode ser utilizado para liberar acesso.

Mas em nosso caso já existe um evento ainda mais adequado:

```text
customer.member_added
```

Logo:

```text
payment_succeeded
```

seria redundante para controle de acesso.

Menos eventos = menos complexidade.

---

# 36. Por que não precisamos de eventos de assinatura agora

A Hubla suporta:

```text
subscription.created
subscription.activated
subscription.expiring
subscription.deactivated
subscription.renewal_disabled
subscription.renewal_enabled
```

Por exemplo, `subscription.deactivated` indica que a assinatura foi desativada e o usuário não possui mais créditos.

Mas nosso produto atual é essencialmente:

```text
pagamento único
+
acesso vitalício enquanto não houver revogação
```

E o próprio evento `customer.member_added` suporta:

```text
subscription.type = one_time
```



Portanto assinatura não precisa entrar no MVP.

Caso futuramente vendamos:

```text
comunidade mensal
assinatura mensal
plano anual
```

aí adicionamos lógica específica para subscription.

---

# 37. Como configurar na Hubla

Caminho oficial:

```text
Hubla
→ Integrações
→ Automações
→ Webhook
→ Configurações
→ Adicionar regra
```

Preencher:

```text
Nome:
7 Améns — App Access

URL:
Supabase Edge Function

Produtos:
selecionar produto principal + extras

Eventos:
customer.member_added
customer.member_removed
invoice.status_updated
```

A Hubla permite selecionar produtos específicos ou todos os produtos e permite escolher um ou mais eventos na regra.

Para nosso caso prefiro selecionar **somente os produtos pertencentes ao aplicativo**, evitando eventos de produtos não relacionados.

---

# 38. Resposta HTTP

Para considerar o webhook entregue com sucesso, a Hubla aceita:

```text
200
201
202
```

Caso contrário ela tenta novamente.

O endpoint deve responder rapidamente.

A própria Hubla recomenda devolver uma resposta 2xx antes de executar tarefas demoradas.

---

# 39. Retentativas

Em caso de falha, a documentação informa até cinco tentativas.

Exemplo apresentado:

```text
2ª tentativa: +1 minuto
3ª tentativa: +2 minutos
4ª tentativa: +3 minutos
5ª tentativa: +4 minutos
```

Se o endpoint continuar apresentando erros por vários dias, a Hubla pode notificar por e-mail sobre a desativação automática da regra.

Mais um motivo para idempotência ser obrigatória.

---

# 40. Redirecionamentos não podem ser usados

A Hubla considera:

```text
302
ou outro 3xx
```

como falha.

Portanto a URL configurada precisa ser a URL final do endpoint.

Não:

```text
hubla → URL A → redirect → URL B
```

A Edge Function do Supabase deve ser chamada diretamente.

---

# 41. HTTPS

A Hubla exige que o endpoint público esteja corretamente acessível.

A documentação recomenda endpoint HTTPS com certificado válido.

Supabase Edge Functions atendem naturalmente esse modelo.

---

# 42. Histórico dentro da Hubla

Existe:

```text
Integrações
→ Webhook
→ Histórico
```

Ali podemos investigar eventos entregues.

A documentação informa que o histórico permite:

- identificar falhas;
- consultar os detalhes dos eventos;
- verificar respostas do endpoint;
- reprocessar eventos.

Isso será nossa primeira ferramenta de diagnóstico quando alguém disser:

```text
"Paguei mas meu acesso não apareceu."
```

Fluxo de suporte:

```text
1. procurar evento na Hubla
2. verificar se Hubla enviou
3. verificar status HTTP
4. verificar idempotency
5. procurar hubla_events no Supabase
6. procurar entitlement
```

---

# 43. Reprocessamento

A Hubla permite reprocessar eventos inclusive quando o evento original teve status 200.

Ela alerta, porém, para o risco de duplicidade.

Como nosso banco usa:

```text
x-hubla-idempotency UNIQUE
```

um reprocessamento normal não deve gerar um novo entitlement indevidamente.

Se quisermos reexecutar intencionalmente um evento para corrigir um bug, devemos fazer isso de forma controlada pelo backend/admin, e não simplesmente remover toda proteção de idempotência.

---

# 44. Clientes que compraram ANTES de ativarmos o webhook

Este é o principal ponto de migração.

A documentação afirma que contas recém-configuradas podem não apresentar histórico porque os eventos só passam a ser registrados **depois que existe uma configuração ativa e ocorrem vendas**.

Portanto:

## NÃO devemos presumir que a Hubla fará backfill automático.

Se existem clientes antigos:

```text
compraram ontem
webhook foi ativado hoje
```

não podemos esperar automaticamente:

```text
customer.member_added retroativo
```

### Consequência para o projeto

Antes de abrir o aplicativo para toda a base antiga precisamos fazer um:

```text
INITIAL SEED
```

ou seja, inserir no Supabase os compradores que já possuem acesso.

A documentação de webhook oficial que analisamos **não documenta um mecanismo automático de backfill desses acessos históricos**.

Portanto, para clientes anteriores à ativação, há duas opções operacionais seguras:

```text
1. importar manualmente uma lista confiável dos clientes atuais;
ou
2. confirmar com o suporte da Hubla o método oficial de extração/sincronização histórica disponível na nossa conta.
```

Isso deve ser feito uma única vez.

Depois:

```text
webhooks mantêm o Supabase sincronizado.
```

---

# 45. Segurança

O endpoint deve:

```text
validar x-hubla-token
validar idempotency
aceitar somente POST
aceitar JSON
usar HTTPS
não expor segredo no frontend
registrar payload
```

A Hubla também informa que seus webhooks partem de uma lista específica de IPs e recomenda validar origem + token.

Como a documentação que consultamos não fornece nessa página os IPs concretos, **não devemos inventar uma lista de IPs**.

O token é nossa validação obrigatória.

Se posteriormente a Hubla fornecer os IPs oficiais aplicáveis à conta, podemos adicionar allowlist como segunda camada.

---

# 46. Onde guardar o token

Somente:

```text
Supabase Secret
```

Exemplo:

```text
HUBLA_WEBHOOK_TOKEN
```

Nunca:

```text
.env enviado ao GitHub
HTML
JavaScript público
Netlify frontend env exposta
banco acessível ao browser
```

---

# 47. Netlify não precisa receber webhook

Nossa divisão deve ser:

```text
Netlify
= frontend

Supabase
= backend + banco + webhook

Hubla
= pagamentos + eventos
```

Logo:

```text
Hubla → Supabase
```

e não:

```text
Hubla → Netlify → Supabase
```

Isso reduz pontos de falha e deixa a integração de pagamento independente dos deploys do site.

Podemos atualizar o frontend na Netlify sem interromper o webhook.

---

# 48. Fluxo completo de compra

```text
CLIENTE COMPRA
       ↓
HUBLA CONFIRMA ACESSO
       ↓
customer.member_added
       ↓
SUPABASE EDGE FUNCTION
       ↓
valida token
       ↓
valida idempotency
       ↓
identifica usuário
       ↓
identifica produto pelo Hubla Product ID
       ↓
cria/atualiza profile
       ↓
entitlement = active
       ↓
cliente abre app
       ↓
app consulta acesso
       ↓
produto disponível
```

---

# 49. Fluxo completo de reembolso de extra

```text
CLIENTE REEMBOLSA EXTRA
        ↓
Hubla remove acesso desse produto
        ↓
customer.member_removed
        ↓
event.product.id = EXTRA
        ↓
Supabase
        ↓
entitlement EXTRA = revoked
        ↓
produto principal continua active
        ↓
app continua disponível
        ↓
extra fica bloqueado
```

---

# 50. Fluxo completo de reembolso principal

```text
CLIENTE REEMBOLSA PRINCIPAL
        ↓
customer.member_removed
        ↓
product.id = MAIN
        ↓
entitlement MAIN = revoked
        ↓
app_access = false
        ↓
login/acesso bloqueado
```

Progresso continua armazenado.

---

# 51. Fluxo de recompra

```text
cliente recompra
      ↓
customer.member_added
      ↓
MAIN = active
      ↓
app_access = true
      ↓
progress antigo continua
```

---

# 52. Order bumps

Esse ponto merece atenção especial.

A documentação atual avisa que, na integração recomendada, uma venda com order bump pode gerar apenas uma notificação financeira, e o formato de `products` difere do payload de compatibilidade.

Por isso não devemos construir lógica assim:

```text
invoice recebida
→ event.product
→ esse é necessariamente o único produto comprado
```

Para entitlement:

```text
customer.member_added / removed
```

continua sendo a abordagem mais limpa.

Cada produto no nosso banco possui seu próprio:

```text
hubla_product_id
```

---

# 53. Testes obrigatórios antes de produção

Devemos validar os seguintes cenários:

| Teste | Resultado esperado |
|---|---|
| `member_added` principal | App liberado |
| `member_added` extra | Somente extra liberado |
| `member_removed` extra | Somente extra bloqueado |
| `member_removed` principal | App bloqueado |
| Recompra | Acesso restaurado |
| Evento duplicado | Nenhuma duplicação |
| Token inválido | Rejeitar |
| Sandbox | Registrar sem alterar produção |
| Produto desconhecido | Logar erro; não liberar |
| Evento antigo atrasado | Não sobrescrever estado novo |
| Chargeback | Registrar financeiramente |
| Disputa | Registrar sem assumir refund final |
| Evento reprocessado | Idempotência impede duplicidade |

---

# 54. Teste pelo sandbox da Hubla

Usar:

```text
Hubla
→ Webhook
→ regra
→ Testar configuração
→ Enviar eventos
```



Primeiro confirmar no Supabase:

```text
hubla_events recebeu evento
```

Depois:

```text
x-hubla-sandbox foi detectado
```

E finalmente:

```text
nenhum entitlement de produção foi criado.
```

---

# 55. Teste real antes do lançamento

Depois do sandbox:

```text
1. realizar compra real controlada do principal
2. verificar member_added
3. entrar no app pelo e-mail
4. verificar progresso
5. comprar um extra
6. verificar extra
7. reembolsar extra
8. verificar que principal continua
9. testar remoção/reembolso principal
10. verificar bloqueio geral
```

Isso valida todo o ciclo real.

---

# 56. Observabilidade mínima

Precisamos conseguir responder rapidamente:

```text
Por que Maria não consegue entrar?
```

Consultas:

```text
profile existe?
↓
qual hubla_user_id?
↓
principal entitlement está active?
↓
qual foi o último member_added/member_removed?
↓
qual idempotency?
↓
Hubla recebeu 200?
↓
houve invoice chargeback/refund/dispute?
```

Com `hubla_events + entitlements`, conseguimos fazer isso.

---

# 57. Estado que o frontend deve receber

O frontend não deveria precisar entender Hubla.

Ele deveria receber do nosso backend algo semelhante a:

```json
{
  "user": {
    "name": "Maria"
  },
  "appAccess": true,
  "products": {
    "7-amens": true,
    "novena-desatadora": true,
    "extra-b": false
  }
}
```

Hubla nunca deve estar diretamente acoplada ao JavaScript dos cards.

---

# 58. Separação de responsabilidades

## Hubla

```text
checkout
pagamento
produto comprado
direito concedido/removido
reembolso
chargeback
disputa
```

## Supabase

```text
usuários
entitlements
webhook receiver
progresso
sessão do app
logs
regras de acesso
```

## Netlify

```text
HTML
CSS
JS
imagens
interface
deploy
```

---

# 59. O que NÃO devemos fazer

```text
❌ liberar produto baseado pelo nome

❌ usar somente invoice.refunded

❌ considerar refund_request.created como reembolso

❌ confiar que eventos chegam em ordem

❌ processar evento duplicado novamente

❌ colocar Hubla token no frontend

❌ apagar progresso após reembolso

❌ revogar todos os extras quando apenas um foi removido

❌ assumir que webhook fará backfill dos clientes antigos

❌ depender de Netlify para processar pagamentos

❌ assumir 1 invoice = 1 produto por causa de order bumps
```

---

# 60. Estrutura final

```text
Hubla
│
│ Webhook
│
├── customer.member_added
├── customer.member_removed
└── invoice.status_updated
        │
        ▼
Supabase Edge Function
        │
        ├── valida token
        ├── valida sandbox
        ├── valida idempotency
        ├── armazena evento
        └── executa regra
                │
                ▼
Postgres
├── profiles
├── products
├── entitlements
├── progress
└── hubla_events
        │
        ▼
API do aplicativo
        │
        ▼
Frontend Netlify
```

---

# 61. Checklist de implementação

### Hubla

- ativar integração Webhook;
- pegar Hubla Webhook Token;
- cadastrar URL da Supabase Edge Function;
- selecionar produto principal;
- selecionar extras;
- selecionar `customer.member_added`;
- selecionar `customer.member_removed`;
- selecionar `invoice.status_updated`;
- testar pelo sandbox;
- confirmar eventos no Histórico.

### Supabase

- criar `profiles`;
- criar `products`;
- cadastrar todos os Hubla Product IDs;
- criar `entitlements`;
- criar `progress`;
- criar `hubla_events`;
- colocar unique em `x-hubla-idempotency`;
- criar Edge Function;
- guardar `HUBLA_WEBHOOK_TOKEN` em secret;
- implementar grant entitlement;
- implementar revoke entitlement;
- implementar audit de invoice;
- preservar raw payload;
- tratar sandbox;
- tratar versões/eventos atrasados.

### Migração

- identificar clientes que compraram antes da ativação;
- inserir acessos iniciais no Supabase;
- conferir produto principal;
- conferir extras;
- só depois depender 100% dos webhooks.

### Frontend

- login por e-mail;
- backend verifica entitlement principal;
- principal ativo → entra;
- principal revogado → bloqueia;
- extras ativos → desbloqueados;
- extras ausentes/revogados → CTA de compra;
- progresso sempre salvo no Supabase.

---

# 62. Critério de “pronto”

A integração só deve ser considerada pronta quando todos estes casos funcionarem:

```text
COMPRA PRINCIPAL
→ acesso automático

COMPRA EXTRA
→ extra automático

REFUND EXTRA
→ só extra bloqueado

REFUND PRINCIPAL
→ app inteiro bloqueado

RECOMPRA
→ app restaurado

TROCA DE CELULAR
→ progresso permanece

WEBHOOK DUPLICADO
→ nenhum efeito duplicado

WEBHOOK FORA DE ORDEM
→ estado antigo não sobrescreve novo

SANDBOX
→ não modifica produção

CHARGEBACK/DISPUTA
→ fica registrado e auditável

ERRO DE WEBHOOK
→ conseguimos encontrar no histórico
```

---

# 63. Decisão arquitetural final

Para **7 Améns da Madrugada**, a integração Hubla deve ser pensada assim:

```text
Hubla não controla nosso aplicativo.

Hubla informa mudanças de direito.

Supabase transforma essas mudanças em entitlements.

O aplicativo consulta o Supabase.
```

A regra central é:

```text
customer.member_added
      ↓
ATIVA produto

customer.member_removed
      ↓
REVOGA aquele produto
```

Depois:

```text
produto.type == main
      ↓
controla entrada no app

produto.type == addon
      ↓
controla somente aquele conteúdo
```

`invoice.status_updated` existe paralelamente como trilha financeira para:

```text
refund
disputed
chargeback
canceled
paid
etc.
```

Esse desenho nos protege justamente dos casos mais chatos da documentação da Hubla:

```text
eventos duplicados
eventos fora de ordem
reembolso parcial
order bumps
múltiplos produtos
chargeback
disputa
reprocessamento
```

e deixa o frontend completamente independente das particularidades da Hubla.

## Resumo técnico em uma frase

**Hubla diz “este usuário ganhou/perdeu este produto”; Supabase registra isso como entitlement; Netlify apenas mostra o que o Supabase autoriza.**

Essa é a arquitetura que eu implementaria.