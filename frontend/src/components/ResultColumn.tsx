import { onlyHereIds } from '../comparison';
import { ResultCard } from './ResultCard';
import type { DocumentRecord, SearchResponse } from '../api';

interface ResultColumnProps {
  title: string;
  response: SearchResponse | null;
  error: string | null;
  loading: boolean;
  other: SearchResponse | null;
  getDocument: (id: string) => Promise<DocumentRecord>;
}

export function ResultColumn({
  title,
  response,
  error,
  loading,
  other,
  getDocument,
}: ResultColumnProps) {
  const onlyIds = onlyHereIds(response, other);

  return (
    <section
      className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col"
      aria-busy={loading}
    >
      <header className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
          {title}
        </h2>
        {response && !loading && (
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {response.took_ms.toFixed(1)} ms
          </span>
        )}
      </header>

      <div className="divide-y divide-slate-100 flex-1">
        {loading && (
          <div className="p-4 space-y-4" aria-label={`Loading ${title} results`}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-slate-100 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 rounded skeleton-shimmer" />
                  <div className="h-4 w-16 rounded skeleton-shimmer" />
                </div>
                <div className="h-5 w-4/5 rounded skeleton-shimmer" />
                <div className="h-3 w-32 rounded skeleton-shimmer" />
                <div className="space-y-1.5 pt-1">
                  <div className="h-3.5 w-full rounded skeleton-shimmer" />
                  <div className="h-3.5 w-5/6 rounded skeleton-shimmer" />
                </div>
                <div className="flex gap-2 pt-1">
                  <div className="h-4 w-14 rounded skeleton-shimmer" />
                  <div className="h-4 w-14 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="p-6 text-center">
            <div
              className="p-4 rounded-lg bg-red-50 border border-red-200 text-left text-sm text-red-700"
              role="alert"
            >
              <p className="font-semibold text-red-800">Search Error</p>
              <p className="mt-1 leading-relaxed break-words">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && response && response.results.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm italic">
            No matching papers found for this query.
          </div>
        )}

        {!loading && !error && !response && (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            Enter a research query above to see ranked papers.
          </div>
        )}

        {!loading &&
          !error &&
          response &&
          response.results.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              onlyHere={onlyIds.has(item.id)}
              getDocument={getDocument}
            />
          ))}
      </div>
    </section>
  );
}
