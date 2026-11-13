import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Health, Method } from '../api';
import { EXAMPLE_QUERIES } from '../constants';
import type { ResultCount, SearchMode } from '../urlState';

interface SearchControlsProps {
  query: string;
  setQuery: (q: string) => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode, model: string) => void;
  left: string;
  setLeft: (m: string) => void;
  model: string;
  setModel: (m: string) => void;
  k: ResultCount;
  setK: (k: ResultCount) => void;
  methods: Method[];
  isSearching: boolean;
  settingsChanged: boolean;
  onSubmit: (event?: FormEvent, forcedQuery?: string) => void;
  health?: Health | null;
  children?: ReactNode;
}

export function SearchControls({
  query,
  setQuery,
  mode,
  onModeChange,
  model,
  setModel,
  left,
  setLeft,
  k,
  setK,
  methods,
  isSearching,
  settingsChanged,
  onSubmit,
  health,
  children,
}: SearchControlsProps) {
  const selectedMethod = methods.find((m) => m.id === model);
  const selectableMethods = methods;

  const handleModeChange = (newMode: SearchMode) => {
    if (newMode === mode) return;
    let nextModel = model;
    if (newMode === 'compare' && model === left) {
      nextModel = model === 'sbert-mpnet' ? 'tfidf' : 'sbert-mpnet';
    }
    onModeChange(newMode, nextModel);
  };

  const paperCount = health?.document_count
    ? `${health.document_count.toLocaleString()} papers`
    : '30,000 papers';
  const device = health?.embedding_device?.toUpperCase() ?? 'CUDA';

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Hero Section */}
      <section className="relative pt-4 sm:pt-8 text-center space-y-6 max-w-4xl mx-auto">
        {/* Status Announcement Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--surface-raised)] border border-[var(--border-accent)] text-[var(--text-muted)] shadow-xs">
          <span
            className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
            aria-hidden="true"
          />
          <span>
            {health
              ? `arXiv CS Corpus · ${paperCount} · ${device}`
              : 'arXiv CS Corpus · 30,000 papers · Neural Search'}
          </span>
        </div>

        {/* Fluid Oversized Headline */}
        <h1
          className="font-extrabold tracking-[-0.035em] text-[var(--text)] text-center leading-[1.08] max-w-3xl mx-auto"
          style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4.25rem)' }}
        >
          Search papers by meaning, not keywords.
        </h1>

        {/* Quieter Subtitle */}
        <p className="text-sm sm:text-base lg:text-lg text-[var(--text-muted)] text-center max-w-2xl mx-auto leading-relaxed">
          Describe what you are looking for in everyday language. We will find
          relevant computer-science papers for you.
        </p>

        {/* Pill Search Input Form */}
        <form onSubmit={(e) => onSubmit(e)} className="w-full max-w-2xl mx-auto pt-2">
          <label htmlFor="search-query-input" className="sr-only">
            Search 30,000 computer science research papers
          </label>
          <div className="relative flex items-center rounded-full bg-[var(--surface-raised)] border border-[var(--border)] p-1.5 sm:p-2 shadow-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-[var(--ring)] transition-all">
            <div
              className="pl-3.5 pr-2 text-[var(--text-muted)] pointer-events-none"
              aria-hidden="true"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              id="search-query-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter research keywords or natural-language question..."
              maxLength={500}
              className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-[var(--text)] placeholder-[var(--text-muted)] px-2 py-1.5 focus:outline-none"
            />
            <button
              type="submit"
              disabled={
                !query.trim() ||
                isSearching ||
                (mode === 'compare' && left === model)
              }
              className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[var(--hero-btn-bg)] text-[var(--hero-btn-fg)] shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer select-none"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {query.length > 400 && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]" aria-hidden="true">
              {query.length}/500 characters
            </p>
          )}
          <CharacterCounterAnnouncement length={query.length} />
        </form>

        {/* Example Queries */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Examples:
          </span>
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                onSubmit(undefined, example);
              }}
              className="px-3 py-1 text-xs rounded-full border border-[var(--border-subtle)] bg-[var(--pill-bg)] hover:bg-[var(--pill-hover-bg)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {/* Framed Window Panel */}
      <section className="relative rounded-2xl border border-[var(--border-accent)] bg-[var(--surface)] shadow-[0_0_50px_-12px_rgba(59,130,246,0.18)] overflow-hidden flex flex-col">
        {/* Dark Toolbar Row */}
        <header className="px-4 py-3 sm:px-6 sm:py-3.5 bg-[var(--surface-toolbar)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
          {/* Mode Switcher Tabs */}
          <div
            className="flex items-center p-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)]"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'compare'}
              onClick={() => handleModeChange('compare')}
              className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                mode === 'compare'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Compare approaches
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'search'}
              onClick={() => handleModeChange('search')}
              className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                mode === 'search'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              One approach
            </button>
          </div>

          {/* Controls: Method selectors & k-select */}
          <div className="flex flex-wrap items-center gap-3">
            {mode === 'compare' && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="left-select"
                  className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap"
                >
                  First approach:
                </label>
                <MethodSelect
                  id="left-select"
                  value={left}
                  methods={selectableMethods}
                  onChange={setLeft}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <label
                htmlFor="model-select"
                className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap"
              >
                {mode === 'compare' ? 'Second approach:' : 'Search approach:'}
              </label>
              <MethodSelect
                id="model-select"
                value={model}
                methods={selectableMethods}
                onChange={setModel}
              />
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="k-select"
                className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap"
              >
                Show:
              </label>
              <select
                id="k-select"
                value={k}
                onChange={(e) => setK(Number(e.target.value) as ResultCount)}
                className="text-xs rounded-lg px-2.5 py-1.5 bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
              >
                <option value={5}>5 results</option>
                <option value={10}>10 results</option>
                <option value={20}>20 results</option>
              </select>
            </div>
          </div>
        </header>

        {/* Inline Alerts & Hints in Window */}
        <div className="px-4 sm:px-6 py-3 bg-[var(--surface-toolbar)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] leading-relaxed">
          <p>
            {mode === 'compare'
              ? 'Compare two ways of finding papers. Look at which papers each approach surfaces; their score numbers are calculated differently.'
              : 'Choose how the search should understand your words. “Meaning match” is a good place to start.'}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
              What do these approaches mean?
            </summary>
            <ul className="mt-1.5 pl-4 list-disc space-y-1">
              <li><strong>Exact wording match</strong> finds papers using the same important words.</li>
              <li><strong>Meaning match</strong> can find related papers even when they use different wording.</li>
              <li><strong>Combined match</strong> uses both approaches.</li>
              <li><strong>Extra review</strong> takes longer but rechecks the best matches.</li>
            </ul>
          </details>
        </div>

        {mode === 'search' && selectedMethod && (
          <div className="px-4 sm:px-6 py-3 bg-[var(--surface-toolbar)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] space-y-1.5 leading-relaxed">
            <p>{methodExplanation(selectedMethod)}</p>
            {selectedMethod.benchmarks && selectedMethod.benchmarks.length > 0 && (
              <>
                <p className="font-mono text-[var(--text)]">
                  Benchmark nDCG@10:{' '}
                  {selectedMethod.benchmarks
                    .map(
                      (b) =>
                        `${b.dataset === 'scifact' ? 'SciFact' : b.dataset === 'fiqa' ? 'FiQA' : b.dataset} ${b.ndcg_at_10.toFixed(3)}`
                    )
                    .join(', ')}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Benchmark results on SciFact and FiQA, not measured on this arXiv corpus; see Evaluation.
                </p>
              </>
            )}
            {selectedMethod.kind === 'reranked' && (
              <p className="text-blue-600 dark:text-blue-400 font-medium">
                This option takes longer because it reviews the top 100 matches a second time.
              </p>
            )}
          </div>
        )}

        {mode === 'compare' && left === model && (
          <div
            className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2"
            role="status"
          >
            <span aria-hidden="true">⚠️</span>
            <span>Choose two different methods to compare.</span>
          </div>
        )}

        {selectedMethod && !selectedMethod.ready && (
          <div
            className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2"
            role="status"
          >
            <span aria-hidden="true">⚠️</span>
            <span>
              {selectedMethod.unavailable_reason ?? 'This method is unavailable.'}
            </span>
          </div>
        )}

        {settingsChanged && (
          <div
            className="px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2"
            role="status"
          >
            <span aria-hidden="true">ℹ️</span>
            <span>Choices changed — select Search to update the results.</span>
          </div>
        )}

        {/* Window Content / Results */}
        <div className="p-4 sm:p-6 space-y-6">{children}</div>
      </section>
    </div>
  );
}

