import { useState } from 'react';
import { ApiError, type DocumentRecord, type SearchItem } from '../api';

interface ResultCardProps {
  item: SearchItem;
  onlyHere: boolean;
  getDocument: (id: string) => Promise<DocumentRecord>;
  isReranked?: boolean;
}

export function ResultCard({ item, onlyHere, getDocument, isReranked = false }: ResultCardProps) {
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (!open && !document) {
      setLoading(true);
      setError(null);
      try {
        const doc = await getDocument(item.id);
        setDocument(doc);
      } catch (cause) {
        const msg =
          cause instanceof ApiError
            ? cause.message
            : 'Failed to load full document record. Please try again.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    setOpen((prev) => !prev);
  };

  const arxivUrl = `https://arxiv.org/abs/${encodeURIComponent(item.id)}`;

  return (
    <article className="p-4 sm:p-5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-raised)]/60 focus-within:bg-[var(--surface-raised)]/50 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] mb-2.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-sm font-mono font-bold text-xs bg-[#ff3d5a]/10 text-[var(--bl-accent-hot,#ff3d5a)] border border-[#ff3d5a]/30">
            #{item.rank}
          </span>
          <span className="font-mono text-xs font-medium px-2.5 py-0.5 rounded-sm bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)]" title={isReranked ? 'Higher is better. Only comparable within this list' : undefined}>
            {isReranked ? 'Relevance score' : 'Score'} {item.score.toFixed(3)}
          </span>
        </div>
        {onlyHere && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-mono font-semibold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30"
            title="Present only in this column's results"
          >
            Only here
          </span>
        )}
      </div>

      <h3 className="text-sm sm:text-base font-bold text-[var(--text)] leading-snug">
        <a
          href={arxivUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--bl-accent-hot,#ff3d5a)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] rounded-sm"
        >
          {item.title || 'Untitled arXiv Paper'}
        </a>
      </h3>

      <div className="mt-1">
        <a
          href={arxivUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-[var(--bl-accent-hot,#ff3d5a)] hover:underline inline-flex items-center gap-1"
        >
          arXiv:{item.id}
          <svg
            className="w-3 h-3 opacity-80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      <p className="mt-2 text-xs sm:text-sm text-[var(--text)] leading-relaxed">
        {item.snippet}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.categories.map((category) => (
          <span
            key={category}
            className="text-[10px] uppercase font-mono px-2 py-0.5 bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-sm"
          >
            {category}
          </span>
        ))}
        {item.year !== null && item.year !== undefined && (
          <span className="text-[10px] font-mono px-2 py-0.5 bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-sm">
            {item.year}
          </span>
        )}
      </div>

      <div className="mt-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => void toggle()}
          className="text-xs font-mono uppercase tracking-wider text-[var(--bl-accent-hot,#ff3d5a)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] rounded-sm py-1 inline-flex items-center gap-1 cursor-pointer"
        >
          <span>{open ? 'Hide full abstract' : 'Show full abstract'}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {loading && (
          <p className="mt-2 text-xs text-[var(--text-muted)] font-mono italic">
            Loading full abstract…
          </p>
        )}

        {error && (
          <p
            className="mt-2 text-xs text-[var(--bl-accent-hot,#ff3d5a)] font-mono font-medium"
            role="alert"
          >
            {error}
          </p>
        )}

        {open && document && (
          <div className="mt-2.5 p-3.5 bg-[var(--surface-raised)] rounded-sm border-l-2 border-[var(--bl-accent-hot,#ff3d5a)] text-xs sm:text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
            <span className="block font-mono font-bold text-[10px] tracking-wider uppercase text-[var(--bl-accent-hot,#ff3d5a)] mb-1">
              Full Abstract
            </span>
            {document.abstract}
          </div>
        )}
      </div>
    </article>
  );
}
