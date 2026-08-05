#!/usr/bin/env python3
"""
ALS50 CRM Training Document Generator

Generates a comprehensive training PDF for creating customers in the ALS50 CRM system.
Includes login procedure, navigation, and step-by-step customer creation workflow.
"""

from fpdf import FPDF
from PIL import Image
import os

class TrainingPDF(FPDF):
    """Custom FPDF class with header and footer"""

    def header(self):
        """Add header to each page"""
        # Logo/Title
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(25, 65, 150)  # ALS50 blue
        self.cell(0, 10, "ALS50 CSM Portal", ln=True, align="C")
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, "Customer Service Management System", ln=True, align="C")
        self.ln(5)
        # Divider line
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def footer(self):
        """Add footer to each page"""
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def add_cover_page(pdf):
    """Add the cover page"""
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(25, 65, 150)
    pdf.ln(40)
    pdf.cell(0, 20, "How to Create a Customer", ln=True, align="C")
    pdf.set_font("Helvetica", "I", 14)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 10, "Training Guide", ln=True, align="C")

    pdf.ln(20)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(0, 0, 0)

    pdf.multi_cell(0, 6,
        "This document provides step-by-step instructions for using the ALS50 "
        "Customer Service Management Portal. Learn how to log in, navigate to "
        "the Customers module, and create a new customer record with contact information."
    )

    pdf.ln(30)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Contents:", ln=True)
    pdf.set_font("Helvetica", "", 10)

    contents = [
        "1. Logging Into ALS50",
        "2. Welcome to the Dashboard",
        "3. Navigate to Customers Module",
        "4. Click New Customer Button",
        "5. Enter Customer Basic Information",
        "6. Add Primary Contact Information",
        "7. Optional - Add Additional Contact (Advanced)",
        "8. Save the Customer Record",
        "9. View Customer Details"
    ]

    for item in contents:
        pdf.cell(0, 6, item, ln=True)

    pdf.set_xy(10, 250)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(128, 128, 128)
    pdf.cell(0, 5, "Version 1.0 - August 2026", align="C")

def add_training_step(pdf, title, description, image_path=None):
    """Add a training step with title, description, and optional image"""
    pdf.add_page()

    # Title (smaller to make room for larger image)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(25, 65, 150)
    pdf.cell(0, 8, title, ln=True)
    pdf.set_draw_color(25, 65, 150)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)

    # Description (smaller font, less space)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(0, 4, description)
    pdf.ln(2)

    # Image if provided - FULL PAGE SIZE
    if image_path and os.path.exists(image_path):
        try:
            # Get image dimensions
            img = Image.open(image_path)
            img_width, img_height = img.size

            # Calculate scaling to fill page width (A4 is 210mm, minus 15mm margins = 180mm)
            # But we want to use nearly full width: 185mm
            max_width = 185  # Full width minus minimal margins
            max_height = 250  # Full height available

            scale = min(max_width / img_width, max_height / img_height)
            new_width = img_width * scale
            new_height = img_height * scale

            # Center the image horizontally
            x = (210 - new_width) / 2
            pdf.image(image_path, x=x, y=pdf.get_y(), w=new_width, h=new_height)
            pdf.ln(new_height + 3)
        except Exception as e:
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(200, 0, 0)
            pdf.cell(0, 5, f"[Image not available: {str(e)}]", ln=True)