function MethodSelect({
  id,
  value,
  methods,
  onChange,
}: {
  id: string;
  value: string;
  methods: Method[];
  onChange: (value: string) => void;
}) {
  const groups: Array<[Method['kind'], string]> = [
    ['keyword', 'Match the same words'],
    ['semantic', 'Match the meaning'],
    ['hybrid', 'Use words and meaning'],
    ['reranked', 'Review the best matches again'],
  ];

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="text-xs rounded-lg px-2.5 py-1.5 bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer max-w-[210px] truncate"
    >
      {groups.map(([kind, label]) => {
        const items = methods.filter((method) => method.kind === kind);
        return items.length ? (
          <optgroup key={kind} label={label}>
            {items.map((method) => (
              <option
                key={method.id}
                value={method.id}
                disabled={!method.ready}
              >
                {methodChoiceLabel(method)}
                {!method.ready
                  ? ` (${method.unavailable_reason ?? 'unavailable'})`
                  : ''}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

function methodChoiceLabel(method: Method): string {
  const labels: Record<string, string> = {
    tfidf: 'Exact wording match (simple)',
    bm25: 'Exact wording match (stronger)',
    'sbert-minilm': 'Meaning match (faster)',
    'sbert-mpnet': 'Meaning match (recommended)',
    'hybrid-mpnet': 'Combined wording + meaning match',
    'rerank-mpnet': 'Extra review of the best matches',
  };
  return labels[method.id] ?? method.display_name;
}

function methodExplanation(method: Method): string {
  const explanations: Record<string, string> = {
    tfidf: 'Matches important words in your search with important words in each paper. It is simple and fast.',
    bm25: 'Looks for the important words from your search and gives more weight to the most useful matches.',
    'sbert-minilm': 'Looks for papers with a similar meaning, even if they use different words. This is the faster meaning-based option.',
    'sbert-mpnet': 'Looks for papers with a similar meaning, even if they use different words. This is a good default for most searches.',
    'hybrid-mpnet': 'Combines word matching and meaning matching, so it can catch papers that either approach would find.',
    'rerank-mpnet': 'Finds meaning-based matches first, then carefully reviews the strongest candidates to improve their order.',
  };
  return explanations[method.id] ?? method.description;
}

function CharacterCounterAnnouncement({ length }: { length: number }) {
  const [announcement, setAnnouncement] = useState('');
  const wasOverThreshold = useRef(length > 400);

  useEffect(() => {
    const isOverThreshold = length > 400;
    if (isOverThreshold !== wasOverThreshold.current) {
      setAnnouncement(
        isOverThreshold
          ? `Query is ${length} of 500 characters.`
          : 'Query is below 401 characters.'
      );
      wasOverThreshold.current = isOverThreshold;
    }
  }, [length]);

  return <span className="sr-only" aria-live="polite">{announcement}</span>;
}
