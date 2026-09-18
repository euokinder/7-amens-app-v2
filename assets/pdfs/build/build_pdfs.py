# -*- coding: utf-8 -*-
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONTS = os.path.join(BASE, "fonts")
OUT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

pdfmetrics.registerFont(TTFont("Manrope", os.path.join(FONTS, "Manrope-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Manrope-Medium", os.path.join(FONTS, "Manrope-Medium.ttf")))
pdfmetrics.registerFont(TTFont("Manrope-Bold", os.path.join(FONTS, "Manrope-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Manrope-ExtraBold", os.path.join(FONTS, "Manrope-ExtraBold.ttf")))

BG = colors.HexColor("#FBF3E6")
INK = colors.HexColor("#3A3024")
INK_MUTED = colors.HexColor("#8A7D68")
ACCENT = colors.HexColor("#D3A83E")
ACCENT_STRONG = colors.HexColor("#A97C22")
SURFACE_ALT = colors.HexColor("#EFE6D3")
DARK_CARD = colors.HexColor("#332A1D")
CARD_INK = colors.HexColor("#F7F1E2")
CARD_MUTED = colors.HexColor("#D8CBB0")

PAGE_W, PAGE_H = A4
MARGIN = 46

styles = {
    "kicker": ParagraphStyle("kicker", fontName="Manrope-Bold", fontSize=9.5,
                              textColor=ACCENT_STRONG, spaceAfter=6, alignment=TA_LEFT,
                              tracking=0),
    "title": ParagraphStyle("title", fontName="Manrope-ExtraBold", fontSize=25,
                              textColor=INK, spaceAfter=4, leading=29),
    "subtitle": ParagraphStyle("subtitle", fontName="Manrope-Medium", fontSize=12.5,
                                 textColor=INK_MUTED, spaceAfter=14),
    "section": ParagraphStyle("section", fontName="Manrope-ExtraBold", fontSize=10.5,
                                textColor=ACCENT_STRONG, spaceBefore=16, spaceAfter=8,
                                keepWithNext=1),
    "body": ParagraphStyle("body", fontName="Manrope", fontSize=10.5, leading=15.5,
                             textColor=INK, spaceAfter=6),
    "bullet": ParagraphStyle("bullet", fontName="Manrope", fontSize=10.3, leading=15,
                               textColor=INK, leftIndent=14, firstLineIndent=-14,
                               spaceAfter=4),
    "note": ParagraphStyle("note", fontName="Manrope", fontSize=9.3, leading=13.5,
                             textColor=INK_MUTED, spaceAfter=2),
    "label": ParagraphStyle("label", fontName="Manrope-Medium", fontSize=9.5,
                              textColor=INK_MUTED),
    "prayer_open": ParagraphStyle("prayer_open", fontName="Manrope-Medium", fontSize=11,
                                    leading=16, textColor=INK, spaceAfter=10,
                                    alignment=TA_LEFT),
    "prayer_verse": ParagraphStyle("prayer_verse", fontName="Manrope", fontSize=11.3,
                                     leading=17.5, textColor=INK, alignment=TA_CENTER,
                                     spaceAfter=10),
    "prayer_close": ParagraphStyle("prayer_close", fontName="Manrope-Bold", fontSize=12,
                                     textColor=INK, alignment=TA_CENTER),
    "quote": ParagraphStyle("quote", fontName="Manrope-Bold", fontSize=14,
                              textColor=CARD_INK, alignment=TA_CENTER, leading=19),
    "footer_banner": ParagraphStyle("footer_banner", fontName="Manrope-ExtraBold",
                                      fontSize=9.5, textColor=CARD_INK,
                                      alignment=TA_CENTER, leading=14),
    "footer_teaser": ParagraphStyle("footer_teaser", fontName="Manrope-Medium",
                                      fontSize=9.5, textColor=INK_MUTED,
                                      alignment=TA_CENTER, spaceAfter=10),
    "conclusion": ParagraphStyle("conclusion", fontName="Manrope-Medium", fontSize=10.5,
                                   textColor=INK, alignment=TA_CENTER, leading=15.5,
                                   spaceAfter=10),
}


def bullet_items(items):
    flow = []
    for it in items:
        flow.append(Paragraph(
            f'<font color="#A97C22">•</font>&nbsp;&nbsp;{it}', styles["bullet"]
        ))
    return flow


def card(flowables, bg, pad=14):
    t = Table([[flowables]], colWidths=[PAGE_W - 2 * MARGIN - 2 * pad])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), pad),
        ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
    ]))
    return t


