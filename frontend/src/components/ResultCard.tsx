import { useState } from 'react';
import { ApiError, type DocumentRecord, type SearchItem } from '../api';

interface ResultCardProps {
  item: SearchItem;
  onlyHere: boolean;
  getDocument: (id: string) => Promise<DocumentRecord>;
}

export function ResultCard({ item, onlyHere, getDocument }: ResultCardProps) {
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
    <article className="p-4 sm:p-5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-toolbar)]/50 focus-within:bg-[var(--surface-toolbar)]/40 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] mb-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] bg-[var(--surface)] text-[var(--text)] border border-[var(--border-subtle)]">
            #{item.rank}
          </span>
          <span className="font-mono text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Score {item.score.toFixed(3)}
          </span>
        </div>
        {onlyHere && (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs"
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
          className="hover:text-blue-600 dark:hover:text-blue-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
        >
          {item.title || 'Untitled arXiv Paper'}
        </a>
      </h3>

      <div className="mt-1">
        <a
          href={arxivUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          arXiv:{item.id}
          <svg
            className="w-3 h-3 opacity-70"
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

      <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
        {item.snippet}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.categories.map((category) => (
          <span
            key={category}
            className="text-[11px] px-2.5 py-0.5 bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-full font-mono"
          >
            {category}
          </span>
        ))}
        {item.year !== null && item.year !== undefined && (
          <span className="text-[11px] px-2.5 py-0.5 bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-full font-medium">
            {item.year}
          </span>
        )}
      </div>

      <div className="mt-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => void toggle()}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded py-1 inline-flex items-center gap-1 cursor-pointer"
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
          <p className="mt-2 text-xs text-[var(--text-muted)] italic">
            Loading full abstract…
          </p>
        )}

        {error && (
          <p
            className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium"
            role="alert"
          >
            {error}
          </p>
        )}

        {open && document && (
          <div className="mt-2.5 p-3.5 bg-[var(--surface-toolbar)] rounded-xl border-l-2 border-blue-500 text-xs sm:text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap shadow-inner">
            <span className="block font-bold text-[10px] tracking-wider uppercase text-blue-600 dark:text-blue-400 mb-1">
              Full Abstract
            </span>
            {document.abstract}
          </div>
        )}
      </div>
    </article>
  );
}
