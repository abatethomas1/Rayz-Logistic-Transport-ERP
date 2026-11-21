export type ReportRow = Record<string, string | number>;
export function reportData(rows: ReportRow[]) {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return { headers, values: rows.map((r) => headers.map((h) => r[h] ?? '')), totals: headers.map((h) => rows.length > 0 && rows.every((r) => typeof r[h] === 'number') && /ETB|amount|cost|received|balance|profit|charge|settled/i.test(h) ? rows.reduce((sum, r) => sum + Number(r[h]), 0) : null) };
}