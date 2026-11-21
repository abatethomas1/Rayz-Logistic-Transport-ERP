import { describe, expect, it } from 'vitest';
import { freightReady, masterSchema, canMaintainMaster, convertNewCost, independentReversalApprover, availableAdvance, duplicateContainersWithinOperation, invoiceTaxRate } from './production-model';
import { money } from './model';
describe('Production ERP rules', () => {
  it('rounds newly converted foreign costs to whole ETB', () => {
    expect(convertNewCost(10, 132.56, 'USD')).toBe(1326);
    expect(convertNewCost(10.25, 1, 'ETB')).toBe(10.25);
  });
  it('formats monetary values as 1,000,000.00', () => { expect(money(1000000)).toBe('1,000,000.00'); });
  it('does not add invoice tax', () => { expect(invoiceTaxRate).toBe(0); });
  it('allows only Finance Manager or General Manager to approve independent reversals', () => {
    expect(independentReversalApprover('Finance Manager', 'm1', 'f1', 'f1')).toBe(true);
    expect(independentReversalApprover('General Manager', 'g1', 'f1', 'f1')).toBe(true);
    expect(independentReversalApprover('Business Owner', 'o1', 'f1', 'f1')).toBe(false);
    expect(independentReversalApprover('Finance Manager', 'm1', 'm1', 'f1')).toBe(false);
  });
  it('retains unallocated advances until Finance allocates them', () => { expect(availableAdvance(100000, 0)).toBe(100000); expect(availableAdvance(100000, 25000)).toBe(75000); });
  it('rejects duplicate containers only within the supplied operation', () => {
    expect(duplicateContainersWithinOperation(['MSCU123', 'MSCU123'])).toBe(true);
    expect(duplicateContainersWithinOperation(['MSCU123'])).toBe(false);
    expect(duplicateContainersWithinOperation(['MSCU123'])).toBe(false);
  });
  it('released freight can dispatch while an unrelated stage is blocked', () => {
    expect(freightReady({ id: 'F1', operation_id: 'OP1', identifier: 'Container 1', freight_type: '40 ft', weight: 100, clearance_confirmed: true, blocker: '' }, [{ freight_id: 'F1', stage_id: 'ST1', task_id: null }], [{ id: 'ST1', status: 'Released' }, { id: 'ST2', status: 'On hold' }], [])).toBe(true);
  });
  it('a relevant unfinished stage blocks that freight item', () => {
    expect(freightReady({ id: 'F1', operation_id: 'OP1', identifier: 'Container 1', freight_type: '20 ft', weight: 100, clearance_confirmed: true, blocker: '' }, [{ freight_id: 'F1', stage_id: 'ST1', task_id: null }], [{ id: 'ST1', status: 'On hold' }], [])).toBe(false);
  });
  it('clearance must be explicitly confirmed', () => {
    expect(freightReady({ id: 'F1', operation_id: 'OP1', identifier: 'Unit 1', freight_type: 'Bulk', weight: 100, clearance_confirmed: false, blocker: '' }, [], [], [])).toBe(false);
  });
  it('company and subcontractor ownership are distinct valid choices', () => {
    for (const ownership of ['Company', 'Subcontractor']) expect(masterSchema.safeParse({ kind: 'truck', input: { truck: 'AA-1', driver: 'Driver', supplier: 'Supplier', capacity: 20000, ownership } }).success).toBe(true);
    expect(masterSchema.safeParse({ kind: 'truck', input: { truck: 'AA-1', driver: 'Driver', supplier: 'Supplier', capacity: -1, ownership: 'Other' } }).success).toBe(false);
  });
  it('officers cannot maintain administrator configuration', () => {
    expect(canMaintainMaster('External Logistics Officer', 'port')).toBe(false);
    expect(canMaintainMaster('Admin', 'port')).toBe(true);
  });
});