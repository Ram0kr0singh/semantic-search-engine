import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Health, Method } from '../api';
import { EXAMPLE_QUERIES } from '../constants';
import type { ResultCount, SearchMode } from '../urlState';
import { TypewriterHeading } from './brandlove/TypewriterHeading';

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

  const corpusSize = health?.corpus_size ?? health?.document_count;
  const categories = health?.categories ?? [];
  const subject = categories.some((category) => category.startsWith('stat.'))
    ? 'computer science and statistics'
    : categories.length
      ? 'computer science'
      : 'arXiv research';
  const shownCategories = categories.slice(0, 5);
  const categoryDescription = categories.length
    ? ` (${shownCategories.join(', ')}${categories.length > shownCategories.length ? ` and ${categories.length - shownCategories.length} more` : ''})`
    : '';
  const corpusDescription = corpusSize === undefined
    ? 'Sample of arXiv papers'
    : `Sample of ${corpusSize.toLocaleString()} arXiv papers in ${subject}${categoryDescription}`;
  const device = health?.embedding_device?.toUpperCase() ?? 'CUDA';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Brand Love Score Minimalist Search Bar & Header */}
      <section className="relative pt-2 text-center space-y-4 max-w-4xl mx-auto">
        <TypewriterHeading
          lines={['Search papers by meaning,', 'not keywords']}
          accessibleTitle="Search papers by meaning, not keywords"
          className="font-extrabold uppercase tracking-[0.2em] text-[var(--text)] text-center leading-[1.1] focus:outline-none"
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}
        />
        <p className="text-xs sm:text-sm uppercase tracking-wide text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed font-sans">
          Describe what you are looking for in everyday language. We will find
          relevant {subject} papers for you.
        </p>

        {/* Subtle Top Metadata */}
        <div className="flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-[0.12em] text-[var(--text-muted)]">
          <span
            className="w-1.5 h-1.5 shrink-0 self-center rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] shadow-[0_0_8px_rgba(255,61,90,0.8)]"
            aria-hidden="true"
          />
          <span className="text-center leading-relaxed">
            {health
              ? `${corpusDescription} · ${device}`
              : 'ARXIV PAPER CORPUS · NEURAL SEARCH'}
          </span>
        </div>

        {/* Minimal Wide Brand Love Search Input Form */}
        <form onSubmit={(e) => onSubmit(e)} className="w-full max-w-3xl mx-auto">
          <label htmlFor="search-query-input" className="sr-only">
            {corpusSize === undefined
              ? 'Search arXiv papers'
              : `Search ${corpusSize.toLocaleString()} arXiv papers`}
          </label>
          <div className="relative flex items-center bg-[var(--surface)] border border-[var(--border)] focus-within:border-[var(--bl-accent-hot,#ff3d5a)] focus-within:shadow-[0_0_20px_rgba(255,61,90,0.2)] rounded-sm p-1.5 sm:p-2 transition-all">
            <div
              className="pl-3 pr-2 font-mono font-bold text-sm text-[var(--bl-accent-hot,#ff3d5a)] pointer-events-none select-none"
              aria-hidden="true"
            >
              &gt;
            </div>
            <input
              id="search-query-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ENTER RESEARCH KEYWORDS OR NATURAL-LANGUAGE QUESTION..."
              maxLength={500}
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-mono tracking-wide text-[var(--text)] placeholder-[var(--text-muted)] px-2 py-1.5 focus:outline-none uppercase"
            />
            <div className="hidden sm:flex items-center px-2 font-mono text-[10px] text-[var(--text-muted)] select-none">
              [/]
            </div>
            <button
              type="submit"
              disabled={
                !query.trim() ||
                isSearching ||
                (mode === 'compare' && left === model)
              }
              className="px-5 sm:px-6 py-2 rounded-sm text-xs font-bold uppercase tracking-[0.15em] bg-[var(--bl-accent-hot,#ff3d5a)] text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer select-none"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {query.length > 400 && (
            <p className="mt-1.5 text-xs font-mono text-[var(--bl-accent-hot,#ff3d5a)]" aria-hidden="true">
              {query.length}/500 characters
            </p>
          )}
          <CharacterCounterAnnouncement length={query.length} />
        </form>

        {/* Minimal Example Queries */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-1 text-xs">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)]">
            EXAMPLES:
          </span>
          {EXAMPLE_QUERIES.map((example, idx) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                onSubmit(undefined, example);
              }}
              className="font-mono text-[11px] tracking-wide text-[var(--text-muted)] hover:text-[var(--bl-accent-hot,#ff3d5a)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] uppercase"
            >
              {example}
              {idx < EXAMPLE_QUERIES.length - 1 && (
                <span className="ml-3 text-[var(--border)] select-none">//</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Brand Love Score Controls & Visualization Panel */}
      <section className="relative rounded-sm border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden flex flex-col">
        {/* Minimal Toolbar Row */}
        <header className="px-4 py-3 sm:px-6 bg-[var(--surface-toolbar)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
          {/* Mode Switcher Tabs with Red Underline */}
          <div
            className="flex items-center gap-5 sm:gap-7"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'search'}
              onClick={() => handleModeChange('search')}
              className={`relative py-1 text-xs font-semibold uppercase tracking-[0.2em] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                mode === 'search'
                  ? 'text-[var(--text)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              One approach
              {mode === 'search' && (
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)]" />
              )}
            </button>
            <span className="text-[var(--border)] select-none text-xs font-light">|</span>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'compare'}
              onClick={() => handleModeChange('compare')}
              className={`relative py-1 text-xs font-semibold uppercase tracking-[0.2em] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                mode === 'compare'
                  ? 'text-[var(--text)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Compare approaches
              {mode === 'compare' && (
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--bl-accent-hot,#ff3d5a)]" />
              )}
            </button>
          </div>

          {/* Controls: Method selectors & k-select */}
          <div className="flex flex-wrap items-center gap-3">
            {mode === 'compare' && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="left-select"
                  className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap"
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
                className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap"
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
                className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap"
              >
                Show:
              </label>
              <select
                id="k-select"
                value={k}
                onChange={(e) => setK(Number(e.target.value) as ResultCount)}
                className="text-xs font-mono uppercase rounded-sm px-2.5 py-1.5 bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] cursor-pointer"
              >
                <option value={5}>5 results</option>
                <option value={10}>10 results</option>
                <option value={20}>20 results</option>
              </select>
            </div>
          </div>
        </header>

        {/* Inline Alerts & Hints in Window */}
        <div className="px-4 sm:px-6 py-2.5 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] leading-relaxed">
          <p>
            {mode === 'compare'
              ? 'Compare two ways of finding papers. Look at which papers each approach surfaces; their score numbers are calculated differently.'
              : 'Choose how the search should understand your words. “Meaning match” is a good place to start.'}
          </p>
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[var(--bl-accent-hot,#ff3d5a)] font-mono text-xs uppercase tracking-wider">
              What do these approaches mean?
            </summary>
            <ul className="mt-1.5 pl-4 list-disc space-y-1 text-xs">
              <li><strong>Exact wording match</strong> finds papers using the same important words.</li>
              <li><strong>Meaning match</strong> can find related papers even when they use different wording.</li>
              <li><strong>Combined match</strong> uses both approaches.</li>
              <li><strong>Re-ranked</strong> takes longer and rechecks the top matches with a second model.</li>
            </ul>
          </details>
        </div>

        {mode === 'search' && selectedMethod && (
          <div className="px-4 sm:px-6 py-2.5 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] space-y-1.5 leading-relaxed">
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
              <p className="text-[var(--bl-accent-hot,#ff3d5a)] font-medium">
                This option takes longer because it reviews the top 100 matches a second time.
              </p>
            )}
          </div>
        )}

        {mode === 'compare' && left === model && (
          <div
            className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400 font-medium flex items-center gap-2"
            role="status"
          >
            <span aria-hidden="true">⚠️</span>
            <span>Choose two different methods to compare.</span>
          </div>
        )}

        {selectedMethod && !selectedMethod.ready && (
          <div
            className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400 font-medium flex items-center gap-2"
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
            className="px-4 py-2 bg-[#ff3d5a]/10 border-b border-[#ff3d5a]/20 text-xs text-[var(--bl-accent-hot,#ff3d5a)] font-medium flex items-center gap-2"
            role="status"
          >
            <span aria-hidden="true">ℹ️</span>
            <span>Choices changed — select Search to update the results.</span>
          </div>
        )}

        {/* Window Content / Results (Curve Chart or Compare Columns) */}
        <div className="p-3 sm:p-5 space-y-6">{children}</div>
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
    ['reranked', 'Re-rank with a second model'],
  ];

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="text-xs font-mono uppercase rounded-sm px-2.5 py-1.5 bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] cursor-pointer max-w-[210px] truncate"
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
    'rerank-mpnet': 'Re-ranked (slower, experimental)',
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
    'rerank-mpnet': 'Re-checks the top matches with a second model. It can improve or worsen the order depending on the documents.',
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
