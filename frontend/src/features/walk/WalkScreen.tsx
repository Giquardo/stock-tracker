import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Item, LineStatus, StockCheckLine } from '../../db/types';
import { calculateOrderQuantity } from '../../lib/orderQuantity';
import { useDraftSession } from './useDraftSession';
import { CountKeypad } from './CountKeypad';

/** A line the user hasn't tapped yet — not persisted until they do. */
function virtualLine(item: Item, sessionId: string): StockCheckLine {
  return {
    id: '',
    sessionId,
    itemId: item.id,
    status: 'unchecked',
    countedQty: null,
    orderQty: 0,
    isAdjusted: false,
    excluded: false,
    checkedAt: null,
    parLevelSnapshot: item.parLevel,
    packSizeSnapshot: item.packSize,
  };
}

export function WalkScreen() {
  const sessionId = useDraftSession();

  const items = useLiveQuery(() => db.items.toArray(), []) ?? [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];
  const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));

  const lines =
    useLiveQuery(
      () =>
        sessionId
          ? db.stockCheckLines.where('sessionId').equals(sessionId).toArray()
          : Promise.resolve<StockCheckLine[]>([]),
      [sessionId],
    ) ?? [];
  const lineByItemId = new Map(lines.map((line) => [line.itemId, line]));

  const activeItems = items.filter((item) => item.active);

  const sortedItems = [...activeItems].sort((a, b) => {
    const locationA = a.location ?? '';
    const locationB = b.location ?? '';
    if (locationA !== locationB) return locationA.localeCompare(locationB);
    return a.sortOrder - b.sortOrder;
  });

  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [countEntryItem, setCountEntryItem] = useState<Item | null>(null);

  const categories = [...new Set(activeItems.map((item) => item.category).filter((c): c is string => !!c))].sort();
  const locations = [...new Set(activeItems.map((item) => item.location).filter((l): l is string => !!l))].sort();

  const filteredItems = sortedItems.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (supplierFilter && item.supplierId !== supplierFilter) return false;
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (locationFilter && item.location !== locationFilter) return false;
    return true;
  });

  const checkedCount = sortedItems.filter((item) => {
    const status = lineByItemId.get(item.id)?.status;
    return status != null && status !== 'unchecked';
  }).length;

  async function setStatus(item: Item, status: LineStatus) {
    if (!sessionId) return;
    const existing = lineByItemId.get(item.id);
    const now = new Date().toISOString();
    const orderQty = calculateOrderQuantity({
      status,
      parLevel: item.parLevel,
      packSize: item.packSize,
      orderQtyLow: item.orderQtyLow,
      countedQty: existing?.countedQty ?? null,
    });

    if (existing?.id) {
      await db.stockCheckLines.update(existing.id, { status, orderQty, checkedAt: now });
    } else {
      await db.stockCheckLines.add({
        id: crypto.randomUUID(),
        sessionId,
        itemId: item.id,
        status,
        countedQty: null,
        orderQty,
        isAdjusted: false,
        excluded: false,
        checkedAt: now,
        parLevelSnapshot: item.parLevel,
        packSizeSnapshot: item.packSize,
      });
    }
  }

  async function setCountedQty(item: Item, countedQty: number) {
    const existing = lineByItemId.get(item.id);
    if (!existing?.id) return;
    const orderQty = calculateOrderQuantity({
      status: existing.status,
      parLevel: existing.parLevelSnapshot,
      packSize: existing.packSizeSnapshot,
      orderQtyLow: item.orderQtyLow,
      countedQty,
    });
    await db.stockCheckLines.update(existing.id, { countedQty, orderQty, isAdjusted: true });
  }

  function jumpToUnchecked() {
    setSearch('');
    setSupplierFilter('');
    setCategoryFilter('');
    setLocationFilter('');
    const target = sortedItems.find((item) => {
      const status = lineByItemId.get(item.id)?.status;
      return !status || status === 'unchecked';
    });
    if (target) {
      requestAnimationFrame(() => {
        document.getElementById(`row-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  let lastLocation: string | null | undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg font-semibold text-slate-900">
              {checkedCount} / {sortedItems.length} checked
            </span>
            <button
              type="button"
              className="min-h-12 shrink-0 rounded-lg border border-slate-300 px-4 text-base font-medium text-slate-700 active:bg-slate-100"
              onClick={jumpToUnchecked}
            >
              Jump to unchecked
            </button>
          </div>

          <input
            type="search"
            placeholder="Search items…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-3 min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 placeholder:text-slate-400"
          />

          <div className="mt-3 flex gap-2 overflow-x-auto">
            <select
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
              className="min-h-10 shrink-0 rounded-full border border-slate-300 px-3 text-base font-medium text-slate-700"
            >
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="min-h-10 shrink-0 rounded-full border border-slate-300 px-3 text-base font-medium text-slate-700"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="min-h-10 shrink-0 rounded-full border border-slate-300 px-3 text-base font-medium text-slate-700"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-24">
        {filteredItems.length === 0 && (
          <p className="py-8 text-center text-base text-slate-500">No items match your search/filters.</p>
        )}

        <ul>
          {filteredItems.map((item) => {
            const line = lineByItemId.get(item.id) ?? virtualLine(item, sessionId ?? '');
            const showLocationHeader = item.location !== lastLocation;
            lastLocation = item.location;

            return (
              <li key={item.id}>
                {showLocationHeader && item.location && (
                  <div className="-mx-4 bg-slate-100 px-4 py-2 text-base font-semibold text-slate-700">
                    {item.location}
                  </div>
                )}
                <div id={`row-${item.id}`} className="border-b border-slate-200 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-lg font-semibold text-slate-900">{item.name}</span>
                    {line.countedQty != null && (
                      <span className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-base font-medium text-sky-800">
                        Counted: {line.countedQty}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-base text-slate-500">
                    {item.unit} · {supplierNameById.get(item.supplierId) ?? 'Unknown supplier'}
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <StatusButton label="OK" active={line.status === 'ok'} tone="ok" onClick={() => void setStatus(item, 'ok')} />
                    <StatusButton
                      label="Low"
                      active={line.status === 'low'}
                      tone="low"
                      onClick={() => void setStatus(item, 'low')}
                    />
                    <StatusButton
                      label="Out"
                      active={line.status === 'out'}
                      tone="out"
                      onClick={() => void setStatus(item, 'out')}
                    />
                  </div>

                  {line.status !== 'unchecked' && (
                    <button
                      type="button"
                      className="mt-2 min-h-10 text-base font-medium text-sky-700 underline underline-offset-2"
                      onClick={() => setCountEntryItem(item)}
                    >
                      Enter shelf count
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {countEntryItem && (
        <CountKeypad
          itemName={countEntryItem.name}
          initialValue={lineByItemId.get(countEntryItem.id)?.countedQty ?? null}
          onConfirm={(value) => {
            void setCountedQty(countEntryItem, value);
            setCountEntryItem(null);
          }}
          onClose={() => setCountEntryItem(null)}
        />
      )}
    </div>
  );
}

function StatusButton({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'ok' | 'low' | 'out';
  onClick: () => void;
}) {
  const activeClasses: Record<typeof tone, string> = {
    ok: 'bg-emerald-600 text-white border-emerald-600',
    low: 'bg-amber-500 text-white border-amber-500',
    out: 'bg-red-600 text-white border-red-600',
  };

  return (
    <button
      type="button"
      className={`min-h-12 rounded-lg border-2 text-base font-semibold ${
        active ? activeClasses[tone] : 'border-slate-300 bg-white text-slate-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
