import { useState } from 'react';
import type { Health, Method } from '../api';
import type { AppView, ResultCount } from '../urlState';
import type { Theme } from '../theme';
import { BrandLoveNavDrawer } from './brandlove/BrandLoveNavDrawer';

interface HeaderProps {
  health: Health | null;
  view: AppView;
  onViewChange: (view: AppView) => void;
  onHome: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  methods?: Method[];
  currentMethod?: string;
  onSelectMethod?: (m: string) => void;
  k?: ResultCount;
  onKChange?: (k: ResultCount) => void;
}

export function Header({
  health,
  view,
  onViewChange,
  onHome,
  theme,
  onToggleTheme,
  methods = [],
  currentMethod = 'sbert-mpnet',
  onSelectMethod = () => {},
  k = 10,
  onKChange = () => {},
}: HeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const device = health?.embedding_device?.toUpperCase() ?? 'CPU';
  const corpusSize = health?.corpus_size ?? health?.document_count;
  const paperCount = corpusSize !== undefined
    ? `${corpusSize.toLocaleString()} papers`
    : 'Corpus';

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[var(--canvas)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-3.5 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Brand Wordmark (Brand Love Score Style) */}
          <button
            type="button"
            onClick={onHome}
            className="flex items-center gap-2.5 text-left cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="arXiv Research Semantic Search Engine — go to home page"
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] shadow-[0_0_10px_rgba(255,61,90,0.8)]"
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--bl-accent-hot,#ff3d5a)]">
                arXiv Research
              </span>
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--text)] leading-tight">
                Semantic Search Engine
              </span>
            </div>
          </button>

          {/* Navigation views with Brand Love Red Underline on active item */}
          <nav
            className="flex items-center self-start md:self-center"
            aria-label="Application views"
          >
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => onViewChange('search')}
                aria-current={view === 'search' || view === 'compare' ? 'page' : undefined}
                className={`relative py-1 text-xs font-semibold uppercase tracking-[0.2em] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  view === 'search' || view === 'compare'
                    ? 'text-[var(--text)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Search
                {(view === 'search' || view === 'compare') && (
                  <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)]" />
                )}
              </button>
              <span className="text-[var(--border)] select-none text-xs font-light">|</span>
              <button
                type="button"
                onClick={() => onViewChange('documents')}
                aria-current={view === 'documents' ? 'page' : undefined}
                className={`relative py-1 text-xs font-semibold uppercase tracking-[0.2em] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  view === 'documents'
                    ? 'text-[var(--text)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Your documents
                {view === 'documents' && (
                  <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)]" />
                )}
              </button>
              <span className="text-[var(--border)] select-none text-xs font-light">|</span>
              <button
                type="button"
                onClick={() => onViewChange('eval')}
                aria-current={view === 'eval' ? 'page' : undefined}
                className={`relative py-1 text-xs font-semibold uppercase tracking-[0.2em] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  view === 'eval'
                    ? 'text-[var(--text)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Evaluation
                {view === 'eval' && (
                  <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)]" />
                )}
              </button>
            </div>
          </nav>

          {/* Right controls: Health pill, Theme toggle & Red Hamburger Menu */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div
              className="flex items-center gap-2 text-[11px] font-mono tracking-wider text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border)] px-3 py-1.5 rounded-sm shadow-xs"
              aria-live="polite"
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  health
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
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

            {/* Red Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open menu and settings"
              className="flex flex-col justify-center items-center gap-1 w-8 h-8 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:bg-[var(--surface)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="w-4 h-[1.5px] bg-[var(--bl-accent-hot,#ff3d5a)] rounded-full" />
              <span className="w-4 h-[1.5px] bg-[var(--bl-accent-hot,#ff3d5a)] rounded-full" />
              <span className="w-4 h-[1.5px] bg-[var(--bl-accent-hot,#ff3d5a)] rounded-full" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation & Settings Drawer */}
      <BrandLoveNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        view={view}
        onViewChange={onViewChange}
        k={k}
        onKChange={onKChange}
        health={health}
        methods={methods}
        selectedModel={currentMethod}
        onSelectModel={onSelectMethod}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </>
  );
}
