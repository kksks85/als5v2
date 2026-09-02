#!/usr/bin/env python3
"""
Enhanced Security Assessment Report Generator
Creates a comprehensive, browser-printable HTML report with all security findings
"""

import os
from datetime import datetime
from pathlib import Path

def read_md_files():
    """Read all markdown security assessment files."""
    documents = [
        "SECURITY_ASSESSMENT_INDEX.md",
        "SECURITY_VA_PENTEST_REPORT.md",
        "SECURITY_REMEDIATION_CHECKLIST.md",
        "SECURITY_TECHNICAL_FIXES.md",
        "SECURITY_TESTING_GUIDE.md"
    ]
    
    content = {}
    for doc in documents:
        if Path(doc).exists():
            with open(doc, 'r', encoding='utf-8') as f:
                content[doc] = f.read()
    
    return content

def markdown_to_html_enhanced(markdown_text):
    """Convert markdown to HTML with better formatting."""
    html = ""
    lines = markdown_text.split('\n')
    i = 0
    in_code_block = False
    code_language = ""
    code_lines = []
    in_list = False
    in_table = False
    
    while i < len(lines):
        line = lines[i]
        
        # Handle code blocks
        if line.strip().startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_language = line.strip()[3:]
                code_lines = []
            else:
                in_code_block = False
                html += f'<pre><code class="language-{code_language}">{"".join(code_lines)}</code></pre>\n'
                code_lines = []
                code_language = ""
            i += 1
            continue
        
        if in_code_block:
            code_lines.append(line + '\n')
            i += 1
            continue
        
        # Handle headings
        if line.startswith('# '):
            if in_list:
                html += '</ul>\n'
                in_list = False
            html += f"<h1>{line[2:].strip()}</h1>\n"
        elif line.startswith('## '):
            if in_list:
                html += '</ul>\n'
                in_list = False
            html += f"<h2>{line[3:].strip()}</h2>\n"
        elif line.startswith('### '):
            if in_list:
                html += '</ul>\n'
                in_list = False
            html += f"<h3>{line[4:].strip()}</h3>\n"
        elif line.startswith('#### '):
            if in_list:
                html += '</ul>\n'
                in_list = False
            html += f"<h4>{line[5:].strip()}</h4>\n"
        elif line.startswith('##### '):
            if in_list:
                html += '</ul>\n'
                in_list = False
            html += f"<h5>{line[6:].strip()}</h5>\n"
        
        # Handle lists
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            if not in_list:
                html += '<ul>\n'
                in_list = True
            html += f"<li>{line.strip()[2:].strip()}</li>\n"
        
        elif line.strip().startswith('1. ') or (line.strip() and line.strip()[0].isdigit() and '. ' in line.strip()):
            if not in_list:
                html += '<ol>\n'
                in_list = True
            # Extract number and content
            parts = line.strip().split('. ', 1)
            if len(parts) > 1:
                html += f"<li>{parts[1].strip()}</li>\n"
        
        # Handle horizontal rules
        elif line.strip() in ('---', '***', '___'):
            if in_list:
                html += '</ul>\n'
                in_list = False
            html += "<hr>\n"
        
        # Handle regular text
        elif line.strip():
            if in_list:
                html += '</ul>\n'
                in_list = False
            
            # Format inline markdown
            text = line.strip()
            
            # Bold
            text = text.replace('**', '<strong>', 1)
            text = text.replace('**', '</strong>', 1)
            
            # Italic  
            text = text.replace('*', '<em>', 1) if '*' in text and '**' not in text else text
            text = text.replace('*', '</em>', 1) if '*' in text and '**' not in text else text
            
            # Inline code
            while '`' in text:
                first = text.index('`')
                text = text[:first] + '<code>' + text[first+1:]
                if '`' in text[first+7:]:
                    next_idx = text.index('`', first+7)
                    text = text[:next_idx] + '</code>' + text[next_idx+1:]
                else:
                    break
            
            # Links
            import re
            text = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', text)
            
            html += f"<p>{text}</p>\n"
        else:
            if in_list:
                html += '</ul>\n'
                in_list = False
            html += "<br>\n"
        
        i += 1
    
    if in_list:
        html += '</ul>\n'
    
    return html

