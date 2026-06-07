from fpdf import FPDF

# ---- Palette sobre / corporate ----
INK = (30, 41, 59)        # slate-800
HEADER = (15, 23, 42)     # slate-900
ACCENT = (37, 99, 235)    # blue-600
MUTED = (100, 116, 139)   # slate-500
LINE = (226, 232, 240)    # slate-200
ROW_ALT = (248, 250, 252) # slate-50
INBORIA_BG = (235, 242, 254)
INBORIA_BG_HEAD = (29, 78, 216)  # blue-700
OK = (21, 128, 61)        # green-700
PARTIAL = (180, 120, 4)   # amber-700
NO = (148, 163, 184)      # slate-400

COLS = [66, 28.5, 28.5, 28.5, 28.5]  # total 180mm
HEADERS = ["Fonctionnalité", "Inboria", "Superhuman", "Front", "Missive"]

SECTIONS = [
    ("Intelligence artificielle", [
        ("Tri / priorisation par IA (Smart Sort)", "Oui", "Partiel", "Partiel", "Partiel"),
        ("Résumés d'emails par IA", "Oui", "Partiel", "Partiel", "Partiel"),
        ("Brouillons / réponses par IA", "Oui", "Oui", "Partiel", "Partiel"),
        ("Détection automatique des relances", "Oui", "Non", "Non", "Non"),
        ("Mémoire contextuelle 360° par contact", "Oui", "Non", "Partiel", "Partiel"),
        ("Chatbot IA contextuel", "Oui", "Non", "Non", "Non"),
    ]),
    ("Vitesse & fluidité", [
        ("Palette de commandes (Cmd+K)", "Oui", "Oui", "Partiel", "Partiel"),
        ("Raccourcis clavier complets", "Oui", "Oui", "Partiel", "Partiel"),
        ("Snooze / Reporter un email", "Oui", "Oui", "Oui", "Oui"),
        ("Programmer l'envoi", "Oui", "Oui", "Oui", "Oui"),
    ]),
    ("Collaboration B2B", [
        ("Boîtes partagées", "Oui", "Partiel", "Oui", "Oui"),
        ("Assignation d'emails", "Oui", "Non", "Oui", "Oui"),
        ("Commentaires internes", "Oui", "Non", "Oui", "Oui"),
        ("Co-rédaction en temps réel", "Oui", "Non", "Partiel", "Oui"),
        ("Suggestion d'expert par IA", "Oui", "Non", "Non", "Non"),
    ]),
    ("Couverture & international", [
        ("Multilingue (43 langues soignées)", "Oui", "Partiel", "Partiel", "Partiel"),
        ("CRM intégré (HubSpot/Pipedrive/SF/Odoo)", "Oui", "Non", "Oui", "Partiel"),
        ("Agenda / propositions de RDV", "Oui", "Non", "Partiel", "Partiel"),
        ("Multi-fournisseurs (Gmail/Outlook/IMAP)", "Oui", "Partiel", "Oui", "Oui"),
    ]),
]

STATUS_COLOR = {"Oui": OK, "Partiel": PARTIAL, "Non": NO}


class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_y(8)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 5, "Inboria  -  Analyse comparative", align="L")
        self.set_font("Helvetica", "", 9)
        self.cell(0, 5, "inboria.com", align="R")
        self.ln(7)
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        self.line(15, self.get_y(), 195, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-14)
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        self.line(15, self.get_y(), 195, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, "Inboria - Email Autopilot piloté par IA  -  Confidentiel", align="L")
        self.cell(0, 5, f"Page {self.page_no()}", align="R")


def section_title(pdf, txt):
    if pdf.get_y() > 245:
        pdf.add_page()
    pdf.ln(3)
    y = pdf.get_y()
    pdf.set_fill_color(*ACCENT)
    pdf.rect(15, y + 0.5, 1.6, 5.2, "F")
    pdf.set_xy(19, y)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*INK)
    pdf.cell(0, 6, txt)
    pdf.ln(8.5)


def table_head(pdf):
    pdf.set_font("Helvetica", "B", 8.5)
    x = 15
    h = 8
    y = pdf.get_y()
    for i, (w, label) in enumerate(zip(COLS, HEADERS)):
        if i == 1:
            pdf.set_fill_color(*INBORIA_BG_HEAD)
            pdf.set_text_color(255, 255, 255)
        else:
            pdf.set_fill_color(*HEADER)
            pdf.set_text_color(255, 255, 255)
        pdf.set_xy(x, y)
        align = "L" if i == 0 else "C"
        pad = 2 if i == 0 else 0
        pdf.cell(w, h, ("  " + label) if i == 0 else label, align=align, fill=True)
        x += w
    pdf.set_xy(15, y + h)


