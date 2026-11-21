import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { loadReport } from './reports.functions';
import type { ReportQuery } from './report-query';
import { ExportButton, Empty, SectionHeading } from './ui';
import { money } from './model';
import { useWorkspace } from './store';
export function AuthorizedReportPanel({ query }: { query: ReportQuery }) {
  const fetch = useServerFn(loadReport);
  const { company, actor } = useWorkspace();
  const result = useQuery({ queryKey: ['report', company.company, actor.id, query], queryFn: () => fetch({ data: query }) });
  const rows = result.data ?? []; const headers = Object.keys(rows[0] ?? {});
  return <section className="py-4">
    <SectionHeading title={`${query.view || query.department} report`}><ExportButton name={`rayz-${query.department}-${query.view || 'report'}`} rows={rows} filters={`Operation: ${query.operationId || 'All'} | Customer: ${query.customer || 'All'} | ${query.from || 'All dates'} to ${query.to || 'present'} | Status: ${query.status || 'All'}`} /></SectionHeading>
    {result.isFetching && <p role="status">Loading report…</p>}
    {result.error && <p role="alert">{result.error.message}</p>}
    <div className="table-scroll"><table><thead><tr>{headers.map((h) => <th key={h}>{h.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={String(r['Record'] || i)}>{headers.map((h) => <td key={h}>{typeof r[h] === 'number' ? money(Number(r[h])) : String(r[h])}</td>)}</tr>)}</tbody></table>{!result.isFetching && !rows.length && <Empty />}</div>
  </section>;
}