def generate_enhanced_html_report():
    """Generate comprehensive HTML report."""
    content = read_md_files()
    
    if not content:
        print("❌ No security assessment files found!")
        return False
    
    # Start HTML
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aerofix Security Assessment Report - Complete VA/Pentest Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        @media print {
            body { font-size: 10pt; }
            .page-break { page-break-after: always; }
            .no-break { page-break-inside: avoid; }
            h1, h2, h3 { page-break-after: avoid; }
            table { page-break-inside: avoid; }
        }
        
        html {
            scroll-behavior: smooth;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        
        /* Cover Page */
        .cover-page {
            text-align: center;
            padding: 60px 0;
            border-bottom: 3px solid #cc0000;
            margin-bottom: 40px;
            page-break-after: always;
        }
        
        .cover-page h1 {
            font-size: 48px;
            color: #cc0000;
            margin: 20px 0;
            font-weight: 900;
        }
        
        .cover-page h2 {
            font-size: 24px;
            color: #666;
            margin: 15px 0;
            font-weight: 600;
        }
        
        .subtitle {
            font-size: 18px;
            color: #999;
            margin: 20px 0;
        }
        
        .metadata {
            background: #f9f9f9;
            padding: 20px;
            margin: 30px 0;
            border-left: 4px solid #cc0000;
            border-radius: 4px;
        }
        
        .metadata p {
            margin: 8px 0;
            font-size: 13px;
        }
        
        .metadata strong {
            font-weight: 600;
        }
        
        /* Headers */
        h1 {
            font-size: 32px;
            color: #cc0000;
            margin: 40px 0 20px 0;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 24px;
            color: #ff6600;
            margin: 30px 0 15px 0;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 18px;
            color: #333;
            margin: 20px 0 10px 0;
            page-break-after: avoid;
        }
        
        h4, h5, h6 {
            color: #555;
            margin: 15px 0 8px 0;
            page-break-after: avoid;
        }
        
        /* Paragraphs and Text */
        p {
            margin: 12px 0;
            text-align: justify;
            color: #333;
        }
        
        /* Lists */
        ul, ol {
            margin: 15px 0 15px 40px;
        }
        
        li {
            margin: 8px 0;
            color: #333;
        }
        
        /* Code */
        code {
            background: #f5f5f5;
            color: #c00;
            padding: 3px 8px;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
        }
        
        pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 15px 0;
            border-left: 4px solid #cc0000;
            page-break-inside: avoid;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.4;
        }
        
        pre code {
            background: none;
            color: #d4d4d4;
            padding: 0;
            font-size: 11px;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: avoid;
        }
        
        th {
            background: #cc0000;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border: 1px solid #999;
        }
        
        td {
            padding: 10px 12px;
            border: 1px solid #ddd;
            text-align: left;
        }
        
        tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        tr:hover {
            background: #f0f0f0;
        }
        
        /* Risk levels */
        .critical {
            color: #cc0000;
            font-weight: 600;
            background: #ffe0e0;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .high {
            color: #ff6600;
            font-weight: 600;
            background: #fff3e0;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .medium {
            color: #ffcc00;
            font-weight: 600;
            background: #fffde0;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .low {
            color: #00cc00;
            font-weight: 600;
            background: #e0ffe0;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        /* Special elements */
        .alert {
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            page-break-inside: avoid;
        }
        
        .alert-danger {
            background: #ffe0e0;
            border-left: 4px solid #cc0000;
            color: #660000;
        }
        
        .alert-warning {
            background: #fff3e0;
            border-left: 4px solid #ff6600;
            color: #663300;
        }
        
        .alert-info {
            background: #e0f2f1;
            border-left: 4px solid #009688;
            color: #003d33;
        }
        
        /* Horizontal rule */
        hr {
            border: none;
            border-top: 2px solid #eee;
            margin: 30px 0;
        }
        
        /* Links */
        a {
            color: #0066cc;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* TOC */
        .toc {
            background: #f9f9f9;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #cc0000;
            border-radius: 4px;
            page-break-inside: avoid;
        }
        
        .toc h3 {
            color: #cc0000;
            margin-top: 0;
        }
        
        .toc ul {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        
        .toc li {
            margin: 5px 0;
            padding-left: 20px;
        }
        
        .toc a {
            color: #0066cc;
            text-decoration: none;
        }
        
        /* Print optimizations */
        @page {
            size: letter;
            margin: 0.5in;
        }
        
        .page-break {
            page-break-after: always;
        }
        
        /* Footer */
        .footer {
            text-align: center;
            font-size: 10px;
            color: #999;
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="container">
"""
    
    # Add cover page
    html += """
        <div class="cover-page">
            <h1>🔒 SECURITY ASSESSMENT</h1>
            <h2>COMPREHENSIVE VULNERABILITY & PENETRATION TEST REPORT</h2>
            <div class="subtitle">Aerofix Service Management API</div>
            
            <div class="metadata">
                <p><strong>Assessment Type:</strong> Full Stack Security Review</p>
                <p><strong>Target System:</strong> Aerofix Service Management Platform</p>
                <p><strong>Components:</strong> FastAPI Backend + React Frontend + PostgreSQL Database</p>
                <p><strong>Assessment Date:</strong> 2026-09-01</p>
                <p><strong>Report Generated:</strong> """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC") + """</p>
            </div>
            
            <div class="metadata" style="background: #ffe0e0; border-left-color: #cc0000;">
                <p><strong style="color: #cc0000;">STATUS: CRITICAL - REQUIRES IMMEDIATE ACTION</strong></p>
                <p><strong>Overall Risk Rating:</strong> <span class="critical">CRITICAL (25/100 Security Score)</span></p>
                <p><strong>Total Vulnerabilities:</strong> <span class="critical">40 Identified</span></p>
                <p><strong>Distribution:</strong> 
                    <span class="critical">Critical: 8</span> | 
                    <span class="high">High: 12</span> | 
                    <span class="medium">Medium: 15</span> | 
                    <span class="low">Low: 5</span>
                </p>
                <p style="margin-top: 10px;"><strong>Recommendation:</strong> Do not deploy to production until critical vulnerabilities (Fixes #1-8) are remediated. Timeline: 6-8 hours minimum.</p>
            </div>
            
            <p style="margin-top: 30px; font-size: 11px; color: #999;">
                <strong>Confidentiality Notice:</strong> This report contains sensitive security information.<br>
                Distribution is restricted to authorized personnel only.<br>
                Unauthorized access or disclosure is prohibited by law.
            </p>
        </div>
        
        <div class="page-break"></div>
"""
    
    # Add table of contents
    html += """
        <h1>📋 TABLE OF CONTENTS</h1>
        <div class="toc">
            <ul>
                <li><strong>1.</strong> Executive Summary</li>
                <li><strong>2.</strong> Vulnerability Assessment & Penetration Test Report</li>
                <li><strong>3.</strong> Remediation Checklist & Quick Fixes</li>
                <li><strong>4.</strong> Technical Implementation Guide</li>
                <li><strong>5.</strong> Automated Security Testing Guide</li>
            </ul>
        </div>
        
        <div class="alert alert-danger">
            <strong>⚠️ IMMEDIATE ACTIONS REQUIRED:</strong>
            <ul>
                <li>Do not expose API to production network until critical fixes are implemented</li>
                <li>Review and remediate Fixes #1-8 (Authentication & Authorization) within 24 hours</li>
                <li>Implement HTTPS enforcement and disable demo login endpoints</li>
                <li>Rotate all default credentials and JWT secrets</li>
                <li>Enable audit logging for all database operations</li>
                <li>Establish automated security testing pipeline</li>
            </ul>
        </div>
        
        <div class="page-break"></div>
"""
    
    # Add content from markdown files
    for doc_name, content_text in content.items():
        html += f"<h1>{doc_name.replace('.md', '').replace('_', ' ')}</h1>\n"
        html += markdown_to_html_enhanced(content_text)
        html += '<div class="page-break"></div>\n'
    
    # Add footer
    html += """
        <div class="footer">
            <hr>
            <p><strong>🔐 SECURITY ASSESSMENT REPORT - CONFIDENTIAL</strong></p>
            <p>This document contains sensitive security findings and remediation guidance.</p>
            <p>Unauthorized access, use, or distribution is strictly prohibited.</p>
            <p>For questions or clarification, contact the security assessment team.</p>
            <p style="margin-top: 20px;">Report Version: 1.0 | Last Updated: """ + datetime.now().strftime("%Y-%m-%d") + """</p>
        </div>
    </div>
</body>
</html>
"""
    
    # Write HTML file
    output_file = "Security_Assessment_Report.html"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    return True

def main():
    """Generate enhanced HTML report."""
    print("\n" + "="*70)
    print("📄 Security Assessment Report Generator - Enhanced Version")
    print("="*70 + "\n")
    
    print("🔍 Reading security assessment documents...")
    if generate_enhanced_html_report():
        output_file = "Security_Assessment_Report.html"
        file_size = Path(output_file).stat().st_size / 1024
        
        print(f"\n✅ Enhanced HTML report generated successfully!")
        print(f"\n📊 Report Details:")
        print(f"   File: {output_file}")
        print(f"   Size: {file_size:.1f} KB")
        print(f"   Format: Print-optimized HTML")
        print(f"   Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        print(f"\n🌐 To view the report:")
        print(f"   1. Open the file in your web browser:")
        print(f"      open Security_Assessment_Report.html (macOS)")
        print(f"      Double-click the file in Finder/Explorer")
        print(f"\n📄 To convert to PDF:")
        print(f"   1. Open report in web browser")
        print(f"   2. Press Cmd+P (Mac) or Ctrl+P (Windows/Linux)")
        print(f"   3. Select 'Save as PDF'")
        print(f"   4. Name: 'Security_Assessment_Report.pdf'")
        print(f"   5. Click 'Save'")
        
        print(f"\n📧 To share with stakeholders:")
        print(f"   • Email the HTML file directly (166 KB)")
        print(f"   • Print to PDF for formal distribution")
        print(f"   • Host on secure server for team access")
        
        print("\n" + "="*70)
        print("✅ Report generation complete!")
        print("="*70 + "\n")
        
        return True
    else:
        print("\n❌ Failed to generate report")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
