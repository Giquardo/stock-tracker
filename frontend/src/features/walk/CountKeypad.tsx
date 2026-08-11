import { useState } from 'react';

interface CountKeypadProps {
  itemName: string;
  initialValue: number | null;
  onConfirm: (value: number) => void;
  onClose: () => void;
}

/**
 * FR-3: a large on-screen numeric keypad for entering the shelf count,
 * rather than relying on the OS keyboard (inconsistent sizing across
 * tablets, and often too small for a stockroom in a hurry).
 */
export function CountKeypad({ itemName, initialValue, onConfirm, onClose }: CountKeypadProps) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : '');

  function pressDigit(digit: string) {
    setValue((prev) => (prev === '0' ? digit : prev + digit));
  }

  function backspace() {
    setValue((prev) => prev.slice(0, -1));
  }

  function confirm() {
    onConfirm(value === '' ? 0 : Number(value));
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-base text-slate-500">Shelf count</p>
        <p className="text-lg font-semibold text-slate-900">{itemName}</p>

        <div className="my-4 rounded-lg border border-slate-300 px-4 py-3 text-right text-3xl font-semibold text-slate-900">
          {value || '0'}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              className="min-h-14 rounded-lg bg-slate-100 text-2xl font-semibold text-slate-900 active:bg-slate-200"
              onClick={() => pressDigit(digit)}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="min-h-14 rounded-lg bg-slate-100 text-xl font-semibold text-slate-900 active:bg-slate-200"
            onClick={backspace}
            aria-label="Backspace"
          >
            ⌫
          </button>
          <button
            type="button"
            className="min-h-14 rounded-lg bg-slate-100 text-2xl font-semibold text-slate-900 active:bg-slate-200"
            onClick={() => pressDigit('0')}
          >
            0
          </button>
          <button
            type="button"
            className="min-h-14 rounded-lg bg-emerald-600 text-xl font-semibold text-white active:bg-emerald-700"
            onClick={confirm}
          >
            Done
          </button>
        </div>

        <button
          type="button"
          className="mt-3 min-h-12 w-full rounded-lg border border-slate-300 text-base font-medium text-slate-700 active:bg-slate-100"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
