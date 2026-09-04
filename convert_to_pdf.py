#!/usr/bin/env python3
"""
Convert Security Assessment HTML to PDF
Tries multiple methods to generate PDF from HTML
"""

import os
import subprocess
import sys
from pathlib import Path

def install_tool(package_name, tool_name):
    """Try to install a Python package."""
    print(f"Attempting to install {package_name}...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
        print(f"✅ {package_name} installed successfully")
        return True
    except subprocess.CalledProcessError:
        print(f"❌ Failed to install {package_name}")
        return False

def convert_html_to_pdf_weasyprint(html_file, pdf_file):
    """Convert HTML to PDF using weasyprint."""
    try:
        from weasyprint import HTML, CSS
        
        print(f"🔄 Converting {html_file} to PDF using WeasyPrint...")
        HTML(html_file).write_pdf(pdf_file)
        print(f"✅ PDF created: {pdf_file}")
        return True
    except ImportError:
        print("⚠️  weasyprint not available, trying to install...")
        if install_tool("weasyprint", "WeasyPrint"):
            return convert_html_to_pdf_weasyprint(html_file, pdf_file)
        return False
    except Exception as e:
        print(f"❌ Error with WeasyPrint: {e}")
        return False

def convert_html_to_pdf_pdfkit(html_file, pdf_file):
    """Convert HTML to PDF using pdfkit (requires wkhtmltopdf)."""
    try:
        import pdfkit
        
        print(f"🔄 Converting {html_file} to PDF using pdfkit...")
        pdfkit.from_file(html_file, pdf_file)
        print(f"✅ PDF created: {pdf_file}")
        return True
    except ImportError:
        print("⚠️  pdfkit not available")
        return False
    except Exception as e:
        print(f"❌ Error with pdfkit: {e}")
        return False

def convert_html_to_pdf_reportlab(html_file, pdf_file):
    """Convert HTML to PDF using reportlab."""
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        
        print(f"🔄 Converting {html_file} to PDF using ReportLab...")
        
        # Read HTML
        with open(html_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Create PDF
        doc = SimpleDocTemplate(pdf_file, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Simple parsing of HTML content
        lines = html_content.split('\n')
        for line in lines:
            if line.strip():
                story.append(Paragraph(line, styles['Normal']))
        
        doc.build(story)
        print(f"✅ PDF created: {pdf_file}")
        return True
    except ImportError:
        print("⚠️  reportlab not available")
        return False
    except Exception as e:
        print(f"❌ Error with ReportLab: {e}")
        return False

def create_pdf_from_markdown(md_files, pdf_file):
    """Create PDF directly from markdown files."""
    try:
        # Try using pypandoc if available
        try:
            import pypandoc
            print("🔄 Converting markdown to PDF using Pandoc...")
            
            # Concatenate all markdown files
            full_content = ""
            for md_file in md_files:
                if Path(md_file).exists():
                    with open(md_file, 'r', encoding='utf-8') as f:
                        full_content += f.read() + "\n\n"
            
            # Convert to PDF
            output = pypandoc.convert_text(
                full_content,
                'pdf',
                format='md',
                outputfile=pdf_file,
                extra_args=['--pdf-engine=wkhtmltopdf']
            )
            print(f"✅ PDF created: {pdf_file}")
            return True
        except ImportError:
            print("⚠️  pypandoc not available")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def manual_instructions():
    """Provide manual conversion instructions."""
    print("\n" + "="*70)
    print("📋 MANUAL PDF CONVERSION INSTRUCTIONS")
    print("="*70)
    print("""
The HTML report has been successfully generated at:
  Security_Assessment_Report.html

To convert to PDF, you have several options:

OPTION 1: Using Your Web Browser (EASIEST) ✅
  1. Open: Security_Assessment_Report.html in your web browser
  2. Press: Ctrl+P (Windows/Linux) or Cmd+P (Mac)
  3. Select: "Save as PDF"
  4. Name it: "Security_Assessment_Report.pdf"
  5. Click: Save

OPTION 2: Install Python PDF Tools
  a) Install WeasyPrint:
     pip install weasyprint
     Then run: python3 convert_to_pdf.py --method weasyprint
  
  b) Install pdfkit + wkhtmltopdf:
     brew install wkhtmltopdf (macOS)
     pip install pdfkit
     Then run: python3 convert_to_pdf.py --method pdfkit
  
  c) Install Pandoc:
     brew install pandoc (macOS)
     pip install pypandoc
     Then run: python3 convert_to_pdf.py --method pandoc

OPTION 3: Online Tools
  Visit one of these websites and upload Security_Assessment_Report.html:
  - https://html2pdf.com
  - https://cloudconvert.com
  - https://www.zamzar.com

RECOMMENDATION: Use Option 1 (Web Browser) - it's the easiest and
most reliable method. The HTML report is print-optimized and will
produce a professional PDF.
""")
    print("="*70)

def main():
    """Main conversion logic."""
    print("\n" + "="*70)
    print("📄 Security Assessment HTML to PDF Converter")
    print("="*70 + "\n")
    
    html_file = "Security_Assessment_Report.html"
    pdf_file = "Security_Assessment_Report.pdf"
    
    if not Path(html_file).exists():
        print(f"❌ Error: {html_file} not found!")
        print("\nFirst run: python3 generate_security_pdf.py")
        sys.exit(1)
    
    print(f"📄 Found HTML report: {html_file}")
    print(f"   Size: {Path(html_file).stat().st_size / 1024:.1f} KB")
    
    # Try different conversion methods
    methods = [
        ("WeasyPrint", lambda: convert_html_to_pdf_weasyprint(html_file, pdf_file)),
        ("pdfkit", lambda: convert_html_to_pdf_pdfkit(html_file, pdf_file)),
        ("ReportLab", lambda: convert_html_to_pdf_reportlab(html_file, pdf_file)),
    ]
    
    print("\n🔄 Attempting PDF conversion using available tools...\n")
    
    for method_name, method_func in methods:
        print(f"Trying {method_name}...")
        if method_func():
            print(f"\n✅ SUCCESS: PDF created using {method_name}")
            print(f"   File: {pdf_file}")
            print(f"   Size: {Path(pdf_file).stat().st_size / 1024:.1f} KB")
            return True
    
    print("\n⚠️  Could not convert to PDF automatically.")
    manual_instructions()
    
    # Still provide the HTML file as the report
    print("\n✅ GOOD NEWS: Your Security Assessment Report is ready!")
    print(f"   Format: HTML (Security_Assessment_Report.html)")
    print("   Size: {:.1f} KB".format(Path(html_file).stat().st_size / 1024))
    print(f"\nYou can:")
    print(f"  1. Open it in a web browser")
    print(f"  2. Print it to PDF from the browser (Cmd+P → Save as PDF)")
    print(f"  3. Share the HTML file with stakeholders")
    
    return False

if __name__ == "__main__":
    main()
