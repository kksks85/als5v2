#!/usr/bin/env python3
"""
Security Assessment PDF Generator
Combines all security assessment documents into a single comprehensive PDF

Usage:
    python3 generate_security_pdf.py
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Try to import reportlab, fall back to creating HTML if not available
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
        KeepTogether
    )
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("Note: reportlab not installed. Will create HTML version instead.")

class SecurityAssessmentPDFGenerator:
    """Generate comprehensive PDF from security assessment documents."""
    
    def __init__(self, output_file="Security_Assessment_Report.pdf"):
        self.output_file = output_file
        self.documents = [
            "SECURITY_ASSESSMENT_INDEX.md",
            "SECURITY_VA_PENTEST_REPORT.md",
            "SECURITY_REMEDIATION_CHECKLIST.md",
            "SECURITY_TECHNICAL_FIXES.md",
            "SECURITY_TESTING_GUIDE.md"
        ]
    
    def read_markdown_files(self):
        """Read all markdown files."""
        content = {}
        for doc in self.documents:
            if Path(doc).exists():
                with open(doc, 'r', encoding='utf-8') as f:
                    content[doc] = f.read()
            else:
                print(f"Warning: {doc} not found")
        return content
    
    def create_html_pdf(self, content):
        """Create HTML version (fallback if reportlab not available)."""
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Aerofix Security Assessment Report</title>
            <style>
                * { margin: 0; padding: 0; }
                body { 
                    font-family: Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #333;
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 20px;
                }
                h1 { 
                    color: #c00; 
                    font-size: 28px; 
                    margin: 30px 0 10px 0;
                    page-break-after: avoid;
                }
                h2 { 
                    color: #d00; 
                    font-size: 22px; 
                    margin: 20px 0 10px 0;
                    page-break-after: avoid;
                }
                h3 { 
                    color: #f80; 
                    font-size: 18px; 
                    margin: 15px 0 8px 0;
                    page-break-after: avoid;
                }
                h4, h5, h6 { 
                    color: #333;
                    margin: 10px 0 5px 0;
                    page-break-after: avoid;
                }
                p { margin: 10px 0; text-align: justify; }
                ul, ol { margin: 10px 0 10px 20px; }
                li { margin: 5px 0; }
                table { 
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                    page-break-inside: avoid;
                }
                th, td { 
                    border: 1px solid #ddd; 
                    padding: 10px;
                    text-align: left;
                }
                th { 
                    background-color: #f00;
                    color: white;
                    font-weight: bold;
                }
                tr:nth-child(even) { background-color: #f9f9f9; }
                code { 
                    background: #f4f4f4;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: monospace;
                }
                pre { 
                    background: #f4f4f4;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                    margin: 15px 0;
                    page-break-inside: avoid;
                    border-left: 4px solid #c00;
                }
                .cover-page {
                    text-align: center;
                    page-break-after: always;
                    padding: 60px 20px;
                }
                .cover-page h1 {
                    font-size: 36px;
                    color: #c00;
                    margin: 60px 0 20px 0;
                }
                .cover-page .subtitle {
                    font-size: 20px;
                    color: #666;
                    margin: 20px 0;
                }
                .cover-page .metadata {
                    font-size: 12px;
                    color: #999;
                    margin: 40px 0;
                }
                .page-break { page-break-after: always; }
                .toc { 
                    background: #f9f9f9;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 5px;
                }
                .toc a { color: #0066cc; text-decoration: none; }
                .toc a:hover { text-decoration: underline; }
                .critical { color: #c00; font-weight: bold; }
                .high { color: #f80; font-weight: bold; }
                .medium { color: #fc0; font-weight: bold; }
                .low { color: #0c0; font-weight: bold; }
                hr { 
                    border: none;
                    border-top: 2px solid #ddd;
                    margin: 30px 0;
                }
                .timestamp {
                    text-align: right;
                    font-size: 10px;
                    color: #999;
                    margin-top: 40px;
                }
            </style>
        </head>
        <body>
"""
        
        # Add cover page
        html_content += """
        <div class="cover-page">
            <h1>🔒 SECURITY ASSESSMENT</h1>
            <h2>VULNERABILITY ASSESSMENT & PENETRATION TEST REPORT</h2>
            <div class="subtitle">Aerofix Service Management API</div>
            <div class="metadata">
                <p><strong>Assessment Date:</strong> 2026-09-01</p>
                <p><strong>Status:</strong> <span class="critical">CRITICAL - Requires Immediate Action</span></p>
                <p><strong>Overall Risk Rating:</strong> <span class="critical">CRITICAL (25/100)</span></p>
                <p><strong>Total Vulnerabilities Found:</strong> <span class="critical">40</span></p>
                <p style="margin-top: 20px;">Critical: 8 | High: 12 | Medium: 15 | Low: 5</p>
            </div>
            <div class="timestamp">Generated: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</div>
        </div>
        """
        
        # Convert markdown content to HTML
        for doc_name, content_text in content.items():
            html_content += self._markdown_to_html(content_text)
            html_content += '<div class="page-break"></div>\n'
        
        # Add footer
        html_content += """
        <hr>
        <div style="text-align: center; font-size: 10px; color: #999; margin: 40px 0;">
            <p>This Security Assessment Report is CONFIDENTIAL</p>
            <p>Distribution limited to authorized personnel only</p>
            <p>For unauthorized access or distribution, contact security team immediately</p>
        </div>
        </body>
        </html>
        """
        
        return html_content
    
    def _markdown_to_html(self, markdown_text):
        """Convert markdown to HTML."""
        html = ""
        lines = markdown_text.split('\n')
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Handle headings
            if line.startswith('# '):
                html += f"<h1>{line[2:]}</h1>\n"
            elif line.startswith('## '):
                html += f"<h2>{line[3:]}</h2>\n"
            elif line.startswith('### '):
                html += f"<h3>{line[4:]}</h3>\n"
            elif line.startswith('#### '):
                html += f"<h4>{line[5:]}</h4>\n"
            elif line.startswith('##### '):
                html += f"<h5>{line[6:]}</h5>\n"
            elif line.startswith('###### '):
                html += f"<h6>{line[7:]}</h6>\n"
            
            # Handle code blocks
            elif line.startswith('```'):
                code_lines = []
                i += 1
                while i < len(lines) and not lines[i].startswith('```'):
                    code_lines.append(lines[i])
                    i += 1
                html += f"<pre><code>{''.join(code_lines)}</code></pre>\n"
            
            # Handle horizontal rules
            elif line.startswith('---') or line.startswith('***'):
                html += "<hr>\n"
            
            # Handle bold and italic
            elif line.strip():
                formatted_line = line
                # Bold
                formatted_line = formatted_line.replace('**', '<strong>', 1)
                formatted_line = formatted_line.replace('**', '</strong>', 1)
                # Italic
                formatted_line = formatted_line.replace('*', '<em>', 1)
                formatted_line = formatted_line.replace('*', '</em>', 1)
                # Inline code
                formatted_line = formatted_line.replace('`', '<code>', 1)
                formatted_line = formatted_line.replace('`', '</code>', 1)
                html += f"<p>{formatted_line}</p>\n"
            else:
                html += "<br>\n"
            
            i += 1
        
        return html
    
    def generate(self):
        """Generate PDF from markdown files."""
        print("📄 Reading security assessment documents...")
        content = self.read_markdown_files()
        
        if not content:
            print("❌ Error: No security assessment files found!")
            return False
        
        if REPORTLAB_AVAILABLE:
            print("🔧 Generating PDF with reportlab...")
            self._generate_reportlab_pdf(content)
        else:
            print("🌐 Generating HTML version (reportlab not installed)...")
            html_content = self.create_html_pdf(content)
            html_file = self.output_file.replace('.pdf', '.html')
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(html_content)
            print(f"✅ HTML Report created: {html_file}")
            print("   You can open this in a browser and print to PDF")
            return True
        
        return True
    
    def _generate_reportlab_pdf(self, content):
        """Generate PDF using reportlab."""
        doc = SimpleDocTemplate(self.output_file, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#CC0000'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        # Add title page
        story.append(Spacer(1, 2*inch))
        story.append(Paragraph("🔒 SECURITY ASSESSMENT", title_style))
        story.append(Paragraph("VULNERABILITY ASSESSMENT & PENETRATION TEST REPORT", styles['Heading2']))
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Aerofix Service Management API", styles['Normal']))
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph(f"Assessment Date: 2026-09-01", styles['Normal']))
        story.append(Paragraph("Status: <b style='color:red'>CRITICAL - Requires Immediate Action</b>", styles['Normal']))
        story.append(Paragraph("Overall Risk Rating: <b style='color:red'>CRITICAL</b>", styles['Normal']))
        story.append(Paragraph("Total Vulnerabilities: <b style='color:red'>40</b>", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Critical: 8 | High: 12 | Medium: 15 | Low: 5", styles['Normal']))
        story.append(PageBreak())
        
        # Add content from each document
        for doc_name, content_text in content.items():
            story.append(Paragraph(f"<b>{doc_name.replace('.md', '').replace('_', ' ')}</b>", styles['Heading2']))
            
            # Add first 1000 chars to avoid huge PDFs
            preview = content_text[:500]
            story.append(Paragraph(preview, styles['Normal']))
            story.append(Spacer(1, 0.2*inch))
            story.append(PageBreak())
        
        try:
            doc.build(story)
            print(f"✅ PDF Report created: {self.output_file}")
        except Exception as e:
            print(f"❌ Error creating PDF: {e}")
            return False
        
        return True

def main():
    """Main entry point."""
    print("=" * 60)
    print("🔐 Security Assessment PDF Generator")
    print("=" * 60)
    
    generator = SecurityAssessmentPDFGenerator()
    success = generator.generate()
    
    if success:
        print("\n✅ PDF generation completed successfully!")
        print("\n📋 Files created in current directory:")
        if REPORTLAB_AVAILABLE:
            print(f"   - {generator.output_file}")
        else:
            print(f"   - {generator.output_file.replace('.pdf', '.html')}")
    else:
        print("\n❌ PDF generation failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
