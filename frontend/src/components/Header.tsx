import type { Health } from '../api';

interface HeaderProps {
  health: Health | null;
}

export function Header({ health }: HeaderProps) {
  const device = health?.embedding_device?.toUpperCase() ?? 'CPU';
  const paperCount = health?.document_count
    ? `${health.document_count.toLocaleString()} papers`
    : 'Corpus';

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-slate-200">
      <div>
        <span className="text-[11px] font-bold tracking-widest uppercase text-blue-700 block">
          arXiv Research
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Semantic Search Engine
        </h1>
      </div>

      <div
        className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-2xs self-start sm:self-auto"
        aria-live="polite"
      >
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            health ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
          }`}
          aria-hidden="true"
        />
        <span>
          {health
            ? `Online · ${paperCount} · ${device}`
            : 'Connecting to API…'}
        </span>
      </div>
    </header>
  );
}