def fill_line(label_text, width=None):
    label = Paragraph(label_text, styles["label"])
    blank = Table([[""]], colWidths=[width or (PAGE_W - 2 * MARGIN - 140)], rowHeights=[16])
    blank.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.8, INK_MUTED),
    ]))
    row = Table([[label, blank]], colWidths=[128, None])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return row


def build_prayer_card(oracao):
    flow = [Paragraph(oracao["abertura"], styles["prayer_open"])]
    for verse in oracao["blocos"]:
        html = verse.replace("\n", "<br/>")
        flow.append(Paragraph(html, styles["prayer_verse"]))
    flow.append(Paragraph(oracao["fechamento"], styles["prayer_close"]))
    return card(flow, SURFACE_ALT, pad=18)


def build_day_pdf(day, out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=44, bottomMargin=40,
        title=f"7 Améns da Madrugada - {day['titulo']}",
    )

    def bg_canvas(c, _doc):
        c.saveState()
        c.setFillColor(BG)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        c.restoreState()

    story = []
    story.append(Paragraph(day["kicker"], styles["kicker"]))
    story.append(Paragraph(day["titulo"], styles["title"]))
    story.append(Paragraph(day["subtitulo"], styles["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=4))

    story.append(Paragraph("COMO REZAR ESTE AMÉM", styles["section"]))
    story.extend(bullet_items(day["regras"]))
    if day.get("importante"):
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<i>Importante:</i> {day['importante']}", styles["note"]))

    story.append(Paragraph("ANTES DE COMEÇAR", styles["section"]))
    story.append(Paragraph(day["antes"], styles["body"]))
    if day.get("preencher"):
        story.append(Spacer(1, 6))
        story.append(fill_line(day["preencher"]))

    story.append(Paragraph("A ORAÇÃO", styles["section"]))
    story.append(build_prayer_card(day["oracao"]))

    story.append(Paragraph("DEPOIS DE REZAR", styles["section"]))
    story.append(Paragraph(day["depois"], styles["body"]))

    story.append(Paragraph("DECLARAÇÃO DO DIA", styles["section"]))
    story.append(card([Paragraph(f"“{day['declaracao']}”", styles["quote"])],
                       DARK_CARD, pad=16))

    story.append(Spacer(1, 16))

    if day.get("concluido"):
        story.append(Paragraph(day["concluido"], styles["conclusion"]))
    else:
        story.append(Paragraph(day["proximo"], styles["footer_teaser"]))
        story.append(card([Paragraph(
            "NÃO PULE DIAS. NÃO INVERTA A ORDEM. NÃO REZE MAIS DE UMA ORAÇÃO POR DIA.",
            styles["footer_banner"])], DARK_CARD, pad=12))

    doc.build(story, onFirstPage=bg_canvas, onLaterPages=bg_canvas)


DAYS = [
    dict(
        numero=1, kicker="7 AMÉNS DA MADRUGADA · DIA 1 DE 7", titulo="Primeiro Amém",
        subtitulo="O Pai Nosso Completo",
        regras=["Horário: entre 4h e 7h da manhã.",
                "Duração: cerca de 8 a 10 minutos, sem pressa.",
                "Reze em voz alta, de preferência acompanhando o áudio guiado.",
                "Escolha um lugar tranquilo, sozinho, sem interrupções."],
        importante=None,
        antes="Respire fundo três vezes. Guarde em silêncio o pedido mais importante do seu coração para estes sete dias.",
        preencher="Meu pedido:",
        oracao=dict(
            abertura="Em nome do Pai, do Filho e do Espírito Santo. Amém.",
            blocos=[
                "Pai Nosso, que estais no Céu,\nsantificado seja o vosso nome;\nvenha a nós o vosso Reino;",
                "seja feita a vossa vontade,\nassim na Terra como no Céu.",
                "O pão nosso de cada dia nos dai hoje;\nperdoai as nossas ofensas,\nassim como nós perdoamos",
                "a quem nos tem ofendido;\ne não nos deixeis cair em tentação,\nmas livrai-nos do mal.",
                "Porque vosso é o Reino, o poder e a glória, agora e sempre.",
                "Eu recebo, Senhor, as bênçãos que já preparastes para mim.\nAbro o meu coração para tudo aquilo que vem do Teu amor.",
                "Hoje eu não peço mais pela metade — eu recebo por inteiro.\nQue a Tua paz habite em mim, hoje e todos os dias da minha vida.",
                "Eu me entrego. Eu confio. Eu recebo.",
            ],
            fechamento="Amém.",
        ),
        depois="Fique alguns instantes em silêncio e apresente a Deus o seu pedido. Diga o nome, a situação, o que está doendo — sem pressa para terminar.",
        declaracao="Hoje, eu abri o caminho.",
        proximo="Amanhã: Segundo Amém — A Oração do Perdão.",
    ),
    dict(
        numero=2, kicker="7 AMÉNS DA MADRUGADA · DIA 2 DE 7", titulo="Segundo Amém",
        subtitulo="A Oração do Perdão",
        regras=["Horário: entre 4h e 7h da manhã.",
                "Duração: cerca de 9 a 11 minutos, sem pressa.",
                "Reze em voz alta, de preferência acompanhando o áudio guiado.",
                "Escolha um lugar tranquilo, sozinho, sem interrupções."],
        importante=None,
        antes="Perdoar não é dizer que o que aconteceu estava certo, e não significa voltar a conviver com quem te machucou. É libertar o seu próprio coração.",
        preencher="Eu preciso perdoar:",
        oracao=dict(
            abertura="Em nome do Pai, do Filho e do Espírito Santo. Amém.",
            blocos=[
                "Senhor Jesus, Tu que na cruz olhaste para quem Te feria\ne disseste: “Pai, perdoa-lhes, porque não sabem o que fazem”,\nensina-me a perdoar como Tu perdoaste.",
                "Hoje eu trouxe um nome comigo.\nEu escolho, agora, entregar essa mágoa nas Tuas mãos.",
                "Eu perdoo o que essa pessoa me fez.\nEu não vou mais deixar essa dor decidir\no meu humor, a minha casa, a minha paz.",
                "E, Senhor, hoje eu também perdoo a mim mesmo, a mim mesma,\npelo que eu fiz e nunca contei pra ninguém,\npelos erros que ainda me perseguem à noite.",
                "Eu não sou mais só aquilo que eu fiz.\nHoje eu escolho recomeçar.",
                "Tira de mim o peso que eu carreguei por anos,\nsem nem perceber o tamanho dele.\nEnche esse espaço vazio com a Tua paz.",
                "Eu solto. Eu perdoo. Eu sou livre.",
            ],
            fechamento="Amém.",
        ),
        depois="Fique alguns instantes em silêncio. Se ainda houver um nome guardado no coração, apresente-o a Deus — em voz alta ou em silêncio.",
        declaracao="Hoje, eu solto o peso que carreguei por anos.",
        proximo="Amanhã: Terceiro Amém — A Oração da Cura.",
    ),
    dict(
        numero=3, kicker="7 AMÉNS DA MADRUGADA · DIA 3 DE 7", titulo="Terceiro Amém",
        subtitulo="A Oração da Cura",
        regras=["Horário: entre 4h e 7h da manhã.",
                "Duração: cerca de 8 a 10 minutos, sem pressa.",
                "Reze em voz alta, de preferência acompanhando o áudio guiado.",
                "Escolha um lugar tranquilo, sozinho, sem interrupções."],
        importante="esta oração não substitui médico, remédio ou tratamento nenhum. Continue o seu acompanhamento médico normalmente — a fé e o cuidado com a saúde caminham juntos.",
        antes="Decida por quem você vai rezar hoje: por você, ou por alguém que você ama.",
        preencher="Eu rezo por:",
        oracao=dict(
            abertura="Em nome do Pai, do Filho e do Espírito Santo. Amém.",
            blocos=[
                "Senhor, Tu que caminhaste por este mundo\ncolocando as mãos sobre os doentes,\ncoloca hoje a Tua mão sobre mim\n(ou sobre o nome de quem você ama).",
                "Eu não peço só a cura do corpo.\nEu peço força pra atravessar esse tempo.",
                "Dá sabedoria a quem cuida,\ne coragem pra mim, pra seguir o tratamento até o fim.",
                "Enquanto o corpo se trata,\nque a minha alma descanse em Ti.",
                "Tira de mim o medo do resultado.\nOnde há exame, põe a Tua paz.",
                "Seja qual for a resposta que eu receber,\neu escolho confiar que Tu estás comigo.",
                "Eu não estou enfrentando isso sozinho, sozinha.",
            ],
            fechamento="Amém.",
        ),
        depois="Fique alguns instantes em silêncio. Diga a Deus, em voz alta ou em silêncio, o nome de quem você está entregando hoje, e o que dói.",
        declaracao="Eu não estou enfrentando isso sozinho, sozinha.",
        proximo="Amanhã: Quarto Amém — A Oração da Libertação.",
    ),
    dict(
        numero=4, kicker="7 AMÉNS DA MADRUGADA · DIA 4 DE 7", titulo="Quarto Amém",
        subtitulo="A Oração da Libertação",
        regras=["Horário: entre 4h e 7h da manhã.",
                "Duração: cerca de 8 a 10 minutos, sem pressa.",
                "Reze em voz alta, de preferência acompanhando o áudio guiado.",
                "Escolha um lugar tranquilo, sozinho, sem interrupções."],
        importante="se o que te prende é uma dependência química ou uma compulsão que já machucou a sua vida, esta oração caminha ao lado de tratamento, terapia ou grupo de apoio — ela não substitui isso.",
        antes="Nomeie, dentro de você, o que te prende hoje.",
        preencher="Eu rompo hoje com:",
        oracao=dict(
            abertura="Em nome do Pai, do Filho e do Espírito Santo. Amém.",
            blocos=[
                "Senhor, foi para a liberdade que Cristo me libertou.\nE hoje eu escolho viver essa liberdade.",
                "Hoje eu nomeio diante de Ti aquilo que me prende.\nIsso pode ter começado antes de mim.\nMas, em nome de Jesus, pode terminar em mim.",
                "Eu não vou entregar essa corrente\npra quem vem depois de mim.",
                "Dá-me força hoje, e força a cada dia,\naté que essa corrente não tenha mais poder sobre mim.",
                "Eu escolho a liberdade. Eu escolho recomeçar.",
                "A partir de hoje, essa corrente\nnão tem mais a última palavra sobre a minha vida.",
            ],
            fechamento="Amém.",
        ),
        depois="Diga a Deus, em voz alta ou em silêncio, o nome daquilo que você está rompendo hoje. Se for um padrão de família, peça que essa corrente pare aqui, com você.",
        declaracao="Isso pode terminar em mim.",
        proximo="Amanhã: Quinto Amém — A Oração da Prosperidade.",
    ),
    dict(
        numero=5, kicker="7 AMÉNS DA MADRUGADA · DIA 5 DE 7", titulo="Quinto Amém",
        subtitulo="A Oração da Prosperidade",
        regras=["Horário: entre 4h e 7h da manhã.",
                "Duração: cerca de 8 a 10 minutos, sem pressa.",
                "Reze em voz alta, de preferência acompanhando o áudio guiado.",
                "Escolha um lugar tranquilo, sozinho, sem interrupções."],
        importante="esta oração não promete dinheiro garantido, herança ou prêmio. Ela pede clareza, disciplina e coragem para enxergar e agir sobre oportunidades.",
        antes="Pense na sua situação financeira específica.",
        preencher="Eu apresento a Deus:",
        oracao=dict(
            abertura="Em nome do Pai, do Filho e do Espírito Santo. Amém.",
            blocos=[
                "Senhor, Tu que prometeste suprir aquilo de que eu preciso,\neu trago diante de Ti o meu trabalho e as minhas contas.",
                "Eu não peço um milagre que me poupe de agir.\nEu peço clareza pra enxergar\no caminho que eu ainda não vi.",
                "Dá-me disciplina pra organizar o que está desorganizado,\ne coragem pra bater à porta certa.",
                "Tira de mim a vergonha da dívida,\ne o peso de sentir que eu falhei.",
                "Onde há porta fechada,\nabre uma janela que eu ainda não estou vendo.",
                "Eu escolho ter paciência comigo mesmo\nenquanto essa solução não chega.",
                "Eu confio que a provisão pode vir de onde eu menos espero.",
            ],
            fechamento="Amém.",
        ),
        depois="Diga a Deus, em voz alta ou em silêncio, qual é a sua situação financeira específica. Peça clareza pra ela, com as suas próprias palavras.",
        declaracao="Pode existir uma saída que eu ainda não estou enxergando.",
        proximo="Amanhã: Sexto Amém — A Oração da Paz.",
    ),
    dict(
        numero=6, kicker="7 AMÉNS DA MADRUGADA · DIA 6 DE 7", titulo="Sexto Amém",
        subtitulo="A Oração da Paz",
        regras=["Horário: entre 4h e 7h da manhã.",
                "Duração: cerca de 8 a 10 minutos — boa parte em silêncio.",
                "Este é o dia mais calmo dos sete. Sem pressa nenhuma.",
                "Escolha um lugar tranquilo, sozinho, sem interrupções."],
        importante="se você faz tratamento para ansiedade, insônia ou depressão, continue fazendo. Esta oração é descanso — não substitui o seu tratamento.",
        antes="Feche os olhos, se puder. Respire fundo, sem pressa, três vezes. Você não precisa resolver nada agora — só descansar.",
        preencher=None,
        oracao=dict(
            abertura="Em nome do Pai, do Filho e do Espírito Santo. Amém.",
            blocos=[
                "Senhor, acalma as águas dentro de mim.",
                "Onde há pensamento em excesso, põe silêncio.\nOnde há alerta, põe descanso.",
                "Eu solto, nas Tuas mãos,\ntudo que eu não consigo resolver hoje.",
                "Esta noite, eu descanso.\nAmanhã, Tu cuidas.",
            ],
            fechamento="Amém.",
        ),
        depois="Fique mais um instante em silêncio, só respirando. Se um pensamento insistir em voltar, deixe ele passar — não lute com ele.",
        declaracao="Hoje, eu consigo descansar.",
        proximo="Amanhã: Sétimo Amém — A Oração da Aliança.",
    ),
    dict(
        numero=7, kicker="7 AMÉNS DA MADRUGADA · DIA 7 DE 7", titulo="Sétimo Amém",
        subtitulo="A Oração da Aliança",
        regras=["Horário: entre 4h e 7h da manhã.",
                "Duração: cerca de 9 a 11 minutos, sem pressa.",
                "Hoje você não pede nada novo — você entrega e sela a semana.",
                "Escolha um lugar tranquilo, sozinho, sem interrupções."],
        importante=None,
        antes="Pense em cada pessoa que mora com você, ou que você quer proteger com essa bênção. Respire fundo três vezes.",
        preencher=None,
        oracao=dict(
            abertura="Em nome do Pai, do Filho e do Espírito Santo. Amém.",
            blocos=[
                "Senhor, hoje eu não venho pedir. Eu venho entregar.",
                "Entrego a Ti a conexão que abri no primeiro dia,\ne as mágoas que soltei no segundo.",
                "Entrego a Ti a saúde que apresentei,\ne a corrente que rompi.",
                "Entrego a Ti o trabalho que confiei a Ti,\ne o descanso que recebi.",
                "Cobre a minha casa.\nCobre quem dorme debaixo do meu teto.",
                "Cobre os meus filhos, os meus netos,\ne todos os que ainda virão depois de mim.",
                "Que essa semana seja o começo\nde uma vida de mais fé, mais gratidão, e mais presença.",
                "Eu fiz a minha parte. Agora eu entrego.\nEstá selado.",
            ],
            fechamento="Amém.",
        ),
        depois="Diga, em voz alta ou em silêncio, o nome de cada pessoa que você quer cobrir com essa bênção.",
        declaracao="Eu fiz a minha parte. Agora eu entrego.",
        concluido="Você concluiu os 7 Améns da Madrugada.<br/>Volte a esta oração sempre que quiser selar algo diante de Deus.",
    ),
]

if __name__ == "__main__":
    for d in DAYS:
        out = os.path.join(OUT_DIR, f"dia-{d['numero']:02d}-material-apoio.pdf")
        build_day_pdf(d, out)
        print("built", out)
