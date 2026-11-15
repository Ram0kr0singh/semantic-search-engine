import { useEffect } from 'react';
import type { Health, Method } from '../../api';
import type { AppView, ResultCount } from '../../urlState';
import type { Theme } from '../../theme';

interface BrandLoveNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  view: AppView;
  onViewChange: (v: AppView) => void;
  k: ResultCount;
  onKChange: (k: ResultCount) => void;
  health: Health | null;
  methods: Method[];
  selectedModel: string;
  onSelectModel: (m: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function BrandLoveNavDrawer({
  isOpen,
  onClose,
  view,
  onViewChange,
  k,
  onKChange,
  health,
  methods,
  selectedModel,
  onSelectModel,
  theme,
  onToggleTheme,
}: BrandLoveNavDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation & Settings Menu"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-250 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <span className="text-[11px] font-black tracking-[0.24em] uppercase text-[var(--bl-accent-hot,#ff3d5a)]">
            MENU & SETTINGS
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* View Navigation */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] block">
            APPLICATIONS
          </span>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                onViewChange('search');
                onClose();
              }}
              className={`text-left px-4 py-2.5 rounded text-xs font-bold tracking-[0.16em] uppercase transition-all cursor-pointer ${
                view === 'search' || view === 'compare'
                  ? 'bg-[var(--bl-accent-hot,#ff3d5a)] text-white font-black'
                  : 'text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              1. CURVE SEARCH (ARXIV)
            </button>
            <button
              type="button"
              onClick={() => {
                onViewChange('documents');
                onClose();
              }}
              className={`text-left px-4 py-2.5 rounded text-xs font-bold tracking-[0.16em] uppercase transition-all cursor-pointer ${
                view === 'documents'
                  ? 'bg-[var(--bl-accent-hot,#ff3d5a)] text-white font-black'
                  : 'text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              2. YOUR DOCUMENTS (PRIVATE WORKSPACE)
            </button>
            <button
              type="button"
              onClick={() => {
                onViewChange('eval');
                onClose();
              }}
              className={`text-left px-4 py-2.5 rounded text-xs font-bold tracking-[0.16em] uppercase transition-all cursor-pointer ${
                view === 'eval'
                  ? 'bg-[var(--bl-accent-hot,#ff3d5a)] text-white font-black'
                  : 'text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              3. EVALUATION BENCHMARKS
            </button>
          </div>
        </div>

        {/* Number of Curves Displayed (k) */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
          <label htmlFor="curve-count-select" className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] block">
            CURVE COUNT (TOP K)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {([5, 10, 20, 50] as ResultCount[]).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onKChange(val)}
                className={`py-1.5 text-xs font-mono font-bold rounded border transition-all cursor-pointer ${
                  k === val
                    ? 'border-[var(--bl-accent-hot,#ff3d5a)] bg-[var(--bl-accent-hot,#ff3d5a)]/20 text-[var(--text)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Approach / Model Selector */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
          <label htmlFor="drawer-model-select" className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] block">
            RETRIEVAL APPROACH
          </label>
          <select
            id="drawer-model-select"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono uppercase bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] rounded focus:outline-none focus:border-[var(--bl-accent-hot,#ff3d5a)] cursor-pointer"
          >
            {methods.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.ready}>
                {m.display_name} {!m.ready ? '(Unavailable)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* System & Health Status */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)]">
          <span className="text-[10px] tracking-widest uppercase block">
            CORPUS STATUS
          </span>
          <div className="p-3 rounded bg-[var(--surface-raised)] border border-[var(--border)] space-y-1">
            <div className="flex justify-between">
              <span>STATUS:</span>
              <span className="text-emerald-400 font-bold uppercase">{health?.status ?? 'ONLINE'}</span>
            </div>
            <div className="flex justify-between">
              <span>DOCUMENTS:</span>
              <span className="text-[var(--text)] font-bold">{health?.document_count.toLocaleString() ?? '30,000'}</span>
            </div>
            <div className="flex justify-between">
              <span>HARDWARE:</span>
              <span className="text-[var(--text)] font-bold uppercase">{health?.embedding_device ?? 'CUDA'}</span>
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)]">
            THEME ({theme.toUpperCase()})
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-3 py-1 rounded text-xs font-mono uppercase border border-[var(--border)] text-[var(--text)] hover:border-[var(--bl-accent-hot,#ff3d5a)] transition-colors cursor-pointer"
          >
            TOGGLE
          </button>
        </div>
      </div>
    </div>
  );
}
