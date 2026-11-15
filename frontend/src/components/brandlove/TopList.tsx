import type { SearchItem } from '../../api';

interface TopListProps {
  results: SearchItem[];
  activeRank: number | null;
  onHoverRank: (rank: number | null) => void;
  onSelectResult: (item: SearchItem) => void;
  title?: string;
}

export function TopList({
  results,
  activeRank,
  onHoverRank,
  onSelectResult,
  title = 'TOP 5 RELEVANT PAPERS',
}: TopListProps) {
  const top5 = results.slice(0, 5);

  if (top5.length === 0) return null;

  return (
    <div className="flex flex-col space-y-3 select-none text-left z-20">
      {/* Red Section Title */}
      <h3 className="text-[10px] sm:text-[11px] font-extrabold tracking-[0.24em] uppercase text-[var(--bl-accent-hot,#ff3d5a)]">
        {title}
      </h3>

      {/* Numbered List */}
      <ol className="space-y-1.5 sm:space-y-2">
        {top5.map((item) => {
          const isActive = activeRank === item.rank;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectResult(item)}
                onMouseEnter={() => onHoverRank(item.rank)}
                onFocus={() => onHoverRank(item.rank)}
                onMouseLeave={() => onHoverRank(null)}
                onBlur={() => onHoverRank(null)}
                className={`group flex items-center text-left text-[11px] sm:text-xs font-bold tracking-[0.16em] uppercase cursor-pointer transition-all duration-150 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] max-w-full truncate ${
                  isActive
                    ? 'text-[var(--text)] scale-[1.02]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
                title={`${item.title} — Click to view details`}
              >
                <span className="truncate max-w-[200px] sm:max-w-[260px] md:max-w-[300px]">
                  {item.rank}. {item.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
