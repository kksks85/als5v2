#!/usr/bin/env python3
"""Generate the ALS50 contract creation training guide."""

from pathlib import Path

from fpdf import FPDF
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = BASE_DIR / "ALS50_Create_Contract_Training.pdf"


class ContractTrainingPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(25, 65, 150)
        self.cell(0, 8, "ALS50 CSM Portal - Contract Creation", new_x="LMARGIN", new_y="NEXT", align="C")
        self.set_draw_color(190, 200, 215)
        self.line(12, self.get_y(), 198, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(110, 110, 110)
        self.cell(0, 6, f"ALS50 Contract Creation Guide | Page {self.page_no()}", align="C")


def add_image(pdf, image_name, max_height=180):
    image_path = BASE_DIR / image_name
    if not image_path.exists():
        pdf.set_text_color(180, 0, 0)
        pdf.set_font("Helvetica", "I", 9)
        pdf.cell(0, 5, f"Screenshot not found: {image_name}", new_x="LMARGIN", new_y="NEXT")
        return

    with Image.open(image_path) as image:
        width, height = image.size
    max_width = 186
    scale = min(max_width / width, max_height / height)
    rendered_width = width * scale
    rendered_height = height * scale
    x = (210 - rendered_width) / 2
    pdf.image(str(image_path), x=x, y=pdf.get_y(), w=rendered_width, h=rendered_height)
    pdf.ln(rendered_height + 3)


def add_step(pdf, title, text, image_name=None, image_height=180):
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(25, 65, 150)
    pdf.multi_cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(25, 65, 150)
    pdf.line(12, pdf.get_y(), 198, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(25, 25, 25)
    pdf.multi_cell(0, 5, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    if image_name:
        add_image(pdf, image_name, image_height)


def add_bullet_section(pdf, heading, bullets):
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(25, 65, 150)
    pdf.cell(0, 6, heading, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(25, 25, 25)
    for bullet in bullets:
        pdf.multi_cell(0, 5, f"- {bullet}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def main():
    pdf = ContractTrainingPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(12, 12, 12)

    pdf.add_page()
    pdf.ln(38)
    pdf.set_font("Helvetica", "B", 27)
    pdf.set_text_color(25, 65, 150)
    pdf.multi_cell(0, 13, "How to Create a Contract", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(85, 85, 85)
    pdf.cell(0, 8, "Administrator Training Guide", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(18)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(25, 25, 25)
    pdf.multi_cell(
        0,
        6,
        "This guide explains how an administrator signs in to the ALS50 CSM Portal, opens Contracts, and creates a complete contract record. "
        "Use an approved contract number and validate dates, coverage, deliverables, and spares before saving.",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(15)
    add_bullet_section(pdf, "Guide Contents", [
        "Sign in with the Administrator demo identity.",
        "Open the Contracts workspace and start a new record.",
        "Enter required contract information and dates.",
        "Maintain administrator details, coverage, documentation, deliverables, and spares.",
        "Review and save the contract.",
    ])
    pdf.set_y(255)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(110, 110, 110)
    pdf.cell(0, 5, "Version 1.0 | 12 August 2026", align="C")

    add_step(
        pdf,
        "Step 1: Sign In as Administrator",
        "Open http://localhost:5173. The login screen displays the available demo identities over the ALS50 background. "
        "Select Administrator - Amitabh Sharma (ALS-EMP-001), then choose Continue as Amitabh Sharma. "
        "Use the Administrator identity when maintaining contract master records and related configuration.",
        "contract-login-full.png",
        178,
    )

    add_step(
        pdf,
        "Step 2: Open Contracts",
        "After login, use the left navigation panel and select Contracts. The Contracts page shows existing records and the New contract action. "
        "Use search to confirm that the proposed contract number does not already exist. Select New contract to open the creation form.",
        "contract-list.png",
        176,
    )

    add_step(
        pdf,
        "Step 3: Complete the Contract Record",
        "Enter a unique Contract number and select the Customer. Complete Entry date (contract execution), JRI date (product delivery), and Contract status. "
        "When you enter the JRI date, ALS50 calculates the Warranty expiry date as two years after JRI. Confirm the calculated date and the resulting Warranty status. "
        "Then enter the System and Incident number prefix used for operational tracking.",
        "contract-form-filled.png",
        175,
    )

    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(25, 65, 150)
    pdf.cell(0, 7, "Administrator Details and Final Review", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(25, 65, 150)
    pdf.line(12, pdf.get_y(), 198, pdf.get_y())
    pdf.ln(4)
    add_bullet_section(pdf, "Required Contract Details", [
        "Contract number: unique business identifier for the main contract.",
        "Customer: organization receiving the contracted products or services.",
        "Entry date, JRI date, warranty expiry date, and contract status: core lifecycle controls.",
        "Warranty status: system-calculated from the expiry date; review it rather than entering it manually.",
    ])
    add_bullet_section(pdf, "Administrator-Maintained Operational Details", [
        "System: the relevant product or operational system, such as Loitering Munition.",
        "Incident number prefix: customer or programme prefix applied to incident tracking, for example IAF.",
        "Related subcontracts: add AMC or CMC coverage with subcontract number and valid-from/valid-to dates when applicable.",
        "Documentation: record manuals and versions plus visit record details for support planning.",
        "Deliverables: add every contracted product and its quantity. Use Add deliverable when more lines are needed.",
        "Spares: record spare name, part number, serial number, and quantity. Use Add spare for additional items.",
    ])
    add_bullet_section(pdf, "Save and Verify", [
        "Review all values, especially contract number, customer, dates, coverage periods, and quantities.",
        "Select Save contract at the top or bottom of the form.",
        "After saving, verify the new record in the Contracts list and use View to review the stored details.",
    ])

    pdf.output(str(OUTPUT_PATH))
    print(f"Created {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
