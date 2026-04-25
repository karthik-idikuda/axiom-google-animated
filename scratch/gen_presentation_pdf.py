import sys
import os

# Add backend directory to sys.path so we can import pdf_builder
base_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(base_dir)
sys.path.insert(0, project_dir)

from backend.utils.pdf_builder import build_pdf

md_file = os.path.join(base_dir, "Axiom_Theory_Deep_Dive.md")
pdf_file = os.path.join(base_dir, "Axiom_Theory_Deep_Dive.pdf")

with open(md_file, "r", encoding="utf-8") as f:
    markdown_content = f.read()

# Generate the PDF
pdf_bytes = build_pdf("Axiom Fairness Platform - Theory Deep Dive", markdown_content)

with open(pdf_file, "wb") as f:
    f.write(pdf_bytes)

print(f"Successfully generated {pdf_file}")
