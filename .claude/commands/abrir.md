---
description: Abre o chat — lê o diário, confere o estado real e diz o que está pendente
---

O Caio está começando um chat novo. Você chegou sem nenhuma lembrança da conversa anterior. Sua tarefa agora é **se situar e reportar** — não é executar nada.

## Passo 1 — Leia

- `docs/DIARIO.md` inteiro. É a fonte do "onde paramos".
- Se o diário citar um arquivo específico como pendente, pode abrir esse arquivo. Não saia lendo o projeto todo — a pasta `docs/` tem arquivos grandes que só entram quando o assunto pede.

## Passo 2 — Confira o estado real, não só o que está escrito

O diário pode estar desatualizado. Três checagens baratas:

```
git status --short
git status -sb | head -1
```

Você quer saber: existem alterações só na máquina dele? Existe commit que não foi enviado? A branch está sincronizada?

Se o que você encontrar **contradisser o diário**, diga isso em voz alta. Diário errado é pior que diário vazio.

Não consulte o Supabase nem a Netlify aqui. Isso custa e quase nunca é necessário para abrir um chat.

## Passo 3 — Reporte, em português claro, nesta ordem

1. **Onde paramos** — duas ou três linhas sobre a última entrada do diário.
2. **🔴 Esperando decisão dele** — a lista inteira, curta. Deixe explícito que **nada anda nesses pontos** até ele responder.
3. **🟡 Pendente** — o que dá para fazer sem perguntar.
4. **Estado da máquina** — se houver alterações locais não enviadas, diga quantas e lembre que estão só no computador dele, não no ar. Se estiver tudo limpo, diga que está limpo.
5. **Divergências** — qualquer coisa que o diário afirme e a realidade desminta.

Sem jargão. Ele é copywriter, não programador. Tabela quando for lista ou contagem.

## Passo 4 — Ofereça o próximo passo e pare

Sugira **uma** tarefa — a mais urgente ou a mais antiga em aberto — e pergunte se é isso que ele quer fazer neste chat.

Depois **pare e espere**. Não comece a trabalhar. Não edite arquivo. Não rode build. O `/abrir` termina aqui.

## Regra de escopo enquanto ele não disser o contrário

Até o Caio dizer explicitamente até onde você pode ir, o padrão é **só leitura**. As quatro faixas que ele usa:

| Ele diz | Você pode |
|---|---|
| "só leitura" | ler e analisar, nada mais |
| "pode mexer local" | editar arquivos na máquina dele |
| "pode enviar pro GitHub" | o acima + push na `development` |
| "pode publicar" | o site no ar muda |

Se ele pedir uma tarefa sem dizer a faixa, **pergunte antes de encostar em qualquer arquivo**.

E lembre o combinado: **um chat por tarefa**. Quando essa tarefa estiver respondida, `/fechar`.
