import { useState } from 'react';
import type { Health, Method } from '../../api';
import type { AppView, ResultCount } from '../../urlState';
import type { Theme } from '../../theme';
import { BrandLoveNavDrawer } from './BrandLoveNavDrawer';

interface BrandLoveHeaderProps {
  currentMethod: string;
  onSelectMethod: (methodId: string) => void;
  methods: Method[];
  activeQuery: string;
  view: AppView;
  onViewChange: (v: AppView) => void;
  k: ResultCount;
  onKChange: (k: ResultCount) => void;
  health: Health | null;
  theme: Theme;
  onToggleTheme: () => void;
  onHome: () => void;
}

export function BrandLoveHeader({
  currentMethod,
  onSelectMethod,
  methods,
  activeQuery,
  view,
  onViewChange,
  k,
  onKChange,
  health,
  theme,
  onToggleTheme,
  onHome,
}: BrandLoveHeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter available methods for the top center tabs (e.g. up to 4 major approaches)
  const tabMethods = methods.filter((m) => m.ready).slice(0, 4);

  return (
    <>
      <header className="relative flex items-center justify-between px-4 sm:px-8 py-5 select-none z-30 border-b border-[var(--border-subtle)]">
        {/* Brand Wordmark (Brand Love Score Style) */}
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] rounded p-1"
          aria-label="Semantic Search Engine — go to home page"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-[0.2em] uppercase text-[var(--text)]">
                SEMANTIC
              </span>
              <span
                className="w-2 h-2 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] shadow-[0_0_8px_rgba(255,61,90,0.8)] inline-block"
                aria-hidden="true"
              />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-[0.2em] uppercase text-[var(--text)] leading-none">
              SCORE
            </span>
          </div>
        </button>

        {/* Center Tabs with signature Red Underline on active tab */}
        {view === 'search' && tabMethods.length > 0 && (
          <nav
            aria-label="Retrieval approaches"
            className="hidden md:flex items-center gap-6 lg:gap-8"
          >
            {tabMethods.map((m) => {
              const isActive = currentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMethod(m.id)}
                  className={`relative py-1 text-xs font-bold tracking-[0.2em] uppercase transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)] rounded ${
                    isActive
                      ? 'text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <span>{m.display_name}</span>
                  {/* Red Underline Indicator */}
                  {isActive && (
                    <span
                      className="absolute left-0 bottom-0 w-full h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)] shadow-[0_0_8px_rgba(255,61,90,0.8)] animate-in fade-in duration-200"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right side: Query badge + Red Hamburger Button */}
        <div className="flex items-center gap-3 sm:gap-5">
          {activeQuery && (
            <span className="hidden sm:inline-block text-[11px] font-mono tracking-[0.2em] uppercase text-[var(--text-muted)] max-w-[180px] truncate">
              {activeQuery}
            </span>
          )}

          {/* Red Hamburger Menu Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open menu and settings"
            className="flex flex-col justify-center items-center gap-1 w-9 h-9 rounded-lg hover:bg-[var(--surface-raised)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)]"
          >
            <span className="w-5 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)] rounded-full transition-transform" />
            <span className="w-5 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)] rounded-full transition-transform" />
            <span className="w-5 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)] rounded-full transition-transform" />
          </button>
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
