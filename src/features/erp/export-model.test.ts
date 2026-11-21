import { describe, expect, it } from 'vitest';
import { reportData } from './export-model';

describe('Filtered PDF and Excel report data', () => {
  it('exports only the filtered rows supplied by the report', () => {
    const records = [{ Operation: 'RZ-1', Cost_ETB: 12000, Status: 'Approved' }, { Operation: 'RZ-2', Cost_ETB: 9000, Status: 'Submitted' }];
    const report = reportData(records.filter((r) => r.Status === 'Approved'));
    expect(report.values).toEqual([['RZ-1', 12000, 'Approved']]);
    expect(report.totals).toEqual([null, 12000, null]);
  });
  it('preserves numeric cells for Excel calculations and historical exchange rates', () => {
    const report = reportData([{ Original_amount: 1800, Historical_rate: 133.2, Cost_ETB: 239760 }]);
    expect(report.values[0]).toEqual([1800, 133.2, 239760]);
    expect(report.totals).toEqual([1800, null, 239760]);
  });
});