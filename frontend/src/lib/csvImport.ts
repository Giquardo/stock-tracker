import Papa from 'papaparse';

/** Row shape as parsed straight out of the CSV, before validation. */
export interface RawImportRow {
  sku?: string;
  name?: string;
  supplier?: string;
  category?: string;
  location?: string;
  sort_order?: string;
  unit?: string;
  par_level?: string;
  pack_size?: string;
  order_qty_low?: string;
  active?: string;
}

/**
 * A validated row ready to merge. Optional fields are `null` when the CSV
 * cell was blank, which the merge step reads as "leave existing value
 * untouched" (spec §4.2) rather than as a value to write.
 */
export interface ValidatedRow {
  rowNumber: number;
  sku: string;
  name: string;
  supplier: string;
  category: string | null;
  location: string | null;
  sortOrder: number | null;
  unit: string | null;
  parLevel: number;
  packSize: number | null;
  orderQtyLow: number | null;
  active: boolean | null;
}

export interface RowError {
  rowNumber: number;
  reason: string;
}

export type ParseOutcome =
  | { kind: 'rejected'; duplicateSkus: { sku: string; rowNumbers: number[] }[] }
  | { kind: 'parsed'; validRows: ValidatedRow[]; rowErrors: RowError[] };

const REQUIRED_COLUMNS = ['sku', 'name', 'supplier', 'par_level'] as const;

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return undefined;
}

/**
 * Parses and validates CSV text per spec §4.1-§4.3. Duplicate SKUs within
 * the file reject the whole file (nothing else is checked in that case).
 * Otherwise, invalid rows are collected as errors and skipped; valid rows
 * are returned for the merge step.
 */
export function parseAndValidateCsv(csvText: string): ParseOutcome {
  const parsed = Papa.parse<RawImportRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const rows = parsed.data;

  // Row numbers are 1-based and count the header row, matching how a user
  // would read line numbers in a spreadsheet/text editor.
  const skuRowNumbers = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const sku = row.sku?.trim();
    if (!sku) return;
    const rowNumber = index + 2;
    const existing = skuRowNumbers.get(sku);
    if (existing) {
      existing.push(rowNumber);
    } else {
      skuRowNumbers.set(sku, [rowNumber]);
    }
  });

  const duplicateSkus = [...skuRowNumbers.entries()]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([sku, rowNumbers]) => ({ sku, rowNumbers }));

  if (duplicateSkus.length > 0) {
    return { kind: 'rejected', duplicateSkus };
  }

  const validRows: ValidatedRow[] = [];
  const rowErrors: RowError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];

    for (const column of REQUIRED_COLUMNS) {
      if (!row[column]?.trim()) {
        errors.push(`${column} is required`);
      }
    }

    const sku = row.sku?.trim() ?? '';
    const name = row.name?.trim() ?? '';
    const supplier = row.supplier?.trim() ?? '';

    const parLevelRaw = row.par_level?.trim();
    const parLevel = parLevelRaw ? Number(parLevelRaw) : NaN;
    if (parLevelRaw && (!Number.isFinite(parLevel) || parLevel < 0)) {
      errors.push('par_level must be a number >= 0');
    }

    let packSize: number | null = null;
    const packSizeRaw = row.pack_size?.trim();
    if (packSizeRaw) {
      packSize = Number(packSizeRaw);
      if (!Number.isFinite(packSize) || packSize <= 0) {
        errors.push('pack_size must be a number > 0');
      }
    }

    let sortOrder: number | null = null;
    const sortOrderRaw = row.sort_order?.trim();
    if (sortOrderRaw) {
      sortOrder = Number(sortOrderRaw);
      if (!Number.isFinite(sortOrder)) {
        errors.push('sort_order must be a number');
      }
    }

    let orderQtyLow: number | null = null;
    const orderQtyLowRaw = row.order_qty_low?.trim();
    if (orderQtyLowRaw) {
      orderQtyLow = Number(orderQtyLowRaw);
      if (!Number.isFinite(orderQtyLow) || orderQtyLow < 0) {
        errors.push('order_qty_low must be a number >= 0');
      }
    }

    let active: boolean | null = null;
    const activeRaw = row.active?.trim();
    if (activeRaw) {
      const parsedActive = parseBoolean(activeRaw);
      if (parsedActive === undefined) {
        errors.push('active must be a recognisable boolean (true/false/yes/no/1/0)');
      } else {
        active = parsedActive;
      }
    }

    if (errors.length > 0) {
      rowErrors.push({ rowNumber, reason: errors.join('; ') });
      return;
    }

    validRows.push({
      rowNumber,
      sku,
      name,
      supplier,
      category: blankToNull(row.category),
      location: blankToNull(row.location),
      sortOrder,
      unit: blankToNull(row.unit),
      parLevel,
      packSize,
      orderQtyLow,
      active,
    });
  });

  return { kind: 'parsed', validRows, rowErrors };
}

export interface ExistingItemSummary {
  sku: string;
}

export interface MergePlan {
  newRows: ValidatedRow[];
  updatedRows: ValidatedRow[];
  missingSkus: string[];
  newSupplierNames: string[];
}

/**
 * Compares valid rows against the current catalogue to classify each as
 * new or an update, and finds SKUs present in the DB but absent from this
 * file (spec §4.2: flagged, not deleted). Suppliers not already known are
 * reported so the caller can create them.
 */
export function planMerge(
  validRows: ValidatedRow[],
  existingItems: ExistingItemSummary[],
  existingSupplierNames: string[],
): MergePlan {
  const existingSkuSet = new Set(existingItems.map((item) => item.sku));
  const existingSupplierSet = new Set(existingSupplierNames);

  const newRows: ValidatedRow[] = [];
  const updatedRows: ValidatedRow[] = [];
  const newSupplierNames = new Set<string>();
  const seenSkus = new Set<string>();

  for (const row of validRows) {
    seenSkus.add(row.sku);
    if (existingSkuSet.has(row.sku)) {
      updatedRows.push(row);
    } else {
      newRows.push(row);
    }
    if (!existingSupplierSet.has(row.supplier)) {
      newSupplierNames.add(row.supplier);
    }
  }

  const missingSkus = existingItems.map((item) => item.sku).filter((sku) => !seenSkus.has(sku));

  return { newRows, updatedRows, missingSkus, newSupplierNames: [...newSupplierNames] };
}

/** The item fields a CSV row can update; excludes id/sku/supplierId, which the caller resolves separately. */
export interface MergeableItemFields {
  name: string;
  category: string | null;
  location: string | null;
  sortOrder: number;
  unit: string | null;
  parLevel: number;
  packSize: number;
  orderQtyLow: number | null;
  active: boolean;
}

/**
 * Merges a validated row's fields onto an existing record, per spec §4.2:
 * blank cells (null here) leave the existing value untouched. `name` and
 * `parLevel` are required columns, so they always come from the row.
 */
export function mergeRowOntoExisting(existing: MergeableItemFields, row: ValidatedRow): MergeableItemFields {
  return {
    name: row.name,
    category: row.category ?? existing.category,
    location: row.location ?? existing.location,
    sortOrder: row.sortOrder ?? existing.sortOrder,
    unit: row.unit ?? existing.unit,
    parLevel: row.parLevel,
    packSize: row.packSize ?? existing.packSize,
    orderQtyLow: row.orderQtyLow ?? existing.orderQtyLow,
    active: row.active ?? existing.active,
  };
}
