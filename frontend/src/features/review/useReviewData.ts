import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Item, StockCheckLine } from '../../db/types';
import { useDraftSession } from '../walk/useDraftSession';

export interface OrderLine {
  line: StockCheckLine;
  item: Item;
  supplierName: string;
}

export interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  lines: OrderLine[];
  /** Count and total units exclude lines the user has marked excluded. */
  lineCount: number;
  totalUnits: number;
}

export interface ReviewData {
  sessionId: string | null;
  session: { checkerLabel: string | null; startedAt: string } | null;
  groups: SupplierGroup[];
  uncheckedCount: number;
  totalActiveItems: number;
}

/** Lines with order_qty > 0, grouped by supplier, per spec FR-4. */
export function useReviewData(): ReviewData {
  const sessionId = useDraftSession();

  const session = useLiveQuery(
    () => (sessionId ? db.stockChecks.get(sessionId) : undefined),
    [sessionId],
  );

  const items = useLiveQuery(() => db.items.toArray(), []) ?? [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];
  const lines =
    useLiveQuery(
      () =>
        sessionId
          ? db.stockCheckLines.where('sessionId').equals(sessionId).toArray()
          : Promise.resolve<StockCheckLine[]>([]),
      [sessionId],
    ) ?? [];

  const activeItems = items.filter((item) => item.active);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));
  const lineByItemId = new Map(lines.map((line) => [line.itemId, line]));

  const uncheckedCount = activeItems.filter((item) => {
    const status = lineByItemId.get(item.id)?.status;
    return !status || status === 'unchecked';
  }).length;

  const orderLines: OrderLine[] = [];
  for (const line of lines) {
    if (line.orderQty <= 0) continue;
    const item = itemById.get(line.itemId);
    if (!item) continue;
    orderLines.push({ line, item, supplierName: supplierNameById.get(item.supplierId) ?? 'Unknown supplier' });
  }

  const groupsBySupplier = new Map<string, SupplierGroup>();
  for (const orderLine of orderLines) {
    const key = orderLine.item.supplierId;
    let group = groupsBySupplier.get(key);
    if (!group) {
      group = { supplierId: key, supplierName: orderLine.supplierName, lines: [], lineCount: 0, totalUnits: 0 };
      groupsBySupplier.set(key, group);
    }
    group.lines.push(orderLine);
    if (!orderLine.line.excluded) {
      group.lineCount += 1;
      group.totalUnits += orderLine.line.orderQty;
    }
  }

  const groups = [...groupsBySupplier.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  for (const group of groups) {
    group.lines.sort((a, b) => a.item.name.localeCompare(b.item.name));
  }

  return {
    sessionId: sessionId ?? null,
    session: session ? { checkerLabel: session.checkerLabel, startedAt: session.startedAt } : null,
    groups,
    uncheckedCount,
    totalActiveItems: activeItems.length,
  };
}
