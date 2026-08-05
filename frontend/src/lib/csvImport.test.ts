import { describe, expect, it } from 'vitest';
import { mergeRowOntoExisting, parseAndValidateCsv, planMerge, type ValidatedRow } from './csvImport';

const HEADER = 'sku,name,supplier,category,location,sort_order,unit,par_level,pack_size,order_qty_low,active';

function row(sku: string, overrides: Partial<Record<string, string>> = {}): string {
  const fields: Record<string, string> = {
    sku,
    name: 'Widget',
    supplier: 'Acme',
    category: 'Tools',
    location: 'A1',
    sort_order: '1',
    unit: 'each',
    par_level: '10',
    pack_size: '1',
    order_qty_low: '',
    active: 'TRUE',
    ...overrides,
  };
  return [
    fields.sku,
    fields.name,
    fields.supplier,
    fields.category,
    fields.location,
    fields.sort_order,
    fields.unit,
    fields.par_level,
    fields.pack_size,
    fields.order_qty_low,
    fields.active,
  ].join(',');
}

describe('parseAndValidateCsv', () => {
  it('parses a well-formed row into a ValidatedRow', () => {
    const csv = [HEADER, row('0001')].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed outcome');
    expect(result.rowErrors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      rowNumber: 2,
      sku: '0001',
      name: 'Widget',
      supplier: 'Acme',
      parLevel: 10,
      packSize: 1,
    });
  });

  it('rejects the whole file when a SKU appears twice, reporting both line numbers', () => {
    const csv = [HEADER, row('0001'), row('0002'), row('0001')].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('rejected');
    if (result.kind !== 'rejected') throw new Error('expected rejected outcome');
    expect(result.duplicateSkus).toEqual([{ sku: '0001', rowNumbers: [2, 4] }]);
  });

  it('skips a row missing a required column but still imports the rest', () => {
    const csv = [HEADER, row('0001', { name: '' }), row('0002')].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed outcome');
    expect(result.rowErrors).toEqual([{ rowNumber: 2, reason: 'name is required' }]);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]?.sku).toBe('0002');
  });

  it('rejects a row with a non-numeric par_level', () => {
    const csv = [HEADER, row('0001', { par_level: 'lots' })].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed outcome');
    expect(result.rowErrors[0]?.reason).toContain('par_level');
    expect(result.validRows).toHaveLength(0);
  });

  it('rejects a negative par_level', () => {
    const csv = [HEADER, row('0001', { par_level: '-5' })].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed outcome');
    expect(result.rowErrors[0]?.reason).toContain('par_level');
  });

  it('rejects a pack_size of zero (must be > 0)', () => {
    const csv = [HEADER, row('0001', { pack_size: '0' })].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed outcome');
    expect(result.rowErrors[0]?.reason).toContain('pack_size');
  });

  it('rejects an unparseable active value', () => {
    const csv = [HEADER, row('0001', { active: 'maybe' })].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed outcome');
    expect(result.rowErrors[0]?.reason).toContain('active');
  });

  it('treats blank optional cells as null, not empty string or zero', () => {
    const csv = [HEADER, row('0001', { category: '', order_qty_low: '' })].join('\n');
    const result = parseAndValidateCsv(csv);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed outcome');
    expect(result.validRows[0]?.category).toBeNull();
    expect(result.validRows[0]?.orderQtyLow).toBeNull();
  });
});

describe('planMerge', () => {
  it('classifies a SKU not in the database as new', () => {
    const csv = [HEADER, row('0001')].join('\n');
    const parsed = parseAndValidateCsv(csv);
    if (parsed.kind !== 'parsed') throw new Error('expected parsed outcome');

    const plan = planMerge(parsed.validRows, [], ['Acme']);

    expect(plan.newRows.map((r) => r.sku)).toEqual(['0001']);
    expect(plan.updatedRows).toHaveLength(0);
  });

  it('classifies a SKU already in the database as an update', () => {
    const csv = [HEADER, row('0001')].join('\n');
    const parsed = parseAndValidateCsv(csv);
    if (parsed.kind !== 'parsed') throw new Error('expected parsed outcome');

    const plan = planMerge(parsed.validRows, [{ sku: '0001' }], ['Acme']);

    expect(plan.updatedRows.map((r) => r.sku)).toEqual(['0001']);
    expect(plan.newRows).toHaveLength(0);
  });

  it('flags SKUs present in the database but absent from the file as missing, without deleting them', () => {
    const csv = [HEADER, row('0001')].join('\n');
    const parsed = parseAndValidateCsv(csv);
    if (parsed.kind !== 'parsed') throw new Error('expected parsed outcome');

    const plan = planMerge(parsed.validRows, [{ sku: '0001' }, { sku: '0002' }], ['Acme']);

    expect(plan.missingSkus).toEqual(['0002']);
  });

  it('reports a supplier name not already known as a new supplier to create', () => {
    const csv = [HEADER, row('0001', { supplier: 'Brand New Co' })].join('\n');
    const parsed = parseAndValidateCsv(csv);
    if (parsed.kind !== 'parsed') throw new Error('expected parsed outcome');

    const plan = planMerge(parsed.validRows, [], ['Acme']);

    expect(plan.newSupplierNames).toEqual(['Brand New Co']);
  });

  it('does not report an already-known supplier as new', () => {
    const csv = [HEADER, row('0001', { supplier: 'Acme' })].join('\n');
    const parsed = parseAndValidateCsv(csv);
    if (parsed.kind !== 'parsed') throw new Error('expected parsed outcome');

    const plan = planMerge(parsed.validRows, [], ['Acme']);

    expect(plan.newSupplierNames).toEqual([]);
  });
});

describe('mergeRowOntoExisting', () => {
  const existing = {
    name: 'Old Name',
    category: 'Old Category',
    location: 'Old Location',
    sortOrder: 5,
    unit: 'box',
    parLevel: 20,
    packSize: 4,
    orderQtyLow: 3,
    active: true,
  };

  function blankRow(overrides: Partial<ValidatedRow> = {}): ValidatedRow {
    return {
      rowNumber: 2,
      sku: '0001',
      name: 'New Name',
      supplier: 'Acme',
      category: null,
      location: null,
      sortOrder: null,
      unit: null,
      parLevel: 30,
      packSize: null,
      orderQtyLow: null,
      active: null,
      ...overrides,
    };
  }

  it('overwrites fields the CSV provided a value for', () => {
    const merged = mergeRowOntoExisting(existing, blankRow({ category: 'New Category', parLevel: 30 }));
    expect(merged.category).toBe('New Category');
    expect(merged.parLevel).toBe(30);
  });

  it('preserves existing values for fields left blank in the CSV', () => {
    const merged = mergeRowOntoExisting(existing, blankRow());
    expect(merged.location).toBe('Old Location');
    expect(merged.unit).toBe('box');
    expect(merged.sortOrder).toBe(5);
    expect(merged.packSize).toBe(4);
    expect(merged.orderQtyLow).toBe(3);
    expect(merged.active).toBe(true);
  });

  it('always applies name and par_level since they are required columns', () => {
    const merged = mergeRowOntoExisting(existing, blankRow({ name: 'New Name', parLevel: 30 }));
    expect(merged.name).toBe('New Name');
    expect(merged.parLevel).toBe(30);
  });
});
