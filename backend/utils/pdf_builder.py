"""Simple PDF builder for fairness audit reports."""
from __future__ import annotations

import io
import re

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _md_to_rl(line: str) -> str:
    """Convert common markdown inline formatting to ReportLab XML tags."""
    # Escape XML-special chars first (& must be first)
    line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Bold: **text** or __text__
    line = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
    line = re.sub(r"__(.+?)__", r"<b>\1</b>", line)
    # Italic: *text* or _text_
    line = re.sub(r"\*(.+?)\*", r"<i>\1</i>", line)
    line = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<i>\1</i>", line)
    # Inline code: `text`
    line = re.sub(r"`(.+?)`", r"<font face='Courier'>\1</font>", line)
    # Bullet points
    if line.startswith("- ") or line.startswith("• "):
        line = "• " + line[2:]
    return line


def build_pdf(title: str, markdown_report: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
    for line in markdown_report.splitlines():
        line = line.strip()
        if not line:
            story.append(Spacer(1, 6))
            continue
        if line.startswith("# "):
            story.append(Paragraph(_md_to_rl(line[2:]), styles["Heading1"]))
        elif line.startswith("## "):
            story.append(Paragraph(_md_to_rl(line[3:]), styles["Heading2"]))
        elif line.startswith("### "):
            story.append(Paragraph(_md_to_rl(line[4:]), styles["Heading3"]))
        else:
            story.append(Paragraph(_md_to_rl(line), styles["BodyText"]))
    doc.build(story)
    return buf.getvalue()