def table_rows(pdf, rows):
    h = 7.4
    for r_idx, row in enumerate(rows):
        if pdf.get_y() + h > 270:
            pdf.add_page()
            table_head(pdf)
        x = 15
        y = pdf.get_y()
        alt = ROW_ALT if r_idx % 2 == 1 else (255, 255, 255)
        # feature cell
        pdf.set_fill_color(*alt)
        pdf.set_xy(x, y)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(*INK)
        pdf.cell(COLS[0], h, "  " + row[0], align="L", fill=True)
        x += COLS[0]
        # status cells
        for i in range(1, 5):
            val = row[i]
            if i == 1:
                pdf.set_fill_color(*INBORIA_BG)
            else:
                pdf.set_fill_color(*alt)
            pdf.set_xy(x, y)
            pdf.cell(COLS[i], h, "", fill=True)
            pdf.set_xy(x, y)
            pdf.set_font("Helvetica", "B" if i == 1 else "", 8.5)
            pdf.set_text_color(*STATUS_COLOR[val])
            pdf.cell(COLS[i], h, val, align="C")
            x += COLS[i]
        pdf.set_xy(15, y + h)
    # bottom border
    pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.2)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())


pdf = PDF(orientation="P", unit="mm", format="A4")
pdf.set_auto_page_break(auto=True, margin=18)
pdf.set_margins(15, 15, 15)
pdf.add_page()

# ---- Cover band ----
pdf.set_fill_color(*HEADER)
pdf.rect(0, 0, 210, 52, "F")
pdf.set_fill_color(*ACCENT)
pdf.rect(0, 52, 210, 1.4, "F")
pdf.set_xy(15, 14)
pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(180, 200, 255)
pdf.cell(0, 6, "INBORIA")
pdf.set_xy(15, 22)
pdf.set_font("Helvetica", "B", 22)
pdf.set_text_color(255, 255, 255)
pdf.cell(0, 10, "Inboria vs Concurrents")
pdf.set_xy(15, 34)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(200, 210, 230)
pdf.cell(0, 6, "Analyse comparative fonctionnelle  -  Juin 2026")

pdf.set_y(60)
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(*INK)
intro = ("Comparatif d'Inboria face aux références du marché de l'email professionnel : "
         "Superhuman (vitesse), Front et Missive (boîtes partagées collaboratives). "
         "Évaluation fonctionnalité par fonctionnalité, sur les axes où se joue la décision d'achat.")
pdf.multi_cell(0, 5.5, intro)
pdf.ln(1)

# ---- Sections ----
for title, rows in SECTIONS:
    section_title(pdf, title)
    table_head(pdf)
    table_rows(pdf, rows)
    pdf.ln(2)

# ---- Legend ----
pdf.ln(2)
pdf.set_font("Helvetica", "B", 8.5)
pdf.set_text_color(*MUTED)
pdf.cell(20, 5, "Légende :  ")
pdf.set_text_color(*OK)
pdf.cell(16, 5, "Oui", align="L")
pdf.set_text_color(*MUTED)
pdf.set_font("Helvetica", "", 8.5)
pdf.cell(28, 5, "= solide / natif")
pdf.set_font("Helvetica", "B", 8.5)
pdf.set_text_color(*PARTIAL)
pdf.cell(16, 5, "Partiel")
pdf.set_text_color(*MUTED)
pdf.set_font("Helvetica", "", 8.5)
pdf.cell(34, 5, "= limité / via add-on")
pdf.set_font("Helvetica", "B", 8.5)
pdf.set_text_color(*NO)
pdf.cell(12, 5, "Non")
pdf.set_text_color(*MUTED)
pdf.set_font("Helvetica", "", 8.5)
pdf.cell(20, 5, "= absent")
pdf.ln(10)

# ---- Key message callout ----
if pdf.get_y() > 235:
    pdf.add_page()
y = pdf.get_y()
pdf.set_fill_color(244, 247, 252)
pdf.set_draw_color(*ACCENT)
box_h = 34
pdf.rect(15, y, 180, box_h, "F")
pdf.set_fill_color(*ACCENT)
pdf.rect(15, y, 1.6, box_h, "F")
pdf.set_xy(20, y + 5)
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(*ACCENT)
pdf.cell(0, 5, "Le positionnement en une phrase")
pdf.set_xy(20, y + 12)
pdf.set_font("Helvetica", "B", 12)
pdf.set_text_color(*INK)
msg = ('"Front et Missive donnent la boîte partagée. Superhuman donne la vitesse. '
       'Inboria réunit les deux - piloté par une IA que personne d\'autre n\'a, en 43 langues."')
pdf.multi_cell(170, 6.5, msg)

pdf.ln(8)
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*MUTED)
pdf.multi_cell(0, 5, ("Note : évaluation établie à partir de l'état fonctionnel vérifié d'Inboria (palette de commandes, "
                      "raccourcis clavier, boîtes partagées, co-rédaction temps réel, IA de tri/relances, 43 langues) "
                      "et du positionnement public des concurrents. Les axes restant à consolider côté Inboria : "
                      "finition de la fluidité perçue et preuve à l'échelle sur de gros volumes."))

out = "exports/Inboria_vs_Concurrents.pdf"
import os
os.makedirs("exports", exist_ok=True)
pdf.output(out)
print("written", out)
