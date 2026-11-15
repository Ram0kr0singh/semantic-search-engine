interface ControlBarProps {
  viewMode: 'curve' | 'list';
  onToggleViewMode: (mode: 'curve' | 'list') => void;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  hasResults: boolean;
}

export function ControlBar({
  viewMode,
  onToggleViewMode,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  hasResults,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-center py-4 select-none">
      <div
        className="flex items-center gap-4 sm:gap-6 px-5 py-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-2xl backdrop-blur-md"
        role="toolbar"
        aria-label="Result display controls"
      >
        {/* Previous Page Chevron */}
        <button
          type="button"
          onClick={onPrevPage}
          disabled={!hasResults || page <= 1}
          aria-label="Previous page of results"
          className="p-1 text-[var(--bl-accent-hot,#ff3d5a)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] rounded"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* View Toggle Label & Icons */}
        <div className="flex items-center gap-3 border-x border-[var(--bl-border-subtle,rgba(255,255,255,0.06))] px-4">
          <span className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[var(--bl-text-dim,#8b9999)]">
            VIEW:
          </span>

          {/* Curve View Icon */}
          <button
            type="button"
            onClick={() => onToggleViewMode('curve')}
            aria-pressed={viewMode === 'curve'}
            aria-label="Switch to curve visualization view"
            title="Curve View"
            className={`p-1.5 rounded transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] ${
              viewMode === 'curve'
                ? 'text-[var(--bl-accent-hot,#ff3d5a)] scale-110 drop-shadow-[0_0_6px_rgba(255,61,90,0.6)]'
                : 'text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)]'
            }`}
          >
            {/* Bell Curve Icon */}
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
              <path d="M2 20h20" />
              <path d="M4 20c3-1 5-14 8-14s5 13 8 14" />
            </svg>
          </button>

          {/* Divider hairline */}
          <span className="w-px h-3.5 bg-[var(--bl-border,rgba(255,255,255,0.12))]" aria-hidden="true" />

          {/* List View Icon */}
          <button
            type="button"
            onClick={() => onToggleViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label="Switch to list view"
            title="List View"
            className={`p-1.5 rounded transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] ${
              viewMode === 'list'
                ? 'text-[var(--bl-accent-hot,#ff3d5a)] scale-110 drop-shadow-[0_0_6px_rgba(255,61,90,0.6)]'
                : 'text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)]'
            }`}
          >
            {/* List Icon */}
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
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>

        {/* Next Page Chevron */}
        <button
          type="button"
          onClick={onNextPage}
          disabled={!hasResults || page >= totalPages}
          aria-label="Next page of results"
          className="p-1 text-[var(--bl-accent-hot,#ff3d5a)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] rounded"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
