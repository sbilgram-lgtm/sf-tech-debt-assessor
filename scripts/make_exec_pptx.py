"""
Generates an executive PowerPoint presentation for SF Tech Debt Assessor.
Saves to ~/Desktop/SF_Tech_Debt_Assessor_Executive_Presentation.pptx
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import copy

# ── Brand colours ────────────────────────────────────────────────
NAVY      = RGBColor(0x2C, 0x3E, 0x50)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
GREEN     = RGBColor(0x27, 0xAE, 0x60)
BLUE      = RGBColor(0x34, 0x98, 0xDB)
ORANGE    = RGBColor(0xD3, 0x54, 0x00)
RED       = RGBColor(0xC0, 0x39, 0x2B)
PURPLE    = RGBColor(0x8E, 0x44, 0xAD)
LIGHT_BG  = RGBColor(0xF4, 0xF6, 0xF7)
MID_GREY  = RGBColor(0x7F, 0x8C, 0x8D)
DARK_GREY = RGBColor(0x2C, 0x3E, 0x50)

prs = Presentation()
prs.slide_width  = Inches(13.33)
prs.slide_height = Inches(7.5)

BLANK = prs.slide_layouts[6]   # completely blank


# ── Helpers ──────────────────────────────────────────────────────

def add_rect(slide, l, t, w, h, fill=None, line=None):
    shape = slide.shapes.add_shape(1, Inches(l), Inches(t), Inches(w), Inches(h))
    shape.line.fill.background()
    if fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    else:
        shape.fill.background()
    if line:
        shape.line.color.rgb = line
        shape.line.width = Pt(1)
    else:
        shape.line.fill.background()
    return shape

def add_text(slide, text, l, t, w, h,
             size=18, bold=False, color=NAVY, align=PP_ALIGN.LEFT,
             wrap=True, italic=False):
    txBox = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txBox

def add_bullet_box(slide, lines, l, t, w, h, size=13, color=NAVY, bold_first=False, spacing=None):
    txBox = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        p = tf.add_paragraph() if i > 0 else tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        if spacing:
            p.space_before = Pt(spacing)
        run = p.add_run()
        run.text = line
        run.font.size = Pt(size)
        run.font.color.rgb = color
        run.font.bold = (bold_first and i == 0)

def header_band(slide, title, subtitle=None):
    add_rect(slide, 0, 0, 13.33, 1.2, fill=NAVY)
    add_text(slide, title, 0.4, 0.12, 10, 0.6,
             size=28, bold=True, color=WHITE)
    if subtitle:
        add_text(slide, subtitle, 0.4, 0.72, 10, 0.45,
                 size=14, color=RGBColor(0xAB, 0xB2, 0xB9))

def footer(slide, num):
    add_rect(slide, 0, 7.2, 13.33, 0.3, fill=NAVY)
    add_text(slide, "SF Tech Debt Assessor  |  Confidential", 0.3, 7.21, 8, 0.28,
             size=9, color=RGBColor(0xAB, 0xB2, 0xB9))
    add_text(slide, str(num), 12.8, 7.21, 0.4, 0.28,
             size=9, color=RGBColor(0xAB, 0xB2, 0xB9), align=PP_ALIGN.RIGHT)


# ══════════════════════════════════════════════════════════════════
# SLIDE 1 — Title
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=NAVY)
add_rect(slide, 0, 5.8, 13.33, 1.7, fill=GREEN)

add_text(slide, "SF Tech Debt Assessor", 0.6, 1.6, 12, 1.1,
         size=44, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
add_text(slide, "Automated Salesforce Org Health Assessment", 0.6, 2.75, 12, 0.6,
         size=22, color=RGBColor(0xAB, 0xB2, 0xB9), align=PP_ALIGN.CENTER)
add_text(slide, "Executive Overview", 0.6, 3.35, 12, 0.5,
         size=16, color=RGBColor(0xAB, 0xB2, 0xB9), align=PP_ALIGN.CENTER, italic=True)
add_text(slide, "Steven Bilgram  |  2026", 0.6, 6.0, 12, 0.5,
         size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════
# SLIDE 2 — The Problem
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=LIGHT_BG)
header_band(slide, "The Problem", "Org health reviews are manual, inconsistent, and time-consuming")
footer(slide, 2)

pain_points = [
    ("⏱  4–8 Hours of Manual Work",
     "Each assessment requires navigating Setup, running ad-hoc SOQL queries,\nand writing a findings document by hand."),
    ("📋  No Standardised Methodology",
     "Coverage depends entirely on individual consultant experience.\n~60–70% of risk areas are reviewed in a typical manual assessment."),
    ("🔍  No Drill-Down to Root Cause",
     "Findings are high-level. Clients cannot see which specific records,\nrules, or users are causing the score reduction."),
    ("📂  No Structured Remediation Path",
     "Recommendations are delivered as narrative text — rarely assigned,\nrarely actioned. ~30–40% of findings result in a task within 90 days."),
]

for i, (title, body) in enumerate(pain_points):
    col = 0.35 if i % 2 == 0 else 6.85
    top = 1.45 if i < 2 else 4.0
    add_rect(slide, col, top, 6.0, 2.3, fill=WHITE, line=RED)
    add_text(slide, title, col + 0.2, top + 0.15, 5.6, 0.45,
             size=13, bold=True, color=RED)
    add_text(slide, body, col + 0.2, top + 0.62, 5.6, 1.5,
             size=12, color=NAVY)


# ══════════════════════════════════════════════════════════════════
# SLIDE 3 — The Solution
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=LIGHT_BG)
header_band(slide, "The Solution", "SF Tech Debt Assessor — from zero to scored report in under 5 minutes")
footer(slide, 3)

add_text(slide, "A web app that connects directly to any Salesforce org via OAuth and automatically "
         "runs a scored technical debt assessment across 19 categories — producing a stakeholder-ready "
         "report, drill-down record detail, and a phased remediation roadmap.",
         0.4, 1.3, 12.5, 0.9, size=14, color=NAVY)

steps = [
    ("1", "Connect", "Authenticate via OAuth\nusing your org credentials"),
    ("2", "Assess",  "19-category scan runs\nautomatically in minutes"),
    ("3", "Review",  "Scored report with\ndrill-down to affected records"),
    ("4", "Export",  "PDF · Excel · CSV ·\nRemediation Roadmap"),
]

for i, (num, title, body) in enumerate(steps):
    x = 0.35 + i * 3.17
    add_rect(slide, x, 2.45, 2.85, 2.8, fill=NAVY)
    add_text(slide, num, x + 0.2, 2.55, 0.5, 0.55,
             size=28, bold=True, color=GREEN)
    add_text(slide, title, x + 0.2, 3.15, 2.5, 0.45,
             size=15, bold=True, color=WHITE)
    add_text(slide, body, x + 0.2, 3.65, 2.5, 1.4,
             size=12, color=RGBColor(0xAB, 0xB2, 0xB9))
    if i < 3:
        add_text(slide, "→", x + 2.88, 3.4, 0.3, 0.5,
                 size=20, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

add_text(slide, "Deployed at: sf-tech-debt-assessor.onrender.com", 0.4, 5.55, 12.5, 0.4,
         size=12, italic=True, color=MID_GREY, align=PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════
# SLIDE 4 — 19 Assessment Categories
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=LIGHT_BG)
header_band(slide, "What It Assesses", "19 categories covering the full Salesforce technical stack")
footer(slide, 4)

categories = [
    "Configuration",         "Code Quality",           "Data Model",
    "Service Cloud",         "Sharing & Security",     "Integrations",
    "Test Coverage",         "Org Limits",             "Duplicate & Matching Rules",
    "Reports & Dashboards",  "Email Templates",        "Platform Events & CDC",
    "Managed Packages",      "Custom Metadata",        "Record Types & Layouts",
    "Einstein & AI Usage",   "Territory Management",   "Experience Cloud",
    "Connected App Security",
]

cols = 3
col_w = 4.1
for i, cat in enumerate(categories):
    col = i % cols
    row = i // cols
    x = 0.35 + col * col_w
    y = 1.4 + row * 0.58
    add_rect(slide, x, y, col_w - 0.15, 0.46, fill=WHITE, line=BLUE)
    add_text(slide, f"✓  {cat}", x + 0.15, y + 0.05, col_w - 0.35, 0.36,
             size=11.5, color=NAVY, bold=False)


# ══════════════════════════════════════════════════════════════════
# SLIDE 5 — Value Proposition
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=LIGHT_BG)
header_band(slide, "Value Proposition", "What changes for every persona who uses the tool")
footer(slide, 5)

personas = [
    (BLUE,   "Consultant / SA",        "Delivers a scored assessment in the kickoff meeting.\nEliminates 4–8 hrs of manual work per engagement."),
    (GREEN,  "Salesforce Admin",       "Gains visibility into hidden risk.\nSelf-sufficient — no consultant required."),
    (PURPLE, "IT Manager / Director",  "Receives evidence-backed, export-ready reports.\nFaster decisions, clearer remediation investment."),
    (ORANGE, "Practice Lead",          "Standardises delivery across the team.\nEnables a repeatable assessment service offering."),
    (NAVY,   "Customer Success Mgr",   "Identifies at-risk customers before issues escalate.\nElevates QBRs with objective org health scores."),
    (RED,    "End Client / Stakeholder","Understands risk without deep Salesforce expertise.\nReceives a phased action plan on day one."),
]

for i, (color, persona, desc) in enumerate(personas):
    col = i % 2
    row = i // 2
    x = 0.35 + col * 6.45
    y = 1.4 + row * 1.85
    add_rect(slide, x, y, 6.1, 1.65, fill=WHITE, line=color)
    add_rect(slide, x, y, 0.18, 1.65, fill=color)
    add_text(slide, persona, x + 0.35, y + 0.12, 5.6, 0.38,
             size=13, bold=True, color=color)
    add_text(slide, desc, x + 0.35, y + 0.52, 5.6, 1.0,
             size=11.5, color=NAVY)


# ══════════════════════════════════════════════════════════════════
# SLIDE 6 — Quantified Impact
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=LIGHT_BG)
header_band(slide, "Quantified Impact", "Measured against the manual assessment baseline")
footer(slide, 6)

metrics = [
    (GREEN,  "6–8 hrs",    "Saved per\nassessment"),
    (BLUE,   "60–70%",     "Reduction in\ntime to first action"),
    (PURPLE, "3–5×",       "Increase in\nassessment frequency"),
    (ORANGE, "$900–$2K",   "Cost savings\nper engagement"),
    (RED,    "20–30%",     "Reduction in reactive\nsupport cases / quarter"),
    (NAVY,   "100%",       "Category coverage\nevery time"),
]

for i, (color, value, label) in enumerate(metrics):
    col = i % 3
    row = i // 3
    x = 0.35 + col * 4.3
    y = 1.45 + row * 2.65
    add_rect(slide, x, y, 3.95, 2.25, fill=WHITE, line=color)
    add_text(slide, value, x + 0.2, y + 0.2, 3.55, 0.85,
             size=34, bold=True, color=color, align=PP_ALIGN.CENTER)
    add_text(slide, label, x + 0.2, y + 1.1, 3.55, 0.9,
             size=12.5, color=NAVY, align=PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════
# SLIDE 7 — Key Outputs
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=LIGHT_BG)
header_band(slide, "Key Outputs", "Every assessment produces four ready-to-use artifacts")
footer(slide, 7)

outputs = [
    (BLUE,   "Export PDF",
     "Full scored report with category breakdowns, "
     "findings, recommendations, and affected records per issue. "
     "Ideal for customer presentations and stakeholder reviews."),
    (GREEN,  "Export Excel",
     "One tab per category plus a Summary tab. "
     "Each tab lists all findings with affected records inline. "
     "Opens directly in Excel for further analysis or import."),
    (GREEN,  "Export CSV",
     "Flat file with one row per affected record across all categories. "
     "Ideal for importing into a project tracker, Jira, or remediation backlog."),
    (PURPLE, "Remediation Roadmap",
     "Full-screen phased roadmap grouped by severity (Critical → High → Medium → Low), "
     "then by category. Each item includes title, description, recommended action, "
     "and record count. Print or save as PDF in one click."),
]

for i, (color, title, body) in enumerate(outputs):
    col = i % 2
    row = i // 2
    x = 0.35 + col * 6.45
    y = 1.4 + row * 2.6
    add_rect(slide, x, y, 6.1, 2.35, fill=WHITE, line=color)
    add_rect(slide, x, y, 6.1, 0.48, fill=color)
    add_text(slide, title, x + 0.2, y + 0.07, 5.7, 0.38,
             size=14, bold=True, color=WHITE)
    add_text(slide, body, x + 0.2, y + 0.65, 5.7, 1.55,
             size=11.5, color=NAVY)


# ══════════════════════════════════════════════════════════════════
# SLIDE 8 — Call to Action
# ══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
add_rect(slide, 0, 0, 13.33, 7.5, fill=NAVY)
add_rect(slide, 0, 5.8, 13.33, 1.7, fill=GREEN)

add_text(slide, "Ready to See It in Action?", 0.6, 1.2, 12, 0.9,
         size=36, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
add_text(slide,
         "SF Tech Debt Assessor is live and available today.\n"
         "Connect any Salesforce org and run a full 19-category assessment in under 5 minutes.",
         0.6, 2.2, 12, 0.9,
         size=16, color=RGBColor(0xAB, 0xB2, 0xB9), align=PP_ALIGN.CENTER)

add_rect(slide, 3.67, 3.3, 6.0, 0.72, fill=GREEN)
add_text(slide, "sf-tech-debt-assessor.onrender.com",
         3.67, 3.33, 6.0, 0.65,
         size=16, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

add_text(slide, "Built by Steven Bilgram", 0.6, 6.05, 12, 0.4,
         size=13, color=WHITE, align=PP_ALIGN.CENTER)


# ── Save ─────────────────────────────────────────────────────────
import os
out = os.path.expanduser("~/Desktop/SF_Tech_Debt_Assessor_Executive_Presentation.pptx")
prs.save(out)
print(f"Saved: {out}")
