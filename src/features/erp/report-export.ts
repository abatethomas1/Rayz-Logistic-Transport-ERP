import { reportData, type ReportRow } from './export-model';

function token(name: string) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function rgb(name: string): [number, number, number] { const hex = token(name).replace('#', ''); return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]; }
export function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
export async function makeReport(format: 'pdf' | 'xlsx', title: string, rows: ReportRow[], filters: string, companyName = 'Rayz Technologies PLC') {
  const data = reportData(rows);
  const timestamp = new Date().toLocaleString('en-GB');
  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook(); workbook.creator = companyName; workbook.created = new Date();
    const sheet = workbook.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 5 }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const columnCount = Math.max(data.headers.length, 3);
    sheet.mergeCells(1, 1, 1, columnCount); sheet.getCell('A1').value = companyName; sheet.getRow(1).height = 32;
    sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: token('--export-paper').replace('#', 'FF') } }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: token('--export-heading').replace('#', 'FF') } };
    sheet.mergeCells(2, 1, 2, columnCount); sheet.getCell('A2').value = title; sheet.getCell('A2').font = { name: 'Arial', size: 13, bold: true }; sheet.getRow(2).height = 26;
    sheet.mergeCells(3, 1, 3, columnCount); sheet.getCell('A3').value = `${filters} | ${rows.length} records | Generated ${timestamp}`; sheet.getCell('A3').font = { name: 'Arial', size: 10 }; sheet.getRow(3).height = 30; sheet.getCell('A3').alignment = { wrapText: true };
    const header = sheet.getRow(5); header.values = data.headers.map((h) => h.replaceAll('_', ' ')); header.height = 30;
    header.eachCell((cell) => { cell.font = { name: 'Arial', bold: true, color: { argb: token('--export-paper').replace('#', 'FF') } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: token('--export-heading').replace('#', 'FF') } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
    data.values.forEach((values, i) => { const row = sheet.addRow(values); row.height = 30; row.eachCell({ includeEmpty: true }, (cell) => { cell.font = { name: 'Arial', size: 10 }; cell.alignment = { vertical: 'middle', wrapText: true }; if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: token('--export-stripe').replace('#', 'FF') } }; if (typeof cell.value === 'number') cell.numFmt = '#,##0.00;[Red](#,##0.00)'; }); });
    if (rows.length) { const total = sheet.addRow(data.totals.map((n, i) => n === null ? i === 0 ? 'TOTAL' : '' : n)); total.font = { name: 'Arial', bold: true }; total.eachCell((cell) => { if (typeof cell.value === 'number') cell.numFmt = '#,##0.00'; }); sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: columnCount } }; }
    data.headers.forEach((h, i) => { sheet.getColumn(i + 1).width = Math.min(42, Math.max(18, h.length + 3, ...data.values.map((r) => String(r[i] ?? '').length + 2))); });
    sheet.headerFooter.oddFooter = `&L${companyName}&CConfidential staff report&RPage &P of &N`;
    const buffer = await workbook.xlsx.writeBuffer(); return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: data.headers.length > 6 ? 'landscape' : 'portrait', format: 'a4' }); const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...rgb('--export-heading')); doc.rect(0, 0, width, 27, 'F'); doc.setTextColor(...rgb('--export-paper')); doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text(companyName.slice(0, 75), 14, 17);
  doc.setTextColor(...rgb('--export-ink')); doc.setFontSize(14); doc.text(title.replaceAll('→', 'to').slice(0, 95), 14, 38); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const context = doc.splitTextToSize(`${filters} | ${rows.length} records | Generated ${timestamp}`, width - 28); doc.text(context, 14, 45);
  autoTable(doc, { startY: 49 + context.length * 4, head: [data.headers.map((h) => h.replaceAll('_', ' '))], body: data.values.map((r) => r.map((v) => typeof v === 'number' ? v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v).replaceAll('→', 'to'))), foot: rows.length ? [data.totals.map((n, i) => n === null ? i === 0 ? 'TOTAL' : '' : n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))] : [], showFoot: 'lastPage', styles: { font: 'helvetica', fontSize: data.headers.length > 9 ? 7 : 9, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: rgb('--export-heading'), textColor: rgb('--export-paper') }, footStyles: { fillColor: rgb('--export-stripe'), textColor: rgb('--export-ink') }, alternateRowStyles: { fillColor: rgb('--export-stripe') }, margin: { top: 15, bottom: 20, left: 14, right: 14 }, didDrawPage: () => { doc.setFontSize(8); doc.setTextColor(...rgb('--export-ink')); doc.text('Rayz | Confidential staff report', 14, doc.internal.pageSize.getHeight() - 10); doc.text(`Page ${doc.getNumberOfPages()}`, width - 30, doc.internal.pageSize.getHeight() - 10); } });
  if (!rows.length) doc.text('No records match the selected filters.', 14, 68);
  return doc.output('blob');
}