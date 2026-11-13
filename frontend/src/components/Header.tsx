import type { Health } from '../api';
import type { AppView } from '../urlState';
import type { Theme } from '../theme';

interface HeaderProps {
  health: Health | null;
  view: AppView;
  onViewChange: (view: AppView) => void;
  onHome: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({
  health,
  view,
  onViewChange,
  onHome,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const device = health?.embedding_device?.toUpperCase() ?? 'CPU';
  const paperCount = health?.document_count
    ? `${health.document_count.toLocaleString()} papers`
    : 'Corpus';

  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
      {/* Brand Wordmark */}
      <button
        type="button"
        onClick={onHome}
        className="flex items-center gap-2.5 text-left cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label="arXiv Research Semantic Search Engine — go to home page"
      >
        <span
          className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
          aria-hidden="true"
        />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-widest uppercase text-blue-500">
            arXiv Research
          </span>
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--text)] leading-tight">
            Semantic Search Engine
          </span>
        </div>
      </button>

      {/* Search is the main destination; comparison details live in the clearer
          controls below the search box. */}
      <nav
        className="flex items-center self-start md:self-center"
        aria-label="Application views"
      >
        <div className="flex items-center p-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] shadow-xs">
          <button
            type="button"
            onClick={() => onViewChange('search')}
            aria-current={view === 'search' ? 'page' : undefined}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              view === 'search'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs border border-[var(--border)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => onViewChange('eval')}
            aria-current={view === 'eval' ? 'page' : undefined}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              view === 'eval'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs border border-[var(--border)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Evaluation
          </button>
        </div>
      </nav>

      {/* Right controls: Health pill & Theme toggle */}
      <div className="flex items-center gap-2.5 self-start md:self-auto">
        <div
          className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-full shadow-xs"
          aria-live="polite"
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              health
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                : 'bg-amber-400 animate-pulse'
            }`}
            aria-hidden="true"
          />
          <span>
            {health
              ? `Online · ${paperCount} · ${device}`
              : 'Connecting to API…'}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
          aria-pressed={theme === 'dark'}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface-raised)] hover:bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
          title={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
        >
          {theme === 'dark' ? (
            <svg
              className="w-4 h-4 text-amber-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-slate-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
