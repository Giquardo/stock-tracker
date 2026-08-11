import Dexie, { type EntityTable } from 'dexie';
import type { CsvImport, Item, StockCheck, StockCheckLine, Supplier } from './types';

export class StockCheckDb extends Dexie {
  suppliers!: EntityTable<Supplier, 'id'>;
  items!: EntityTable<Item, 'id'>;
  stockChecks!: EntityTable<StockCheck, 'id'>;
  stockCheckLines!: EntityTable<StockCheckLine, 'id'>;
  csvImports!: EntityTable<CsvImport, 'id'>;

  constructor() {
    super('stock-check-db');

    this.version(1).stores({
      suppliers: 'id, &name',
      items: 'id, &sku, supplierId, location, [location+sortOrder], active',
      stockChecks: 'id, status, startedAt',
      stockCheckLines: 'id, sessionId, itemId, status',
      csvImports: 'id, importedAt',
    });

    // v2: `active` is a boolean, which IndexedDB rejects as an index key
    // (IDBKeyRange.only(true) throws DataError) — the v1 index on it was
    // silently unusable. Filter active items in JS instead; catalogue size
    // (≤100) makes that fine.
    this.version(2).stores({
      suppliers: 'id, &name',
      items: 'id, &sku, supplierId, location, [location+sortOrder]',
      stockChecks: 'id, status, startedAt',
      stockCheckLines: 'id, sessionId, itemId, status',
      csvImports: 'id, importedAt',
    });
  }
}

export const db = new StockCheckDb();
