import { describe, expect, it } from 'vitest';
import { buildExportRows, generateCsv } from './csvExport';
import type { OrderLine } from './useReviewData';
import type { Item, StockCheckLine } from '../../db/types';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    sku: '0001',
    name: 'Widget',
    supplierId: 'supplier-1',
    category: null,
    location: null,
    sortOrder: 1,
    unit: 'each',
    parLevel: 10,
    packSize: 1,
    orderQtyLow: null,
    active: true,
    lastSeenInImport: null,
    ...overrides,
  };
}

function makeLine(overrides: Partial<StockCheckLine> = {}): StockCheckLine {
  return {
    id: 'line-1',
    sessionId: 'session-1',
    itemId: 'item-1',
    status: 'low',
    countedQty: null,
    orderQty: 5,
    isAdjusted: false,
    excluded: false,
    checkedAt: '2026-08-05T00:00:00.000Z',
    parLevelSnapshot: 10,
    packSizeSnapshot: 1,
    ...overrides,
  };
}

function makeOrderLine(overrides: { item?: Partial<Item>; line?: Partial<StockCheckLine>; supplierName?: string } = {}): OrderLine {
  return {
    item: makeItem(overrides.item),
    line: makeLine(overrides.line),
    supplierName: overrides.supplierName ?? 'Acme Supplies',
  };
}

describe('buildExportRows', () => {
  it('maps an order line to the spec FR-5 export columns', () => {
    const rows = buildExportRows([makeOrderLine()]);
    expect(rows).toEqual([
      { sku: '0001', name: 'Widget', unit: 'each', order_qty: 5, supplier: 'Acme Supplies', status: 'low', counted: '' },
    ]);
  });

  it('includes the counted quantity when present', () => {
    const rows = buildExportRows([makeOrderLine({ line: { countedQty: 3 } })]);
    expect(rows[0]?.counted).toBe(3);
  });

  it('drops excluded lines entirely, not just marks them', () => {
    const rows = buildExportRows([
      makeOrderLine({ line: { id: 'line-1', excluded: true } }),
      makeOrderLine({ line: { id: 'line-2', excluded: false } }),
    ]);
    expect(rows).toHaveLength(1);
  });

  it('falls back to an empty unit when the item has none', () => {
    const rows = buildExportRows([makeOrderLine({ item: { unit: null } })]);
    expect(rows[0]?.unit).toBe('');
  });
});

describe('generateCsv', () => {
  it('produces a header row and one line per order row', () => {
    const rows = buildExportRows([makeOrderLine(), makeOrderLine({ item: { sku: '0002', name: 'Gadget' } })]);
    const csv = generateCsv(rows);
    // Papa.unparse defaults to RFC 4180 CRLF line endings.
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('sku,name,unit,order_qty,supplier,status,counted');
  });

  it('quotes fields containing commas', () => {
    const rows = buildExportRows([makeOrderLine({ item: { name: 'Widget, Large' } })]);
    const csv = generateCsv(rows);
    expect(csv).toContain('"Widget, Large"');
  });
});
