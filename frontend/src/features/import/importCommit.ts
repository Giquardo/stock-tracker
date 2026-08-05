import { db } from '../../db/schema';
import { mergeRowOntoExisting, planMerge, type ValidatedRow } from '../../lib/csvImport';

export interface CommitOptions {
  filename: string;
  validRows: ValidatedRow[];
  rowErrorCount: number;
  /** SKUs the user chose to deactivate from the "missing" list (spec §4.2: flag, don't delete). */
  deactivateMissingSkus: string[];
}

export interface CommitResult {
  rowsAdded: number;
  rowsUpdated: number;
  rowsMissing: number;
  rowsRejected: number;
}

export async function commitImport(options: CommitOptions): Promise<CommitResult> {
  const { filename, validRows, rowErrorCount, deactivateMissingSkus } = options;

  return db.transaction('rw', db.items, db.suppliers, db.csvImports, async () => {
    const existingItems = await db.items.toArray();
    const existingSuppliers = await db.suppliers.toArray();
    const supplierIdByName = new Map(existingSuppliers.map((s) => [s.name, s.id]));
    const itemBySku = new Map(existingItems.map((item) => [item.sku, item]));

    const plan = planMerge(
      validRows,
      existingItems.map((item) => ({ sku: item.sku })),
      existingSuppliers.map((s) => s.name),
    );

    for (const name of plan.newSupplierNames) {
      const id = crypto.randomUUID();
      await db.suppliers.add({ id, name, contactEmail: null, orderDay: null, notes: null });
      supplierIdByName.set(name, id);
    }

    const now = new Date().toISOString();

    for (const row of plan.newRows) {
      const supplierId = supplierIdByName.get(row.supplier);
      if (!supplierId) throw new Error(`Unresolved supplier: ${row.supplier}`);
      await db.items.add({
        id: crypto.randomUUID(),
        sku: row.sku,
        name: row.name,
        supplierId,
        category: row.category,
        location: row.location,
        sortOrder: row.sortOrder ?? 0,
        unit: row.unit,
        parLevel: row.parLevel,
        packSize: row.packSize ?? 1,
        orderQtyLow: row.orderQtyLow,
        active: row.active ?? true,
        lastSeenInImport: now,
      });
    }

    for (const row of plan.updatedRows) {
      const existing = itemBySku.get(row.sku);
      if (!existing) continue;
      const supplierId = supplierIdByName.get(row.supplier) ?? existing.supplierId;
      const merged = mergeRowOntoExisting(existing, row);
      await db.items.update(existing.id, { ...merged, supplierId, lastSeenInImport: now });
    }

    for (const sku of deactivateMissingSkus) {
      const existing = itemBySku.get(sku);
      if (!existing) continue;
      await db.items.update(existing.id, { active: false });
    }

    await db.csvImports.add({
      id: crypto.randomUUID(),
      filename,
      importedAt: now,
      rowsAdded: plan.newRows.length,
      rowsUpdated: plan.updatedRows.length,
      rowsMissing: plan.missingSkus.length,
      rowsRejected: rowErrorCount,
    });

    return {
      rowsAdded: plan.newRows.length,
      rowsUpdated: plan.updatedRows.length,
      rowsMissing: plan.missingSkus.length,
      rowsRejected: rowErrorCount,
    };
  });
}

export async function computeImportPreview(validRows: ValidatedRow[]) {
  const [items, suppliers] = await Promise.all([db.items.toArray(), db.suppliers.toArray()]);
  return planMerge(
    validRows,
    items.map((item) => ({ sku: item.sku })),
    suppliers.map((s) => s.name),
  );
}
