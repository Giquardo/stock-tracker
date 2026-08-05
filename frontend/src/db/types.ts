export interface Supplier {
  id: string;
  name: string;
  contactEmail: string | null;
  orderDay: string | null;
  notes: string | null;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  supplierId: string;
  category: string | null;
  location: string | null;
  sortOrder: number;
  unit: string | null;
  parLevel: number;
  packSize: number;
  orderQtyLow: number | null;
  active: boolean;
  lastSeenInImport: string | null;
}

export type StockCheckStatus = 'draft' | 'completed' | 'abandoned';

export interface StockCheck {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: StockCheckStatus;
  checkerLabel: string | null;
  note: string | null;
}

export type LineStatus = 'unchecked' | 'ok' | 'low' | 'out';

export interface StockCheckLine {
  id: string;
  sessionId: string;
  itemId: string;
  status: LineStatus;
  countedQty: number | null;
  orderQty: number;
  isAdjusted: boolean;
  excluded: boolean;
  checkedAt: string | null;
  /** Snapshot of item.parLevel at check time, per spec §3.4. */
  parLevelSnapshot: number;
  /** Snapshot of item.packSize at check time, per spec §3.4. */
  packSizeSnapshot: number;
}

export interface CsvImport {
  id: string;
  filename: string;
  importedAt: string;
  rowsAdded: number;
  rowsUpdated: number;
  rowsMissing: number;
  rowsRejected: number;
}
