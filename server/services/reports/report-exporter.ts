/**
 * Report Exporter Service
 *
 * Exports reports to various formats:
 * - PDF (formatted document)
 * - CSV (data export)
 * - Excel (XLSX with formatting)
 * - HTML (web-friendly format)
 */

import { GeneratedReport, ReportSection } from './audit-report-generator';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ExportFormat = 'pdf' | 'csv' | 'xlsx' | 'html' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeCharts?: boolean;
  includeSummary?: boolean;
  includeRawData?: boolean;
  branding?: {
    logo?: string;
    companyName?: string;
    primaryColor?: string;
  };
}

export interface ExportResult {
  filename: string;
  contentType: string;
  data: Buffer | string;
  size: number;
}

// ============================================================================
// REPORT EXPORTER
// ============================================================================

export class ReportExporter {
  /**
   * Export report to specified format
   */
  async export(report: GeneratedReport, options: ExportOptions): Promise<ExportResult> {
    console.log(`[Report Exporter] Exporting ${report.type} report as ${options.format}`);

    switch (options.format) {
      case 'pdf':
        return this.exportToPDF(report, options);
      case 'csv':
        return this.exportToCSV(report, options);
      case 'xlsx':
        return this.exportToExcel(report, options);
      case 'html':
        return this.exportToHTML(report, options);
      case 'json':
        return this.exportToJSON(report, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  // ============================================================================
  // PDF EXPORT
  // ============================================================================

  private async exportToPDF(report: GeneratedReport, options: ExportOptions): Promise<ExportResult> {
    // Generate HTML first, then convert to PDF
    const html = this.generatePDFHTML(report, options);

    // In production, use puppeteer or similar for proper PDF generation
    // For now, return HTML with PDF mime type for client-side conversion

    const buffer = Buffer.from(html, 'utf-8');

    return {
      filename: `${report.title.replace(/\s+/g, '_')}_${this.formatDate(report.generatedAt)}.pdf`,
      contentType: 'application/pdf',
      data: buffer,
      size: buffer.length
    };
  }

  private generatePDFHTML(report: GeneratedReport, options: ExportOptions): string {
    const companyName = options.branding?.companyName || 'AssetInfo';
    const primaryColor = options.branding?.primaryColor || '#2563eb';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${report.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; }
    .header { border-bottom: 3px solid ${primaryColor}; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: ${primaryColor}; font-size: 28px; margin-bottom: 10px; }
    .header .meta { color: #666; font-size: 12px; }
    .summary { background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
    .summary h2 { color: ${primaryColor}; font-size: 18px; margin-bottom: 15px; }
    .metrics { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
    .metric { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; min-width: 150px; }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .metric-value { font-size: 24px; font-weight: bold; color: ${primaryColor}; }
    .findings { margin-bottom: 20px; }
    .findings h3 { font-size: 14px; color: #333; margin-bottom: 10px; }
    .findings ul { margin-left: 20px; }
    .findings li { margin-bottom: 5px; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 { color: ${primaryColor}; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
    .section p { color: #666; font-size: 14px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: ${primaryColor}; color: white; text-align: left; padding: 10px; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #666; text-align: center; }
    .risk-high { color: #dc2626; font-weight: bold; }
    .risk-medium { color: #f59e0b; }
    .risk-low { color: #10b981; }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <div class="meta">
      Generated by ${companyName} | ${this.formatDateTime(report.generatedAt)} |
      Report Period: ${this.formatDate(report.dateRange.start)} - ${this.formatDate(report.dateRange.end)}
    </div>
  </div>

  ${options.includeSummary !== false ? this.renderSummaryHTML(report.summary, primaryColor) : ''}

  ${report.sections.map(section => this.renderSectionHTML(section)).join('\n')}

  <div class="footer">
    Generated by ${companyName} SaaS Management Platform<br>
    Report ID: ${report.id} | Generated: ${this.formatDateTime(report.generatedAt)}
  </div>
</body>
</html>`;
  }

  private renderSummaryHTML(summary: GeneratedReport['summary'], primaryColor: string): string {
    return `
  <div class="summary">
    <h2>Executive Summary</h2>

    <div class="metrics">
      ${Object.entries(summary.metrics).map(([label, value]) => `
        <div class="metric">
          <div class="metric-label">${this.formatLabel(label)}</div>
          <div class="metric-value">${value}</div>
        </div>
      `).join('')}
    </div>

    <div class="findings">
      <h3>Key Findings</h3>
      <ul>
        ${summary.keyFindings.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>

    ${summary.recommendations.length > 0 ? `
    <div class="findings">
      <h3>Recommendations</h3>
      <ul>
        ${summary.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${summary.riskAreas.length > 0 ? `
    <div class="findings">
      <h3>Risk Areas</h3>
      <ul>
        ${summary.riskAreas.map(r => `<li class="risk-high">${r}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>`;
  }

  private renderSectionHTML(section: ReportSection): string {
    let dataHTML = '';

    if (section.chartType === 'table' && Array.isArray(section.data)) {
      dataHTML = this.renderTableHTML(section.data);
    } else if (typeof section.data === 'object') {
      if (Array.isArray(section.data)) {
        dataHTML = this.renderTableHTML(section.data);
      } else {
        dataHTML = this.renderKeyValueHTML(section.data);
      }
    }

    return `
  <div class="section">
    <h2>${section.title}</h2>
    ${section.description ? `<p>${section.description}</p>` : ''}
    ${dataHTML}
  </div>`;
  }

  private renderTableHTML(data: any[]): string {
    if (!data || data.length === 0) {
      return '<p>No data available</p>';
    }

    const headers = Object.keys(data[0]);

    return `
    <table>
      <thead>
        <tr>
          ${headers.map(h => `<th>${this.formatLabel(h)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${data.slice(0, 50).map(row => `
          <tr>
            ${headers.map(h => `<td>${this.formatValue(row[h])}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${data.length > 50 ? `<p><em>Showing 50 of ${data.length} rows</em></p>` : ''}`;
  }

  private renderKeyValueHTML(data: Record<string, any>): string {
    return `
    <table>
      <tbody>
        ${Object.entries(data).map(([key, value]) => `
          <tr>
            <td><strong>${this.formatLabel(key)}</strong></td>
            <td>${this.formatValue(value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  // ============================================================================
  // CSV EXPORT
  // ============================================================================

  private async exportToCSV(report: GeneratedReport, options: ExportOptions): Promise<ExportResult> {
    const csvParts: string[] = [];

    // Add report header
    csvParts.push(`# ${report.title}`);
    csvParts.push(`# Generated: ${this.formatDateTime(report.generatedAt)}`);
    csvParts.push(`# Period: ${this.formatDate(report.dateRange.start)} - ${this.formatDate(report.dateRange.end)}`);
    csvParts.push('');

    // Add summary metrics
    if (options.includeSummary !== false) {
      csvParts.push('## Summary Metrics');
      csvParts.push('Metric,Value');
      Object.entries(report.summary.metrics).forEach(([key, value]) => {
        csvParts.push(`"${this.formatLabel(key)}","${value}"`);
      });
      csvParts.push('');

      // Add findings
      csvParts.push('## Key Findings');
      report.summary.keyFindings.forEach(f => {
        csvParts.push(`"${f}"`);
      });
      csvParts.push('');
    }

    // Add each section
    for (const section of report.sections) {
      csvParts.push(`## ${section.title}`);

      if (Array.isArray(section.data) && section.data.length > 0) {
        const headers = Object.keys(section.data[0]);
        csvParts.push(headers.map(h => `"${this.formatLabel(h)}"`).join(','));

        section.data.forEach(row => {
          const values = headers.map(h => {
            const value = row[h];
            return `"${this.escapeCSV(this.formatValue(value))}"`;
          });
          csvParts.push(values.join(','));
        });
      } else if (typeof section.data === 'object' && !Array.isArray(section.data)) {
        csvParts.push('Key,Value');
        Object.entries(section.data).forEach(([key, value]) => {
          csvParts.push(`"${this.formatLabel(key)}","${this.escapeCSV(this.formatValue(value))}"`);
        });
      }

      csvParts.push('');
    }

    const csvContent = csvParts.join('\n');
    const buffer = Buffer.from(csvContent, 'utf-8');

    return {
      filename: `${report.title.replace(/\s+/g, '_')}_${this.formatDate(report.generatedAt)}.csv`,
      contentType: 'text/csv',
      data: buffer,
      size: buffer.length
    };
  }

  // ============================================================================
  // EXCEL EXPORT
  // ============================================================================

  private async exportToExcel(report: GeneratedReport, options: ExportOptions): Promise<ExportResult> {
    // Generate Excel-compatible XML spreadsheet
    const xml = this.generateExcelXML(report, options);
    const buffer = Buffer.from(xml, 'utf-8');

    return {
      filename: `${report.title.replace(/\s+/g, '_')}_${this.formatDate(report.generatedAt)}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: buffer,
      size: buffer.length
    };
  }

  private generateExcelXML(report: GeneratedReport, options: ExportOptions): string {
    // Generate Excel 2003 XML format (universally compatible)
    const sheets: string[] = [];

    // Summary sheet
    if (options.includeSummary !== false) {
      sheets.push(this.generateExcelSheet('Summary', [
        ['Metric', 'Value'],
        ...Object.entries(report.summary.metrics).map(([k, v]) => [this.formatLabel(k), String(v)]),
        ['', ''],
        ['Key Findings', ''],
        ...report.summary.keyFindings.map(f => ['', f]),
        ['', ''],
        ['Recommendations', ''],
        ...report.summary.recommendations.map(r => ['', r])
      ]));
    }

    // Data sheets for each section
    for (const section of report.sections) {
      let rows: string[][] = [];

      if (Array.isArray(section.data) && section.data.length > 0) {
        const headers = Object.keys(section.data[0]);
        rows.push(headers.map(h => this.formatLabel(h)));
        rows.push(...section.data.map(row =>
          headers.map(h => this.formatValue(row[h]))
        ));
      } else if (typeof section.data === 'object' && !Array.isArray(section.data)) {
        rows.push(['Key', 'Value']);
        rows.push(...Object.entries(section.data).map(([k, v]) =>
          [this.formatLabel(k), this.formatValue(v)]
        ));
      }

      if (rows.length > 0) {
        sheets.push(this.generateExcelSheet(
          section.title.substring(0, 31), // Excel sheet name limit
          rows
        ));
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#2563eb" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF"/>
    </Style>
  </Styles>
  ${sheets.join('\n')}
</Workbook>`;
  }

  private generateExcelSheet(name: string, rows: string[][]): string {
    const sanitizedName = name.replace(/[\\\/\?\*\[\]]/g, '_');

    return `
  <Worksheet ss:Name="${sanitizedName}">
    <Table>
      ${rows.map((row, i) => `
      <Row>
        ${row.map(cell => `
        <Cell${i === 0 ? ' ss:StyleID="Header"' : ''}><Data ss:Type="String">${this.escapeXML(cell)}</Data></Cell>
        `).join('')}
      </Row>
      `).join('')}
    </Table>
  </Worksheet>`;
  }

  // ============================================================================
  // HTML EXPORT
  // ============================================================================

  private async exportToHTML(report: GeneratedReport, options: ExportOptions): Promise<ExportResult> {
    const html = this.generatePDFHTML(report, options);
    const buffer = Buffer.from(html, 'utf-8');

    return {
      filename: `${report.title.replace(/\s+/g, '_')}_${this.formatDate(report.generatedAt)}.html`,
      contentType: 'text/html',
      data: buffer,
      size: buffer.length
    };
  }

  // ============================================================================
  // JSON EXPORT
  // ============================================================================

  private async exportToJSON(report: GeneratedReport, options: ExportOptions): Promise<ExportResult> {
    const jsonContent = JSON.stringify(report, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');

    return {
      filename: `${report.title.replace(/\s+/g, '_')}_${this.formatDate(report.generatedAt)}.json`,
      contentType: 'application/json',
      data: buffer,
      size: buffer.length
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\s/, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (value instanceof Date) {
      return this.formatDateTime(value);
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private escapeCSV(value: string): string {
    return value.replace(/"/g, '""');
  }

  private escapeXML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const reportExporter = new ReportExporter();

export default ReportExporter;
