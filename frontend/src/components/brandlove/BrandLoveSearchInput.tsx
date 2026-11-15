import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';

interface BrandLoveSearchInputProps {
  query: string;
  setQuery: (q: string) => void;
  onSubmit: (e?: FormEvent) => void;
  isSearching: boolean;
  tookMs?: number;
  corpusCount?: number;
}

export function BrandLoveSearchInput({
  query,
  setQuery,
  onSubmit,
  isSearching,
  tookMs,
  corpusCount = 30000,
}: BrandLoveSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-4xl mx-auto my-6 px-4 select-none"
      role="search"
    >
      <div className="relative flex items-center border-b-2 border-[var(--border)] focus-within:border-[var(--bl-accent-hot,#ff3d5a)] transition-colors pb-2">
        {/* Search icon or hot-accent marker */}
        <span
          className="mr-3 text-[var(--bl-accent-hot,#ff3d5a)] font-bold text-lg select-none"
          aria-hidden="true"
        >
          &gt;
        </span>

        {/* Underline Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`SEARCH ${corpusCount.toLocaleString()} ARXIV PAPERS BY MEANING... (PRESS '/' TO FOCUS)`}
          aria-label={`Search ${corpusCount.toLocaleString()} arXiv papers`}
          className="w-full bg-transparent text-[var(--text)] text-xs sm:text-sm md:text-base font-bold tracking-[0.18em] uppercase placeholder:text-[var(--text-muted)] placeholder:font-normal focus:outline-none"
        />

        {/* Clear button if text entered */}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear query text"
            className="p-1 mr-2 text-[var(--bl-text-dim,#8b9999)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Search / Submit button or Status */}
        <div className="flex items-center gap-2 shrink-0">
          {tookMs !== undefined && !isSearching && (
            <span className="hidden sm:inline-block font-mono text-[10px] text-[var(--bl-text-dim,#8b9999)] uppercase tracking-widest mr-2">
              {tookMs.toFixed(1)} MS
            </span>
          )}

          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase bg-[var(--bl-accent-hot,#ff3d5a)] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bl-accent-hot,#ff3d5a)]"
          >
            {isSearching ? 'SEARCHING...' : 'SEARCH'}
          </button>
        </div>
      </div>
    </form>
  );
}