def main():
    """Generate the training PDF"""

    # Initialize PDF
    pdf = TrainingPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Base directory for screenshots
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Add cover page
    add_cover_page(pdf)

    # Training steps
    steps = [
        {
            "title": "Step 1: Logging Into ALS50",
            "description":
                "Open your web browser and navigate to the ALS50 Portal URL (http://localhost:5173). You will see the login page "
                "displaying a complete list of demo identities available for testing. The system provides multiple pre-configured test users "
                "representing different roles and departments. Select the 'Administrator' option (Amitabh Sharma, amitabh.sharma@aerofix.in, ALS-EMP-001). "
                "Click 'Continue as Amitabh Sharma' to proceed with authentication and access the ALS50 system.",
            "image": os.path.join(base_dir, "01-login-page.png")
        },
        {
            "title": "Step 2: Welcome to the Dashboard",
            "description":
                "After successful login as Administrator, you will see the ALS50 Dashboard - your main home screen. "
                "The dashboard displays key metrics and performance indicators including Total Incidents (96), Cases (78), "
                "Critical issues (20), and Resolved incidents (0). You can see various dashboard panels for Incidents, Labels, "
                "and Open items with colored metrics. The top navigation bar shows the 'All customers' dropdown, notifications, "
                "and your profile (AS). This dashboard provides an overview of system activity and quick access to various modules.",
            "image": os.path.join(base_dir, "02-dashboard.png")
        },
        {
            "title": "Step 3: Navigate to Customers Module",
            "description":
                "From the dashboard or sidebar, click on the 'Customers' option in the left navigation menu. This takes you to "
                "the Customers management page showing a comprehensive list of all existing customers in the system. The page displays: "
                "a search box to find specific customers, an 'Extract data' button for data export, and a blue 'New customer' button "
                "to create new records. The customer list shows the total count (currently 7 customers) and displays a table with "
                "columns for Customer Name, Customer Number, Primary Address, Primary Contact, Phone, and Email.",
            "image": os.path.join(base_dir, "03-customers-list.png")
        },
        {
            "title": "Step 4: Click New Customer Button",
            "description":
                "Click the blue 'New Customer' button to open the customer creation form. The form displays with: "
                "a page title 'New customer' and description 'Create a new customer and configure contacts'. "
                "The form is organized into three main sections: Customer Details, Primary Contact, and Additional Contacts. "
                "Save and Cancel buttons are available at the top and bottom of the form. The Customer Details section has three text fields: "
                "Customer name (placeholder: 'e.g. Indian Air Force'), Customer number (placeholder: 'e.g. TASL-CUST-001'), and Primary address "
                "(placeholder: 'e.g. Headquarters location'). The form is ready for data entry.",
            "image": os.path.join(base_dir, "04-new-customer-blank.png")
        },
        {
            "title": "Step 5: Enter Customer Basic Information",
            "description":
                "Fill in the Customer Details section with the following information: "
                "* Customer Name: Enter the official organization name. Example: 'Department of Aerospace' "
                "* Customer Number: Provide a unique identifier in TASL-CUST-XXX format. Example: 'TASL-CUST-009' "
                "* Primary Address: Enter the main office headquarters location. Example: 'HAL Campus, Bangalore 560037' "
                "These three fields form the core customer identification information. The form shows all three fields properly filled "
                "with the example data, ready for the next section.",
            "image": os.path.join(base_dir, "05-customer-details-filled.png")
        },
        {
            "title": "Step 6: Add Primary Contact Information",
            "description":
                "Scroll down to the 'Primary Contact' section and enter the main contact person's details: "
                "* Contact Name: Full name of the primary contact. Example: 'Smt. Deepa Sharma' "
                "* Designation: Job title or role. Example: 'Director General' "
                "* Contact Email: Official email address. Example: 'deepa.sharma@hal.co.in' "
                "* Contact Phone: Phone number with country code. Example: '+91 9021001234' "
                "* Rank: Official rank or position level. Example: 'Senior Official' "
                "* Site: Primary site or office location. Example: 'Bangalore' "
                "The primary contact serves as the main point of communication with the customer and is required for every customer record.",
            "image": os.path.join(base_dir, "06-primary-contact-filled.png")
        },
        {
            "title": "Step 7: Optional - Add Additional Contact (Advanced)",
            "description":
                "The form also provides an 'Additional Contacts' section for adding secondary contact persons. "
                "This section includes fields for: Rank, Contact Name, Designation, Phone Number, Email, Site Name, and Site Address. "
                "You can fill in an additional contact person's information if needed. Example values: "
                "Rank: 'Wing Commander', Name: 'Wg Cdr Rajesh Rao', Designation: 'Operations Head', "
                "Phone: '+91 9022001234', Email: 'rajesh.rao@hal.co.in', Site: 'Operations Center', "
                "Address: 'HAL Operations, Bangalore'. After filling, click 'Add Contact' button to add this contact to the system. "
                "Additional contacts are optional and can be added later.",
            "image": os.path.join(base_dir, "07-additional-contact-filled.png")
        },
        {
            "title": "Step 8: Save the Customer Record",
            "description":
                "After filling in all required customer and primary contact information, click the blue 'Save' button "
                "(available at both top and bottom of the form). The system validates all entries and saves the new customer record. "
                "Once saved successfully, the form closes and you are automatically returned to the Customers list view. "
                "The system displays the updated customer list showing all customers including the newly created record. "
                "A success message confirms the customer has been created. The total customer count increases by 1.",
            "image": os.path.join(base_dir, "08-customer-saved-list.png")
        },
        {
            "title": "Step 9: View Customer Details",
            "description":
                "To view complete information for any customer, click the 'View' button on that customer's row in the list. "
                "The customer detail page displays all stored information in an organized format. For 'Department of Aerospace' (TASL-CUST-009), "
                "you can see: Customer Details section with Name, Number, and Address; Primary Contact section with Name (Wg Cdr Rajesh Rao), "
                "Designation (Director General), Email (deepa.sharma@hal.co.in), Phone (+91 9021001234), Rank (Senior Official), and Site (Bangalore); "
                "and Additional Contacts section. The detail view also provides 'Close' and 'Edit' buttons for managing the customer record.",
            "image": os.path.join(base_dir, "09-customer-detail-view.png")
        }
    ]

    # Add all training steps
    for step in steps:
        add_training_step(pdf, step["title"], step["description"], step["image"])

    # Add closing page with quick reference
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(25, 65, 150)
    pdf.cell(0, 10, "Quick Reference Guide", ln=True)
    pdf.set_draw_color(25, 65, 150)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(0, 0, 0)

    sections = [
        ("Key Fields for Customer Creation:", [
            "- Customer Name: Official organization name",
            "- Customer Number: Unique identifier (TASL-CUST-XXX format)",
            "- Primary Address: Main office headquarters location"
        ]),
        ("Primary Contact Information:", [
            "- Name: Full name of main contact person",
            "- Designation: Job title or role",
            "- Email: Official email address",
            "- Phone: Contact number with country code",
            "- Rank: Official rank or position",
            "- Site: Primary location or office"
        ]),
        ("Helpful Tips:", [
            "* Use the search function to quickly find existing customers",
            "* Primary contact information can be updated by editing the customer record",
            "* Additional contacts can be added to maintain a complete contact database",
            "* Always verify customer information before saving to ensure accuracy"
        ])
    ]

    for section_title, items in sections:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, section_title, ln=True)
        pdf.set_font("Helvetica", "", 10)
        for item in items:
            pdf.cell(0, 6, item, ln=True)
        pdf.ln(2)

    # Output the PDF
    output_path = os.path.join(base_dir, "ALS50_Create_Customer_Training.pdf")
    pdf.output(output_path)
    print(f"Training PDF generated successfully: {output_path}")

if __name__ == "__main__":
    main()
