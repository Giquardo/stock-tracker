import { describe, expect, it } from 'vitest';
import { calculateOrderQuantity } from './orderQuantity';

describe('calculateOrderQuantity', () => {
  it('OK status orders nothing', () => {
    expect(
      calculateOrderQuantity({ status: 'ok', parLevel: 10, packSize: 1, orderQtyLow: null, countedQty: null }),
    ).toBe(0);
  });

  it('unchecked status orders nothing', () => {
    expect(
      calculateOrderQuantity({
        status: 'unchecked',
        parLevel: 10,
        packSize: 1,
        orderQtyLow: null,
        countedQty: null,
      }),
    ).toBe(0);
  });

  it('Low status without override uses ceil(par_level / 2)', () => {
    expect(
      calculateOrderQuantity({ status: 'low', parLevel: 9, packSize: 1, orderQtyLow: null, countedQty: null }),
    ).toBe(5); // ceil(4.5) = 5
  });

  it('Low status with an explicit order_qty_low override uses the override', () => {
    expect(
      calculateOrderQuantity({ status: 'low', parLevel: 9, packSize: 1, orderQtyLow: 2, countedQty: null }),
    ).toBe(2);
  });

  it('Out status orders the full par_level', () => {
    expect(
      calculateOrderQuantity({ status: 'out', parLevel: 10, packSize: 1, orderQtyLow: null, countedQty: null }),
    ).toBe(10);
  });

  it('counted_qty overrides status-based calculation: par_level minus counted', () => {
    expect(
      calculateOrderQuantity({ status: 'out', parLevel: 10, packSize: 1, orderQtyLow: null, countedQty: 3 }),
    ).toBe(7);
  });

  it('counted_qty above par_level floors at zero, never negative', () => {
    expect(
      calculateOrderQuantity({ status: 'low', parLevel: 10, packSize: 1, orderQtyLow: null, countedQty: 15 }),
    ).toBe(0);
  });

  it('counted_qty of exactly zero is respected, not treated as absent', () => {
    expect(
      calculateOrderQuantity({ status: 'out', parLevel: 10, packSize: 1, orderQtyLow: null, countedQty: 0 }),
    ).toBe(10);
  });

  it('rounds up to the nearest pack_size multiple by default', () => {
    expect(
      calculateOrderQuantity({ status: 'out', parLevel: 10, packSize: 6, orderQtyLow: null, countedQty: null }),
    ).toBe(12); // ceil(10/6) * 6 = 2 * 6
  });

  it('exact pack_size multiples are not rounded up further', () => {
    expect(
      calculateOrderQuantity({ status: 'out', parLevel: 12, packSize: 6, orderQtyLow: null, countedQty: null }),
    ).toBe(12);
  });

  it('pack_size of 1 never changes the raw quantity', () => {
    expect(
      calculateOrderQuantity({ status: 'low', parLevel: 7, packSize: 1, orderQtyLow: null, countedQty: null }),
    ).toBe(4); // ceil(7/2) = 4
  });

  it('a zero result stays zero regardless of pack_size', () => {
    expect(
      calculateOrderQuantity({ status: 'ok', parLevel: 10, packSize: 6, orderQtyLow: null, countedQty: null }),
    ).toBe(0);
  });

  it('rounding direction "down" truncates to the lower pack_size multiple', () => {
    expect(
      calculateOrderQuantity({
        status: 'out',
        parLevel: 10,
        packSize: 6,
        orderQtyLow: null,
        countedQty: null,
        roundingDirection: 'down',
      }),
    ).toBe(6); // floor(10/6) * 6
  });

  it('rounding direction "nearest" rounds to the closest pack_size multiple', () => {
    expect(
      calculateOrderQuantity({
        status: 'out',
        parLevel: 13,
        packSize: 6,
        orderQtyLow: null,
        countedQty: null,
        roundingDirection: 'nearest',
      }),
    ).toBe(12); // 13/6 = 2.16 -> rounds to 2 * 6
  });
});
