export type LineStatus = 'unchecked' | 'ok' | 'low' | 'out';

export type RoundingDirection = 'up' | 'down' | 'nearest';

export interface OrderQuantityInput {
  status: LineStatus;
  parLevel: number;
  packSize: number;
  orderQtyLow: number | null;
  countedQty: number | null;
  roundingDirection?: RoundingDirection;
}

/**
 * Spec FR-2. Counted quantity overrides status-based calculation whenever
 * present, regardless of status. Result is always rounded to a pack_size
 * multiple in the configured direction (default "up").
 */
export function calculateOrderQuantity(input: OrderQuantityInput): number {
  const { status, parLevel, packSize, orderQtyLow, countedQty } = input;
  const roundingDirection = input.roundingDirection ?? 'up';

  let raw: number;
  if (countedQty != null) {
    raw = Math.max(0, parLevel - countedQty);
  } else {
    switch (status) {
      case 'unchecked':
      case 'ok':
        raw = 0;
        break;
      case 'low':
        raw = orderQtyLow ?? Math.ceil(parLevel / 2);
        break;
      case 'out':
        raw = parLevel;
        break;
    }
  }

  return roundToPackSize(raw, packSize, roundingDirection);
}

function roundToPackSize(qty: number, packSize: number, direction: RoundingDirection): number {
  if (qty === 0) return 0;

  const multiples = qty / packSize;
  let roundedMultiples: number;
  switch (direction) {
    case 'up':
      roundedMultiples = Math.ceil(multiples);
      break;
    case 'down':
      roundedMultiples = Math.floor(multiples);
      break;
    case 'nearest':
      roundedMultiples = Math.round(multiples);
      break;
  }

  return roundedMultiples * packSize;
}
