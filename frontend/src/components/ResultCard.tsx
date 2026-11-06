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
    <article className="p-4 border-b border-slate-200 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            #{item.rank}
          </span>
          <span className="font-mono text-slate-600">
            Score {item.score.toFixed(3)}
          </span>
        </div>
        {onlyHere && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200"
            title="Present only in this column's results"
          >
            Only here
          </span>
        )}
      </div>

      <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
        <a
          href={arxivUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          {item.title || 'Untitled arXiv Paper'}
        </a>
      </h3>

      <div className="mt-0.5">
        <a
          href={arxivUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
        >
          arXiv:{item.id}
        </a>
      </div>

      <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
        {item.snippet}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.categories.map((category) => (
          <span
            key={category}
            className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono"
          >
            {category}
          </span>
        ))}
        {item.year !== null && item.year !== undefined && (
          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
            {item.year}
          </span>
        )}
      </div>

      <div className="mt-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => void toggle()}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded py-0.5 inline-flex items-center gap-1"
        >
          {open ? 'Hide full abstract' : 'Show full abstract'}
        </button>

        {loading && (
          <p className="mt-2 text-xs text-slate-500 italic">
            Loading full abstract…
          </p>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        {open && document && (
          <div className="mt-2.5 p-3.5 bg-slate-50 rounded border-l-4 border-blue-500 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            <span className="block font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">
              Full Abstract
            </span>
            {document.abstract}
          </div>
        )}
      </div>
    </article>
  );
}
