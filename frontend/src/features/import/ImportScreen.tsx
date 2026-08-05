import { useEffect, useRef, useState } from 'react';
import { parseAndValidateCsv, type ValidatedRow } from '../../lib/csvImport';
import { commitImport, computeImportPreview, type CommitResult } from './importCommit';

/**
 * Temporary placeholder catalogue (docs/data/snacks-and-drinks-catalogue.csv)
 * synced to this path at dev/build time — see vite.config.ts. Loaded
 * automatically so testing this screen doesn't require a manual file pick;
 * the file picker below still works to preview/commit something else.
 */
const SAMPLE_DATA_URL = '/data/snacks-and-drinks-catalogue.csv';
const SAMPLE_DATA_FILENAME = 'snacks-and-drinks-catalogue.csv';

interface PreviewState {
  filename: string;
  validRows: ValidatedRow[];
  rowErrors: { rowNumber: number; reason: string }[];
  newCount: number;
  updatedCount: number;
  missingSkus: string[];
  newSupplierNames: string[];
}

type ScreenState =
  | { phase: 'idle' }
  | { phase: 'rejected'; filename: string; duplicateSkus: { sku: string; rowNumbers: number[] }[] }
  | { phase: 'preview'; preview: PreviewState }
  | { phase: 'committing'; preview: PreviewState }
  | { phase: 'done'; result: CommitResult }
  | { phase: 'error'; message: string };

