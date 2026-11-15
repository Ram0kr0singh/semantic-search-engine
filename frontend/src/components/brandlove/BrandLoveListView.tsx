import type { SearchItem } from '../../api';
import { interpolateRankColor } from './curveMath';

interface BrandLoveListViewProps {
  results: SearchItem[];
  onSelectResult: (item: SearchItem) => void;
  activeRank: number | null;
  onHoverRank: (rank: number | null) => void;
  isReranked?: boolean;
}

export function BrandLoveListView({
  results,
  onSelectResult,
  activeRank,
  onHoverRank,
  isReranked = false,
}: BrandLoveListViewProps) {
  if (results.length === 0) {
    return (
      <div className="p-8 text-center text-xs tracking-widest uppercase text-[var(--bl-text-dim,#8b9999)] font-mono">
        No results available for list view.
      </div>
    );
  }

  return (
    <div
      role="feed"
      aria-label="Semantic search results list"
      className="w-full max-w-4xl mx-auto divide-y divide-[var(--border-subtle)] py-4"
    >
      {results.map((item) => {
        const color = interpolateRankColor(item.rank, results.length);
        const isActive = activeRank === item.rank;

        return (
          <article
            key={item.id}
            tabIndex={0}
            role="article"
            aria-labelledby={`result-title-${item.id}`}
            onClick={() => onSelectResult(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectResult(item);
              }
            }}
            onMouseEnter={() => onHoverRank(item.rank)}
            onFocus={() => onHoverRank(item.rank)}
            onMouseLeave={() => onHoverRank(null)}
            onBlur={() => onHoverRank(null)}
            className={`p-4 sm:p-5 transition-all duration-150 cursor-pointer rounded-xl my-1 flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] ${
              isActive
                ? 'bg-[var(--surface-raised)] border-l-4'
                : 'hover:bg-[var(--surface-raised)]/60'
            }`}
            style={{
              borderLeftColor: isActive ? color : 'transparent',
            }}
          >
            <div className="flex-1 space-y-1.5 min-w-0 pr-4">
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-xs font-black tracking-wider px-2 py-0.5 rounded"
                  style={{ color, backgroundColor: `${color}15` }}
                >
                  #{item.rank < 10 ? `0${item.rank}` : item.rank}
                </span>

                <h4
                  id={`result-title-${item.id}`}
                  className="text-xs sm:text-sm font-bold text-[var(--text)] truncate"
                >
                  {item.title}
                </h4>
              </div>

              <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                {item.snippet}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-[var(--text-muted)] uppercase">
                {item.year && <span>{item.year}</span>}
                {item.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-1.5 py-0.2 rounded border border-[var(--border-subtle)]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3 sm:self-center">
              <div className="text-right">
                <span className="text-xs font-mono text-[var(--text-muted)] block" title={isReranked ? 'Higher is better. Only comparable within this list' : undefined}>
                  {isReranked ? 'Relevance score' : 'Score'}
                </span>
                <span
                  className="text-xs sm:text-sm font-mono font-bold"
                  style={{ color }}
                >
                  {item.score.toFixed(3)}
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectResult(item);
                }}
                className="text-[10px] uppercase tracking-widest font-extrabold px-3 py-1.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--bl-accent-hot,#ff3d5a)] transition-colors cursor-pointer"
              >
                DETAILS
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
