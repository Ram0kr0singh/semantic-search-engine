import type { AppView } from '../../urlState';
import type { Health } from '../../api';

interface BrandLoveFooterProps {
  onViewChange: (view: AppView) => void;
  health: Health | null;
}

export function BrandLoveFooter({ onViewChange, health }: BrandLoveFooterProps) {
  const corpusSize = health?.corpus_size ?? health?.document_count;
  const paperCount = corpusSize !== undefined
    ? `${corpusSize.toLocaleString()} PAPERS`
    : 'ARXIV PAPERS';
  const device = health?.embedding_device?.toUpperCase() ?? 'CUDA';

  return (
    <footer className="w-full mt-auto py-5 px-6 sm:px-10 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono tracking-[0.24em] uppercase text-[var(--text-muted)] select-none">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onViewChange('documents')}
          className="hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          PRIVACY &amp; DOCUMENTS
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => onViewChange('eval')}
          className="hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          EVALUATION
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span>ONLINE</span>
        <span>·</span>
        <span>{paperCount}</span>
        <span>·</span>
        <span className="text-[var(--bl-accent-hot,#ff3d5a)]">{device}</span>
      </div>
    </footer>
  );
}
