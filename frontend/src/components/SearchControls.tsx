import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Method } from '../api';
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
}: SearchControlsProps) {
  const selectedMethod = methods.find((m) => m.id === model);

  const selectableMethods = methods;

  const handleModeChange = (newMode: SearchMode) => {
    if (newMode === mode) return;
    let nextModel = model;
    if (newMode === 'compare' && model === left) nextModel = model === 'sbert-mpnet' ? 'tfidf' : 'sbert-mpnet';
    onModeChange(newMode, nextModel);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
      {/* Mode toggle tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'compare'}
          onClick={() => handleModeChange('compare')}
          className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer ${
            mode === 'compare'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Compare
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'search'}
          onClick={() => handleModeChange('search')}
          className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer ${
            mode === 'search'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Search
        </button>
      </div>

      {/* Main search form */}
      <form onSubmit={(e) => onSubmit(e)} className="space-y-4">
        <div>
          <label
            htmlFor="search-query-input"
            className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5"
          >
            Search 30,000 computer science research papers
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="search-query-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter research keywords or natural-language question..."
              maxLength={500}
              className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600"
            />
            <button
              type="submit"
              disabled={!query.trim() || isSearching || (mode === 'compare' && left === model)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {query.length > 400 && <p className="mt-1 text-xs text-slate-500" aria-hidden="true">{query.length}/500 characters</p>}
          <CharacterCounterAnnouncement length={query.length} />
        </div>

        {/* Configuration selectors */}
        <div className="flex flex-wrap items-end gap-4 pt-1">
          {mode === 'compare' && <div>
            <label htmlFor="left-select" className="block text-xs font-semibold text-slate-700 mb-1">Left method:</label>
            <MethodSelect id="left-select" value={left} methods={selectableMethods} onChange={setLeft} />
          </div>}
          <div>
            <label
              htmlFor="model-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              {mode === 'compare' ? 'Right method:' : 'Retrieval Method:'}
            </label>
            <MethodSelect id="model-select" value={model} methods={selectableMethods} onChange={setModel} />
          </div>

          <div>
            <label
              htmlFor="k-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Results (k):
            </label>
            <select
              id="k-select"
              value={k}
              onChange={(e) => setK(Number(e.target.value) as ResultCount)}
              className="text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-800 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
            >
              <option value={5}>5 results</option>
              <option value={10}>10 results</option>
              <option value={20}>20 results</option>
            </select>
          </div>

          {mode === 'compare' && left === model && <p className="text-xs text-amber-700" role="status">Choose two different methods to compare.</p>}
          {selectedMethod && !selectedMethod.ready && (
            <p className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
              {selectedMethod.unavailable_reason ?? 'This method is unavailable.'}
            </p>
          )}
          {settingsChanged && <p className="text-xs text-slate-500" role="status">Settings changed, press Search to update.</p>}
        </div>
      </form>

      {/* Example queries */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span className="font-medium mr-1 text-slate-600">Examples:</span>
        {EXAMPLE_QUERIES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuery(example);
              onSubmit(undefined, example);
            }}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-blue-700 border border-slate-200 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}

function MethodSelect({ id, value, methods, onChange }: { id: string; value: string; methods: Method[]; onChange: (value: string) => void }) {
  const groups: Array<[Method['kind'], string]> = [['keyword', 'Keyword'], ['semantic', 'Semantic'], ['hybrid', 'Hybrid'], ['reranked', 'Reranked']];
  return <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-800 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer">
    {groups.map(([kind, label]) => { const items = methods.filter((method) => method.kind === kind); return items.length ? <optgroup key={kind} label={label}>{items.map((method) => <option key={method.id} value={method.id} disabled={!method.ready}>{method.display_name}{!method.ready ? ` (${method.unavailable_reason ?? 'unavailable'})` : ''}</option>)}</optgroup> : null; })}
  </select>;
}

function CharacterCounterAnnouncement({ length }: { length: number }) {
  const [announcement, setAnnouncement] = useState('');
  const wasOverThreshold = useRef(length > 400);
  useEffect(() => {
    const isOverThreshold = length > 400;
    if (isOverThreshold !== wasOverThreshold.current) {
      setAnnouncement(isOverThreshold ? `Query is ${length} of 500 characters.` : 'Query is below 401 characters.');
      wasOverThreshold.current = isOverThreshold;
    }
  }, [length]);
  return <span className="sr-only" aria-live="polite">{announcement}</span>;
}
