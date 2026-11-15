import { useEffect, useState } from 'react';
import type { DocumentRecord, SearchItem } from '../../api';
import { interpolateRankColor } from './curveMath';

interface DetailPanelProps {
  item: SearchItem | null;
  onClose: () => void;
  getDocument?: (id: string) => Promise<DocumentRecord>;
  totalResultsCount?: number;
}

export function DetailPanel({
  item,
  onClose,
  getDocument,
  totalResultsCount = 10,
}: DetailPanelProps) {
  if (!item) return null;

  return (
    <DetailPanelContent
      item={item}
      onClose={onClose}
      getDocument={getDocument}
      totalResultsCount={totalResultsCount}
    />
  );
}

function DetailPanelContent({
  item,
  onClose,
  getDocument,
  totalResultsCount,
}: {
  item: SearchItem;
  onClose: () => void;
  getDocument?: (id: string) => Promise<DocumentRecord>;
  totalResultsCount: number;
}) {
  const [docRecord, setDocRecord] = useState<DocumentRecord | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(() => !!getDocument);

  useEffect(() => {
    if (!getDocument) return;

    let ignore = false;
    getDocument(item.id)
      .then((doc) => {
        if (!ignore) {
          setDocRecord(doc);
          setIsLoadingDoc(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setIsLoadingDoc(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [item.id, getDocument]);

  // Handle Escape key
  useEffect(() => {
    if (!item) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const color = interpolateRankColor(item.rank, totalResultsCount);
  const abstractText = docRecord?.abstract || item.snippet;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Paper Details: ${item.title}`}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 select-text">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-toolbar)]">
          <div className="flex items-center gap-2.5">
            <span
              className="text-xs font-mono font-black px-2.5 py-0.5 rounded uppercase"
              style={{ color, backgroundColor: `${color}18` }}
            >
              RANK #{item.rank}
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[var(--bl-text-dim,#8b9999)] uppercase">
              SCORE: {item.score.toFixed(4)}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)]"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--bl-text-bright,#ffffff)] leading-snug">
              {item.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--bl-text-dim,#8b9999)]">
              {item.year && <span>Published {item.year}</span>}
              <span>·</span>
              <span>arXiv ID: {item.id}</span>
            </div>
          </div>

          {/* Categories */}
          {item.categories.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--bl-text-dim,#8b9999)] block">
                SUBJECT CATEGORIES
              </span>
              <div className="flex flex-wrap gap-1.5">
                {item.categories.map((cat) => (
                  <span
                    key={cat}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Abstract */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--bl-text-dim,#8b9999)] block">
              ABSTRACT
            </span>
            {isLoadingDoc ? (
              <p className="text-xs text-[var(--bl-text-dim,#8b9999)] italic font-mono">
                Loading complete abstract from corpus…
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {abstractText}
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-[var(--border)] bg-[var(--surface-toolbar)] flex items-center justify-between">
          <a
            href={`https://arxiv.org/abs/${item.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-widest uppercase text-[var(--text)] hover:text-[var(--bl-accent-hot,#ff3d5a)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)]"
          >
            <span>VIEW ON ARXIV.ORG</span>
            <svg
              className="w-3.5 h-3.5"
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

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded text-[11px] font-bold tracking-wider uppercase bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--bl-accent-hot,#ff3d5a)] cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
