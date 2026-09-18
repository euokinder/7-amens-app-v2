---
name: ux-45mais
description: Padrão visual e de linguagem do app 7 Améns, desenhado para mulheres católicas brasileiras 45+. Use sempre que a tarefa envolver HTML, CSS, layout, cor, fonte, botão, card, texto de interface, mensagem de erro, imagem, ou qualquer coisa que a cliente vá ver na tela.
---

# UX para o público 45+ — 7 Améns

A usuária é **mulher católica brasileira, 45+ (também descrita como 40+, 50+, senhoras maduras)**. Isso não é detalhe de estilo: é o produto. Uma interface que um dev de 28 anos acharia elegante pode ser inutilizável para ela.

## Referência mental
**"Netflix de orações", nunca dashboard de SaaS.** Ela abre, entende na hora onde clicar, continua a jornada. Nada com aparência de software complicado.

## Regras visuais

| Item | Regra |
|---|---|
| Tipografia | Sans-serif. **Fonte grande** — o padrão do projeto é maior que o padrão da web |
| Contraste | Alto. Texto sobre imagem exige gradiente/sombra forte na área do texto |
| Cards | Grandes, bem separados, com bastante respiro entre eles |
| Densidade | Poucos elementos competindo entre si por atenção |
| Alvo de toque | Generoso — dedo de senhora em celular, não cursor de mouse |
| Paleta | **Creme + dourado + preto** |

**Regra fixa de revisão:** antes de dar qualquer tela por pronta, conferir visualmente que não há texto sobreposto nem elemento pequeno demais. Esse problema já apareceu no site e foi apontado explicitamente.

## Imagens
Realistas, still-life religioso, luz quente e dourada, **sem texto embutido na imagem**, composição preparada para receber o título por cima. Cards de oração: mãos acendendo vela, gestos simbólicos de perdão etc.

**Sombra ou gradiente forte na região onde o texto entra** — sem isso o título some sobre a foto. Já foi problema real no site.

JPG otimizado. Proporção mais vertical ou mais horizontal conforme o card.

## Linguagem
- Extremamente clara. O padrão aprovado nos materiais foi "que até uma criança entenda"
- Frases curtas
- Instruções práticas, não explicação técnica
- Tom acolhedor, religioso, respeitoso — **nunca tom de marketing agressivo dentro do app**
- Em formulários e perguntas: "como se um padre quisesse conhecer melhor uma irmã"

Abordagens muito técnicas já foram rejeitadas explicitamente. Se um texto parecer manual de software, está errado.

## Erros e estados vazios
Nada de código de erro, nada de "falha na requisição". Mensagem em português simples dizendo o que aconteceu e o que ela faz agora. O e-mail não encontrado no login é o caso mais sensível — ela pode ser uma cliente legítima que digitou errado, e não pode se sentir barrada nem culpada.

## O que não fazer
- Não propor redesign em React/Next. **A decisão do projeto é preservar o frontend em HTML/CSS/JS puro** e colocar backend por trás
- Não introduzir padrão de interface que exija aprendizado (menu escondido, gesto, atalho, drag)
- Não reduzir tamanho de fonte nem espaçamento para "caber mais coisa"
- Não usar cinza claro sobre branco para texto secundário
