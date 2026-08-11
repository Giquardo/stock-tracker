import { useState } from 'react';
import { db } from '../../db/schema';
import { buildExportRows, downloadTextFile, generateCsv } from './csvExport';
import { useReviewData, type OrderLine, type SupplierGroup } from './useReviewData';

interface ReviewScreenProps {
  onGoToWalk: () => void;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function ReviewScreen({ onGoToWalk }: ReviewScreenProps) {
  const { sessionId, session, groups, uncheckedCount, totalActiveItems } = useReviewData();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allOrderLines: OrderLine[] = groups.flatMap((group) => group.lines);
  const today = new Date().toLocaleDateString();

  function toggleCollapsed(supplierId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }

  async function setOrderQty(lineId: string, value: number) {
    await db.stockCheckLines.update(lineId, { orderQty: Math.max(0, value) });
  }

  async function toggleExcluded(lineId: string, current: boolean) {
    await db.stockCheckLines.update(lineId, { excluded: !current });
  }

  async function setCheckerLabel(value: string) {
    if (!sessionId) return;
    await db.stockChecks.update(sessionId, { checkerLabel: value || null });
  }

  async function completeSession() {
    if (!sessionId) return;
    await db.stockChecks.update(sessionId, { status: 'completed', completedAt: new Date().toISOString() });
  }

  function exportGroupCsv(group: SupplierGroup) {
    const rows = buildExportRows(group.lines);
    downloadTextFile(`order-${slugify(group.supplierName)}.csv`, generateCsv(rows), 'text/csv');
  }

  function exportCombinedCsv() {
    const rows = buildExportRows(allOrderLines);
    downloadTextFile('order-combined.csv', generateCsv(rows), 'text/csv');
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="mx-auto max-w-2xl px-4 py-4 pb-24 print:max-w-none print:p-0">
        <div className="print:hidden">
          <h1 className="text-2xl font-semibold text-slate-900">Order review</h1>

          <label className="mt-4 block text-base font-medium text-slate-700">
            Checker name (optional)
            <input
              type="text"
              defaultValue={session?.checkerLabel ?? ''}
              onBlur={(event) => void setCheckerLabel(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900"
              placeholder="Your name"
            />
          </label>

          {uncheckedCount > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-base text-amber-900">
                {uncheckedCount} of {totalActiveItems} items still unchecked.
              </p>
              <button
                type="button"
                className="min-h-10 shrink-0 rounded-lg border border-amber-400 bg-white px-3 text-base font-medium text-amber-800 active:bg-amber-100"
                onClick={onGoToWalk}
              >
                Go check them
              </button>
            </div>
          )}

          {groups.length === 0 && (
            <p className="mt-8 text-center text-base text-slate-500">
              Nothing to order yet — items marked Low or Out will show up here.
            </p>
          )}
        </div>

        {groups.length > 0 && (
          <div className="mt-6 space-y-4 print:mt-0 print:space-y-0">
            {groups.map((group, index) => {
              const isCollapsed = collapsed.has(group.supplierId);
              return (
                <div
                  key={group.supplierId}
                  className={`rounded-lg border border-slate-200 bg-white print:rounded-none print:border-0 ${
                    index > 0 ? 'print:break-before-page' : ''
                  }`}
                >
                  {/* Print-only page header: date, checker name, signature line, per spec FR-5. */}
                  <div className="hidden print:block print:pb-4">
                    <h2 className="text-xl font-semibold">Order sheet — {today}</h2>
                    <p className="mt-1 text-sm">Checker: {session?.checkerLabel || '________________'}</p>
                    <p className="mt-4 text-sm">Signature: ________________________________</p>
                  </div>

                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left print:hidden"
                    onClick={() => toggleCollapsed(group.supplierId)}
                  >
                    <span className="text-lg font-semibold text-slate-900">{group.supplierName}</span>
                    <span className="text-base text-slate-500">
                      {group.lineCount} line{group.lineCount === 1 ? '' : 's'} · {group.totalUnits} units
                      {isCollapsed ? ' ▸' : ' ▾'}
                    </span>
                  </button>

                  <div className="hidden text-lg font-semibold print:block print:px-0 print:py-2">
                    {group.supplierName} — {group.lineCount} line{group.lineCount === 1 ? '' : 's'}, {group.totalUnits}{' '}
                    units
                  </div>

                  {!isCollapsed && (
                    <ul className="border-t border-slate-200 print:border-t-0">
                      {group.lines.map(({ line, item }) => (
                        <li
                          key={line.id}
                          className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 print:border-slate-300 ${
                            line.excluded ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-medium text-slate-900">
                              {item.name}
                              {line.excluded && <span className="ml-2 text-sm text-slate-400">(excluded)</span>}
                            </p>
                            <p className="text-sm text-slate-500">
                              {item.unit} · {line.status.toUpperCase()}
                              {line.countedQty != null && (
                                <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 print:bg-transparent print:px-0">
                                  Counted: {line.countedQty}
                                </span>
                              )}
                            </p>
                          </div>

                          <input
                            type="number"
                            min={0}
                            value={line.orderQty}
                            onChange={(event) => void setOrderQty(line.id, Number(event.target.value))}
                            className="w-20 min-h-10 rounded-lg border border-slate-300 px-2 text-right text-base text-slate-900 print:border-0 print:text-lg print:font-semibold"
                            disabled={line.excluded}
                          />

                          <button
                            type="button"
                            className="min-h-10 shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 active:bg-slate-100 print:hidden"
                            onClick={() => void toggleExcluded(line.id, line.excluded)}
                          >
                            {line.excluded ? 'Include' : 'Exclude'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="px-4 py-3 print:hidden">
                    <button
                      type="button"
                      className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 active:bg-slate-100"
                      onClick={() => exportGroupCsv(group)}
                    >
                      Export CSV — {group.supplierName}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {groups.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              className="min-h-12 rounded-lg border border-slate-300 px-4 text-base font-medium text-slate-700 active:bg-slate-100"
              onClick={exportCombinedCsv}
            >
              Export combined CSV
            </button>
            <button
              type="button"
              className="min-h-12 rounded-lg border border-slate-300 px-4 text-base font-medium text-slate-700 active:bg-slate-100"
              onClick={() => window.print()}
            >
              Print / Export PDF
            </button>
            <button
              type="button"
              className="min-h-12 rounded-lg bg-emerald-600 px-4 text-base font-medium text-white active:bg-emerald-700"
              onClick={() => void completeSession()}
            >
              Complete session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
