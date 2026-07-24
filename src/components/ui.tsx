import { useCallback, useState, type ReactNode } from 'react';
import { levelFor } from '../lib/levels';

export const tint = (color: string, pct = 12) => `color-mix(in srgb, ${color} ${pct}%, white)`;

export function LevelBadge({ rating }: { rating: number }) {
  const lvl = levelFor(rating);
  if (!lvl) return <span className="text-gray-400">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 text-xs font-semibold text-gray-800"
      style={{ backgroundColor: tint(lvl.color) }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lvl.color }} />
      {lvl.word}
      <span className="font-normal text-gray-500">{lvl.rating}</span>
    </span>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</p>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export type Toast = { kind: 'ok' | 'err'; msg: string };

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 4500);
  }, []);
  const node = toast ? (
    <div
      className={`fixed right-6 bottom-6 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
        toast.kind === 'ok' ? 'bg-gray-900' : 'bg-red-600'
      }`}
    >
      {toast.msg}
    </div>
  ) : null;
  return { show, node };
}
