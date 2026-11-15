import { useState } from 'react';
import type { WorkspaceSearchResultItem } from '../api';
import { highlightText } from '../workspaceUtils';

interface WorkspaceResultCardProps {
  item: WorkspaceSearchResultItem;
  query: string;
}

const LONG_PASSAGE_THRESHOLD = 240;

export function WorkspaceResultCard({ item, query }: WorkspaceResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.text.length > LONG_PASSAGE_THRESHOLD;

  const displayedText = isLong && !expanded
    ? `${item.text.slice(0, LONG_PASSAGE_THRESHOLD)}…`
    : item.text;

  return (
    <article className="p-4 sm:p-5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-raised)]/60 focus-within:bg-[var(--surface-raised)]/50 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] mb-2.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-sm font-mono font-bold text-xs bg-[#ff3d5a]/10 text-[var(--bl-accent-hot,#ff3d5a)] border border-[#ff3d5a]/30">
            #{item.rank}
          </span>
          <span className="font-mono uppercase text-xs font-medium px-2.5 py-0.5 rounded-sm bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)]">
            Score {item.score.toFixed(3)}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase">
          {item.page !== null && item.page !== undefined && (
            <span className="px-2 py-0.5 bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border)] rounded-sm">
              Page {item.page}
            </span>
          )}
          <span className="px-2 py-0.5 bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border)] rounded-sm">
            Passage #{item.passage_index + 1}
          </span>
        </div>
      </div>

      <h3 className="text-sm sm:text-base font-bold text-[var(--text)] leading-snug flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] shrink-0" aria-hidden="true" />
        <span className="tracking-wide">{item.document_name}</span>
      </h3>

      <div className="mt-2 text-xs sm:text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap font-sans">
        {highlightText(displayedText, query)}
      </div>

      {isLong && (
        <div className="mt-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-mono uppercase tracking-wider text-[var(--bl-accent-hot,#ff3d5a)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] rounded-sm py-1 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>{expanded ? 'Show less' : 'Show more'}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
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
        </div>
      )}
    </article>
  );
}