export function ImportScreen() {
  const [state, setState] = useState<ScreenState>({ phase: 'idle' });
  const [deactivateSkus, setDeactivateSkus] = useState<Set<string>>(new Set());
  const autoLoadAttempted = useRef(false);

  async function processCsvText(text: string, filename: string) {
    const outcome = parseAndValidateCsv(text);

    if (outcome.kind === 'rejected') {
      setState({ phase: 'rejected', filename, duplicateSkus: outcome.duplicateSkus });
      return;
    }

    const plan = await computeImportPreview(outcome.validRows);
    setDeactivateSkus(new Set());
    setState({
      phase: 'preview',
      preview: {
        filename,
        validRows: outcome.validRows,
        rowErrors: outcome.rowErrors,
        newCount: plan.newRows.length,
        updatedCount: plan.updatedRows.length,
        missingSkus: plan.missingSkus,
        newSupplierNames: plan.newSupplierNames,
      },
    });
  }

  async function loadSampleData() {
    try {
      const response = await fetch(SAMPLE_DATA_URL);
      if (!response.ok) return;
      const text = await response.text();
      await processCsvText(text, SAMPLE_DATA_FILENAME);
    } catch {
      // No bundled sample available (e.g. docs/data is empty) — the manual
      // file picker below still works.
    }
  }

  useEffect(() => {
    if (autoLoadAttempted.current) return;
    autoLoadAttempted.current = true;
    void loadSampleData();
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    await processCsvText(text, file.name);
  }

  async function handleCommit(preview: PreviewState) {
    setState({ phase: 'committing', preview });
    try {
      const result = await commitImport({
        filename: preview.filename,
        validRows: preview.validRows,
        rowErrorCount: preview.rowErrors.length,
        deactivateMissingSkus: [...deactivateSkus],
      });
      setState({ phase: 'done', result });
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Import failed' });
    }
  }

  function toggleDeactivate(sku: string) {
    setDeactivateSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function reset() {
    setState({ phase: 'idle' });
    setDeactivateSkus(new Set());
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <h1 className="text-2xl font-semibold text-slate-100">Import catalogue</h1>
      <p className="mt-1 text-sm text-slate-400">
        Choose a CSV export to preview changes. Nothing is written until you confirm.
      </p>

      {(state.phase === 'idle' || state.phase === 'rejected' || state.phase === 'error') && (
        <div className="mt-6 space-y-3">
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-600 px-4 py-6 text-base font-medium text-slate-200 active:bg-slate-800">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          </label>
          <button
            type="button"
            className="min-h-12 w-full rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-400 active:bg-slate-800"
            onClick={() => void loadSampleData()}
          >
            Load sample catalogue (snacks &amp; drinks)
          </button>
        </div>
      )}

      {state.phase === 'rejected' && (
        <div className="mt-6 rounded-lg border border-red-700 bg-red-950/50 p-4">
          <p className="font-medium text-red-300">
            Import rejected: duplicate SKUs in {state.filename}
          </p>
          <p className="mt-1 text-sm text-red-400">
            Fix the file so every SKU appears once, then re-import.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-red-300">
            {state.duplicateSkus.map((dup) => (
              <li key={dup.sku}>
                SKU <span className="font-mono">{dup.sku}</span> appears on rows{' '}
                {dup.rowNumbers.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="mt-6 rounded-lg border border-red-700 bg-red-950/50 p-4 text-red-300">
          Import failed: {state.message}
        </div>
      )}

      {(state.phase === 'preview' || state.phase === 'committing') && (
        <div className="mt-6 space-y-4">
          <p className="text-slate-300">
            <span className="font-mono">{state.preview.filename}</span>
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="New" value={state.preview.newCount} tone="new" />
            <SummaryTile label="Updated" value={state.preview.updatedCount} tone="updated" />
            <SummaryTile label="Missing" value={state.preview.missingSkus.length} tone="missing" />
            <SummaryTile label="Rejected" value={state.preview.rowErrors.length} tone="rejected" />
          </div>

          {state.preview.newSupplierNames.length > 0 && (
            <details className="rounded-lg border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-200">
                {state.preview.newSupplierNames.length} new supplier
                {state.preview.newSupplierNames.length === 1 ? '' : 's'} will be created
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-slate-400">
                {state.preview.newSupplierNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
          )}

          {state.preview.rowErrors.length > 0 && (
            <details className="rounded-lg border border-red-800 p-3">
              <summary className="cursor-pointer text-sm font-medium text-red-300">
                {state.preview.rowErrors.length} row{state.preview.rowErrors.length === 1 ? '' : 's'} rejected
                (skipped, rest still imports)
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-red-400">
                {state.preview.rowErrors.map((error) => (
                  <li key={error.rowNumber}>
                    Row {error.rowNumber}: {error.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {state.preview.missingSkus.length > 0 && (
            <details className="rounded-lg border border-amber-800 p-3" open>
              <summary className="cursor-pointer text-sm font-medium text-amber-300">
                {state.preview.missingSkus.length} SKU
                {state.preview.missingSkus.length === 1 ? '' : 's'} in the catalogue but absent from this file
              </summary>
              <p className="mt-2 text-sm text-amber-400">
                Not deleted automatically. Check any you want deactivated instead of kept active.
              </p>
              <ul className="mt-2 space-y-2">
                {state.preview.missingSkus.map((sku) => (
                  <li key={sku} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`deactivate-${sku}`}
                      className="h-5 w-5"
                      checked={deactivateSkus.has(sku)}
                      onChange={() => toggleDeactivate(sku)}
                      disabled={state.phase === 'committing'}
                    />
                    <label htmlFor={`deactivate-${sku}`} className="font-mono text-sm text-slate-300">
                      {sku} — deactivate
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="min-h-12 flex-1 rounded-lg bg-sky-600 px-4 font-medium text-white active:bg-sky-700 disabled:opacity-50"
              disabled={state.phase === 'committing'}
              onClick={() => handleCommit(state.preview)}
            >
              {state.phase === 'committing' ? 'Committing…' : 'Commit import'}
            </button>
            <button
              type="button"
              className="min-h-12 rounded-lg border border-slate-600 px-4 font-medium text-slate-300 active:bg-slate-800 disabled:opacity-50"
              disabled={state.phase === 'committing'}
              onClick={reset}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.phase === 'done' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-emerald-700 bg-emerald-950/50 p-4 text-emerald-300">
            Import committed: {state.result.rowsAdded} new, {state.result.rowsUpdated} updated,{' '}
            {state.result.rowsMissing} missing, {state.result.rowsRejected} rejected.
          </div>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-slate-600 px-4 font-medium text-slate-300 active:bg-slate-800"
            onClick={reset}
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'new' | 'updated' | 'missing' | 'rejected';
}) {
  const toneClasses: Record<typeof tone, string> = {
    new: 'border-emerald-700 text-emerald-300',
    updated: 'border-sky-700 text-sky-300',
    missing: 'border-amber-700 text-amber-300',
    rejected: 'border-red-700 text-red-300',
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${toneClasses[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
