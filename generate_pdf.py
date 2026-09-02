#!/usr/bin/env python3
"""
VAPT Report PDF Generator
Converts Security_Assessment_Report.html to PDF

Usage: python3 generate_pdf.py
"""

import os
import sys
import subprocess
import webbrowser
from pathlib import Path

def generate_pdf_wkhtmltopdf():
    """Generate PDF using wkhtmltopdf"""
    try:
        html_file = "Security_Assessment_Report.html"
        pdf_file = "SUAV_Customer_Support_Management_Platform_Security_Assessment_Report.pdf"
        
        cmd = [
            "wkhtmltopdf",
            "--print-media-type",
            "--margin-top", "20",
            "--margin-bottom", "20",
            "--margin-left", "20",
            "--margin-right", "20",
            "--page-size", "A4",
            "--dpi", "300",
            "--enable-local-file-access",
            html_file,
            pdf_file
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and os.path.exists(pdf_file):
            size = os.path.getsize(pdf_file) / 1024 / 1024
            print(f"✅ PDF generated successfully!")
            print(f"📄 File: {pdf_file}")
            print(f"📊 Size: {size:.2f} MB")
            return True
        else:
            print(f"❌ wkhtmltopdf error: {result.stderr}")
            return False
    except FileNotFoundError:
        print("⚠️  wkhtmltopdf not found. Install with: brew install wkhtmltopdf")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def generate_pdf_headless_chrome():
    """Generate PDF using Chrome/Chromium headless mode"""
    try:
        html_file = Path("Security_Assessment_Report.html").absolute()
        pdf_file = "SUAV_Customer_Support_Management_Platform_Security_Assessment_Report.pdf"
        
        # Try different Chrome/Chromium executables
        chrome_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "chrome",
            "chromium"
        ]
        
        chrome_exe = None
        for path in chrome_paths:
            if os.path.exists(path) or path in ["chrome", "chromium"]:
                chrome_exe = path
                break
        
        if not chrome_exe:
            return False
        
        cmd = [
            chrome_exe,
            "--headless",
            "--disable-gpu",
            f"--print-to-pdf={pdf_file}",
            f"file://{html_file}"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0 and os.path.exists(pdf_file):
            size = os.path.getsize(pdf_file) / 1024 / 1024
            print(f"✅ PDF generated using Chrome headless!")
            print(f"📄 File: {pdf_file}")
            print(f"📊 Size: {size:.2f} MB")
            return True
        else:
            return False
    except Exception as e:
        print(f"Chrome headless error: {e}")
        return False


def open_browser_for_printing():
    """Open HTML in default browser for manual print-to-PDF"""
    try:
        html_file = Path("Security_Assessment_Report.html").absolute()
        if html_file.exists():
            webbrowser.open(f"file://{html_file}")
            print("\n📖 Browser opened with report!")
            print("📝 To convert to PDF:")
            print("   1. Press Cmd+P (Mac) or Ctrl+P (Windows/Linux)")
            print("   2. Select 'Save as PDF'")
            print("   3. Name: SUAV_Customer_Support_Management_Platform_Security_Assessment_Report.pdf")
            return True
        else:
            print(f"❌ File not found: {html_file}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Main function"""
    print("=" * 70)
    print("🔒 SUAV Security Assessment Report - PDF Generator")
    print("=" * 70)
    print()
    
    html_file = "Security_Assessment_Report.html"
    
    # Check if HTML file exists
    if not os.path.exists(html_file):
        print(f"❌ Error: {html_file} not found!")
        print(f"Please ensure you're in the correct directory.")
        sys.exit(1)
    
    print(f"📄 Source: {html_file}")
    print()
    
    # Try different PDF generation methods in order
    methods = [
        ("wkhtmltopdf (Best quality)", generate_pdf_wkhtmltopdf),
        ("Chrome Headless (Good quality)", generate_pdf_headless_chrome),
        ("Browser Print-to-PDF (Manual)", open_browser_for_printing),
    ]
    
    for method_name, method_func in methods:
        print(f"Trying: {method_name}...")
        if method_func():
            print()
            print("✅ PDF generation complete!")
            sys.exit(0)
        print(f"⏭️  Moving to next method...\n")
    
    print()
    print("=" * 70)
    print("⚠️  No automated method available")
    print("=" * 70)
    print()
    print("📋 MANUAL PDF GENERATION:")
    print()
    print("1. Open in Browser:")
    print(f"   • Double-click: {html_file}")
    print("   • Or open with your preferred browser")
    print()
    print("2. Print to PDF:")
    print("   • Mac: Cmd+P")
    print("   • Windows/Linux: Ctrl+P")
    print()
    print("3. Save As:")
    print("   • Filename: SUAV_Customer_Support_Management_Platform_Security_Assessment_Report.pdf")
    print("   • Format: PDF")
    print()
    print("=" * 70)


if __name__ == "__main__":
    main()
