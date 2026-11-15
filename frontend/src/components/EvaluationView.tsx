import { useEffect, useState, useMemo } from 'react';
import { api, type EvaluationResponse, type EvaluationRun } from '../api';
import {
  evaluationLabel,
  evaluationMethodOrder,
  isBestMetric,
  selectedBm25Weight,
  type MetricDirection,
} from '../evaluation';
import { RecallLineChart } from './evaluation/RecallLineChart';

const columns: Array<
  [keyof EvaluationRun, string, (value: number | null) => string, MetricDirection]
> = [
  ['ndcg_at_10', 'nDCG@10', (v) => (v ?? 0).toFixed(4), 'higher'],
  ['mrr_at_10', 'MRR@10', (v) => (v ?? 0).toFixed(4), 'higher'],
  ['recall_at_1', 'Recall@1', (v) => (v ?? 0).toFixed(4), 'higher'],
  ['recall_at_10', 'Recall@10', (v) => (v ?? 0).toFixed(4), 'higher'],
  ['recall_at_100', 'Recall@100', (v) => (v ?? 0).toFixed(4), 'higher'],
  [
    'index_build_seconds',
    'Index build',
    (v) => `${(v ?? 0).toFixed(2)} s`,
    'lower',
  ],
  [
    'average_query_latency_ms',
    'Query latency',
    (v) => (v === null ? '—' : `${v.toFixed(2)} ms`),
    'lower',
  ],
];

const datasetNames: Record<string, string> = {
  scifact: 'SciFact',
  fiqa: 'FiQA',
};

type MetricKey =
  | 'both'
  | 'ndcg_at_10'
  | 'recall_at_100'
  | 'mrr_at_10'
  | 'recall_at_1'
  | 'recall_at_10';

interface Kpis {
  bestNdcgRun: EvaluationRun | null;
  bestRecallRun: EvaluationRun | null;
  fastestRun: EvaluationRun | null;
}

function computeKpis(runs: EvaluationRun[]): Kpis {
  let bestNdcgRun: EvaluationRun | null = null;
  let maxNdcg = -Infinity;

  let bestRecallRun: EvaluationRun | null = null;
  let maxRecall = -Infinity;

  let fastestRun: EvaluationRun | null = null;
  let minLatency = Infinity;

  for (const r of runs) {
    if (typeof r.ndcg_at_10 === 'number' && r.ndcg_at_10 > maxNdcg) {
      maxNdcg = r.ndcg_at_10;
      bestNdcgRun = r;
    }
    if (typeof r.recall_at_100 === 'number' && r.recall_at_100 > maxRecall) {
      maxRecall = r.recall_at_100;
      bestRecallRun = r;
    }
    if (
      typeof r.average_query_latency_ms === 'number' &&
      r.average_query_latency_ms > 0 &&
      r.average_query_latency_ms < minLatency
    ) {
      minLatency = r.average_query_latency_ms;
      fastestRun = r;
    }
  }

  return { bestNdcgRun, bestRecallRun, fastestRun };
}

function RunLabel({ run }: { run: EvaluationRun }) {
  const weight = selectedBm25Weight(run);
  return (
    <>
      <span className="evaluation-name">{evaluationLabel(run)}</span>
      {weight !== null && (
        <span className="block text-[10px] text-[var(--text-muted)] font-normal">
          w = {weight}
        </span>
      )}
    </>
  );
}

interface ChartProps {
  runs: EvaluationRun[];
  metricFilter: MetricKey;
  baselineMethod: 'bm25' | 'tfidf';
  hoveredMethod: string | null;
  onHoverMethod: (method: string | null) => void;
}

function Chart({
  runs,
  metricFilter,
  baselineMethod,
  hoveredMethod,
  onHoverMethod,
}: ChartProps) {
  const activeMetrics: Array<
    'ndcg_at_10' | 'recall_at_100' | 'mrr_at_10' | 'recall_at_1' | 'recall_at_10'
  > =
    metricFilter === 'both'
      ? ['ndcg_at_10', 'recall_at_100']
      : [metricFilter];

  const baselineRun =
    runs.find((r) => r.method === baselineMethod) ??
    runs.find((r) => r.method === 'bm25') ??
    runs[0];

  return (
    <div
      className="space-y-3 pt-2"
      role="img"
      aria-label={`nDCG at 10 and Recall at 100 comparison for ${runs[0]?.dataset ?? 'dataset'}`}
    >
      {runs.map((run) => {
        const label = evaluationLabel(run);
        const isHovered = hoveredMethod === label;
        const isBaseline =
          Boolean(baselineRun) &&
          run.method === baselineRun?.method &&
          run.model === baselineRun?.model;

        return (
          <div
            key={label}
            className={`p-3 rounded-xl border transition-all text-xs font-mono ${
              isHovered
                ? 'bg-[var(--surface-raised)] border-[var(--bl-accent-hot,#ff3d5a)]/40 shadow-md ring-1 ring-[var(--bl-accent-hot,#ff3d5a)]/20'
                : 'bg-[var(--surface-raised)]/30 border-[var(--border-subtle)] hover:bg-[var(--surface-raised)]/60'
            }`}
            onMouseEnter={() => onHoverMethod(label)}
            onMouseLeave={() => onHoverMethod(null)}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className="font-medium text-[var(--text)] tracking-wide"
                title={run.model ?? undefined}
              >
                <RunLabel run={run} />
              </span>
              {isBaseline && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono tracking-wider font-semibold bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)]">
                  BASELINE
                </span>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)]">difference vs baseline (raw)</p>
              {activeMetrics.map((key) => {
                const val = run[key] ?? 0;
                const baseVal = baselineRun ? (baselineRun[key] ?? 0) : val;
                const diff = val - baseVal;
                const labelText =
                  key === 'ndcg_at_10'
                    ? 'nDCG@10'
                    : key === 'recall_at_100'
                    ? 'Recall@100'
                    : key === 'mrr_at_10'
                    ? 'MRR@10'
                    : key === 'recall_at_10'
                    ? 'Recall@10'
                    : 'Recall@1';

                const gradientClass =
                  key === 'ndcg_at_10'
                    ? 'bg-gradient-to-r from-[var(--bl-accent-hot,#ff3d5a)] to-[#ff758c]'
                    : key === 'recall_at_100'
                    ? 'bg-gradient-to-r from-[var(--bl-accent-cool,#8a2be2)] to-[#b366ff]'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500';

                return (
                  <div key={key} className="flex items-center gap-2 sm:gap-3">
                    <span className="w-20 shrink-0 text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-semibold">
                      {labelText}
                    </span>

                    {/* Thin 8-10px rounded progress bar track */}
                    <div className="flex-1 h-2 sm:h-2.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${gradientClass}`}
                        style={{ width: `${Math.max(2, Math.min(100, val * 100))}%` }}
                      />
                    </div>

                    {/* Value shown at the end of the bar */}
                    <span className="font-mono text-[11px] font-bold text-[var(--text)] w-12 text-right shrink-0">
                      {val.toFixed(3)}
                    </span>

                    {/* Trend Delta badge vs baseline */}
                    <div className="w-16 shrink-0 flex justify-end">
                      {isBaseline ? (
                        <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-wider">
                          base
                        </span>
                      ) : diff > 0 ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          ↑+{diff.toFixed(3)}
                        </span>
                      ) : diff < 0 ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-normal text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border-subtle)]">
                          ↓{diff.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-[var(--text-muted)]">
                          =0.000
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EvaluationView() {
  const [data, setData] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dashboard Refinement States
  const [selectedDataset, setSelectedDataset] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ds = params.get('dataset');
      if (ds) return ds;
    }
    return 'all';
  });
  const [metricFilter, setMetricFilter] = useState<MetricKey>('both');
  const [baselineMethod, setBaselineMethod] = useState<'bm25' | 'tfidf'>('bm25');
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof EvaluationRun | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let active = true;
    api
      .evaluation()
      .then((value) => active && setData(value))
      .catch((cause: unknown) =>
        active &&
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load evaluation results.'
        )
      );
    return () => {
      active = false;
    };
  }, []);

  const handleSelectDataset = (ds: string) => {
    setSelectedDataset(ds);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (ds === 'all') {
        url.searchParams.delete('dataset');
      } else {
        url.searchParams.set('dataset', ds);
      }
      window.history.replaceState(
        null,
        '',
        url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '')
      );
    }
  };

  const handleSort = (colKey: keyof EvaluationRun, defaultDirection: MetricDirection) => {
    if (sortColumn === colKey) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // Reset to default order
        setSortColumn(null);
      }
    } else {
      setSortColumn(colKey);
      setSortDirection(defaultDirection === 'lower' ? 'asc' : 'desc');
    }
  };

  const grouped = useMemo(() => {
    if (!data) return {};
    return data.runs.reduce<Record<string, EvaluationRun[]>>(
      (accumulator, run) => {
        (accumulator[run.dataset] ??= []).push(run);
        return accumulator;
      },
      {}
    );
  }, [data]);

  if (error) {
    return (
      <div
        className="p-5 rounded-2xl bg-[#ff3d5a]/10 border border-[#ff3d5a]/30 text-xs font-mono text-[var(--bl-accent-hot,#ff3d5a)] shadow-xl"
        role="alert"
      >
        <p className="font-bold uppercase tracking-wider mb-1">Evaluation Error</p>
        <p className="leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="p-10 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] text-center shadow-xl ring-1 ring-white/5"
        role="status"
      >
        <span className="inline-block animate-pulse">Loading evaluation results…</span>
      </div>
    );
  }

  if (!data.runs.length) {
    return (
      <div className="p-10 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] text-center shadow-xl ring-1 ring-white/5">
        No evaluation runs are available.
      </div>
    );
  }

  const datasetKeys = Object.keys(grouped);
  const datasetsToRender =
    selectedDataset !== 'all' && grouped[selectedDataset]
      ? { [selectedDataset]: grouped[selectedDataset] }
      : grouped;

  return (
    <section className="space-y-8 pb-12">
      {/* View Header with Single H1 for Evaluation View */}
      <div className="space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-[0.2em] text-[var(--text)]">
          Benchmark Evaluation
        </h1>
        <p className="text-xs sm:text-sm font-mono uppercase tracking-wide text-[var(--text-muted)]">
          Standard information-retrieval benchmarks measuring ranking quality and latency across models.
        </p>
      </div>

      {/* Guide Callout - Refined Card Language */}
      <aside className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 text-xs text-[var(--text-muted)] leading-relaxed shadow-xl ring-1 ring-white/5">
        <h2 className="font-mono font-bold uppercase tracking-[0.18em] text-[var(--bl-accent-hot,#ff3d5a)] mb-1.5 text-xs sm:text-sm">
          How to read this
        </h2>
        <p className="leading-relaxed font-sans text-xs sm:text-sm">
          nDCG@10 measures how highly relevant results are ranked in the first ten
          results; Recall@100 measures how much labelled relevant material is
          found in the first hundred. BM25 is the stronger keyword baseline, while
          TF-IDF is the simple keyword baseline. Hybrid combines BM25 and the
          named Sentence-BERT model with reciprocal rank fusion (k = 60), fixed
          in advance and not tuned on test queries. SciFact has exact technical
          terms where keywords do well, while FiQA uses paraphrased
          natural-language questions where semantic models help more. These
          timings came from a single laptop run:{' '}
          <span className="font-mono font-semibold text-[var(--text)]">
            {data.hardware_note || 'no hardware note provided'}
          </span>
          . Scores in Compare are not comparable across methods, but these metrics
          are because they use labelled relevance judgements.
        </p>
      </aside>

      {/* Dataset Filter & Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl ring-1 ring-white/5">
        {/* Pill-style Segmented Dataset Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs font-mono uppercase">
          <button
            type="button"
            onClick={() => handleSelectDataset('all')}
            className={`px-3.5 py-1.5 rounded-lg font-bold tracking-wider transition-all cursor-pointer ${
              selectedDataset === 'all'
                ? 'bg-[var(--bl-accent-hot,#ff3d5a)] text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            All Datasets
          </button>
          {datasetKeys.map((ds) => (
            <button
              key={ds}
              type="button"
              onClick={() => handleSelectDataset(ds)}
              className={`px-3.5 py-1.5 rounded-lg font-bold tracking-wider transition-all cursor-pointer ${
                selectedDataset === ds
                  ? 'bg-[var(--bl-accent-hot,#ff3d5a)] text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {datasetNames[ds] ?? ds}
            </button>
          ))}
        </div>

        {/* Anchor Jump Chips */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] hidden sm:inline">
            Quick jump:
          </span>
          {datasetKeys.map((ds) => (
            <a
              key={`jump-${ds}`}
              href={`#dataset-${ds}`}
              className="px-2.5 py-1 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[10px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--bl-accent-hot,#ff3d5a)] hover:border-[var(--bl-accent-hot,#ff3d5a)]/40 transition-colors"
            >
              {datasetNames[ds] ?? ds} ↓
            </a>
          ))}
        </div>
      </div>

      {/* Dataset Sections */}
      {Object.entries(datasetsToRender).map(([dataset, datasetRuns]) => {
        // Calculate runs in order
        const runs = [...datasetRuns].sort((a, b) => {
          if (sortColumn !== null) {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            if (valA === null && valB === null) return 0;
            if (valA === null) return 1;
            if (valB === null) return -1;
            if (typeof valA === 'number' && typeof valB === 'number') {
              return sortDirection === 'asc' ? valA - valB : valB - valA;
            }
          }
          return (
            evaluationMethodOrder(a) - evaluationMethodOrder(b) ||
            a.method.localeCompare(b.method) ||
            evaluationLabel(a).localeCompare(evaluationLabel(b))
          );
        });

        const zeroWeightRuns = runs.filter(
          (run) => selectedBm25Weight(run) === 0
        );

        const { bestNdcgRun, bestRecallRun, fastestRun } = computeKpis(runs);

        return (
          <section
            key={dataset}
            id={`dataset-${dataset}`}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-7 space-y-7 shadow-2xl ring-1 ring-white/5 scroll-mt-6"
          >
            {/* Header: Title and Query Count */}
            <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-4">
              <h2 className="text-base sm:text-xl font-bold uppercase tracking-[0.18em] text-[var(--text)]">
                {datasetNames[dataset] ?? dataset}
              </h2>
              <span className="text-xs font-mono uppercase text-[var(--text-muted)] tracking-wider">
                {runs[0]?.query_count.toLocaleString()} queries
              </span>
            </div>

            {/* KPI Summary Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <p className="sm:col-span-3 text-xs text-[var(--text-muted)]">
                Best = highest raw value in this table. This is not a statistically significant difference; see docs/analysis/analysis.md.
              </p>
              {/* Tile 1: Best nDCG@10 */}
              <div
                className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#ff3d5a]/10 via-[var(--surface-raised)]/60 to-[var(--surface)] border border-[#ff3d5a]/25 shadow-sm transition-all hover:border-[#ff3d5a]/50 cursor-pointer"
                onMouseEnter={() =>
                  bestNdcgRun && setHoveredMethod(evaluationLabel(bestNdcgRun))
                }
                onMouseLeave={() => setHoveredMethod(null)}
              >
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--bl-accent-hot,#ff3d5a)] mb-1 font-semibold">
                  <span>Best nDCG@10</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] animate-pulse" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[var(--text)]">
                  {bestNdcgRun ? (bestNdcgRun.ndcg_at_10 ?? 0).toFixed(4) : '—'}
                </div>
                <div
                  className="mt-1 text-[11px] font-mono text-[var(--text-muted)] truncate"
                  title={bestNdcgRun ? evaluationLabel(bestNdcgRun) : undefined}
                >
                  {bestNdcgRun ? evaluationLabel(bestNdcgRun) : 'No data'}
                </div>
              </div>

              {/* Tile 2: Best Recall@100 */}
              <div
                className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#8a2be2]/10 via-[var(--surface-raised)]/60 to-[var(--surface)] border border-[#8a2be2]/25 shadow-sm transition-all hover:border-[#8a2be2]/50 cursor-pointer"
                onMouseEnter={() =>
                  bestRecallRun && setHoveredMethod(evaluationLabel(bestRecallRun))
                }
                onMouseLeave={() => setHoveredMethod(null)}
              >
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--bl-accent-cool,#8a2be2)] mb-1 font-semibold">
                  <span>Best Recall@100</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--bl-accent-cool,#8a2be2)] animate-pulse" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[var(--text)]">
                  {bestRecallRun ? (bestRecallRun.recall_at_100 ?? 0).toFixed(4) : '—'}
                </div>
                <div
                  className="mt-1 text-[11px] font-mono text-[var(--text-muted)] truncate"
                  title={bestRecallRun ? evaluationLabel(bestRecallRun) : undefined}
                >
                  {bestRecallRun ? evaluationLabel(bestRecallRun) : 'No data'}
                </div>
              </div>

              {/* Tile 3: Fastest Query Latency */}
              <div
                className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-emerald-500/10 via-[var(--surface-raised)]/60 to-[var(--surface)] border border-emerald-500/25 shadow-sm transition-all hover:border-emerald-500/50 cursor-pointer"
                onMouseEnter={() =>
                  fastestRun && setHoveredMethod(evaluationLabel(fastestRun))
                }
                onMouseLeave={() => setHoveredMethod(null)}
              >
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 mb-1 font-semibold">
                  <span>Fastest Latency</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[var(--text)]">
                  {fastestRun && typeof fastestRun.average_query_latency_ms === 'number'
                    ? `${fastestRun.average_query_latency_ms.toFixed(2)} ms`
                    : '—'}
                </div>
                <div
                  className="mt-1 text-[11px] font-mono text-[var(--text-muted)] truncate"
                  title={fastestRun ? evaluationLabel(fastestRun) : undefined}
                >
                  {fastestRun ? evaluationLabel(fastestRun) : 'No data'}
                </div>
              </div>
            </div>

            {/* Table Section with Sticky Headers and Sorting */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold">
                  Benchmark Metrics Table
                </span>
                {sortColumn !== null && (
                  <button
                    type="button"
                    onClick={() => setSortColumn(null)}
                    className="text-[10px] font-mono uppercase text-[var(--bl-accent-hot,#ff3d5a)] hover:underline cursor-pointer"
                  >
                    Reset Sort Order
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border)] overflow-hidden overflow-x-auto shadow-sm bg-[var(--surface-raised)]/20">
                <table className="w-full text-xs text-left tabular-nums border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider bg-[var(--surface-toolbar)]">
                      <th className="p-3 font-semibold sticky left-0 bg-[var(--surface-toolbar)] z-10">
                        Method / model
                      </th>
                      {columns.map(([key, title, , dir]) => {
                        const isSorted = sortColumn === key;
                        return (
                          <th
                            key={title}
                            className="p-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-[var(--text)] transition-colors"
                            onClick={() => handleSort(key, dir)}
                            aria-sort={
                              isSorted
                                ? sortDirection === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : undefined
                            }
                          >
                            <div className="inline-flex items-center gap-1">
                              <span>{title}</span>
                              <span
                                className={`text-[9px] ${
                                  isSorted
                                    ? 'text-[var(--bl-accent-hot,#ff3d5a)] font-bold'
                                    : 'text-[var(--text-muted)]/40'
                                }`}
                              >
                                {isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
                    {runs.map((run) => {
                      const isHovered = hoveredMethod === evaluationLabel(run);
                      return (
                        <tr
                          key={evaluationLabel(run)}
                          className={`transition-colors ${
                            isHovered
                              ? 'bg-[var(--surface-raised)] ring-1 ring-[var(--bl-accent-hot,#ff3d5a)]/40'
                              : 'hover:bg-[var(--surface-raised)]/60'
                          }`}
                          onMouseEnter={() => setHoveredMethod(evaluationLabel(run))}
                          onMouseLeave={() => setHoveredMethod(null)}
                        >
                          <th
                            className="p-3 font-medium text-[var(--text)] sticky left-0 bg-[var(--surface)] z-10 whitespace-nowrap"
                            title={run.model ?? undefined}
                          >
                            <RunLabel run={run} />
                          </th>
                          {columns.map(([key, , format, direction]) => {
                            const best = isBestMetric(run, runs, key, direction);
                            return (
                              <td
                                key={String(key)}
                                className={`p-3 whitespace-nowrap ${
                                  best
                                    ? 'font-bold text-[var(--bl-accent-hot,#ff3d5a)]'
                                    : 'text-[var(--text-muted)]'
                                }`}
                              >
                                {best && (
                                  <span
                                    aria-label="Best value"
                                    className="text-[var(--bl-accent-hot,#ff3d5a)] font-bold mr-1 inline-flex items-center"
                                  >
                                    ★{' '}
                                  </span>
                                )}
                                {format(
                                  typeof run[key] === 'number' ? run[key] : null
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {zeroWeightRuns.map((run) => (
              <p
                key={evaluationLabel(run)}
                className="text-xs text-[var(--text-muted)] font-mono italic"
              >
                The dev-selected BM25 weight for {evaluationLabel(run)} is 0, so it
                is identical to the dense retriever.
              </p>
            ))}

            {/* Visual Analytics Section: Progress Bars & Recall Curves */}
            <div className="space-y-6 pt-4 border-t border-[var(--border)]">
              {/* Interactive Controls Bar for Charts */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-raised)]/40 border border-[var(--border-subtle)]">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--text)] block">
                    Visual Comparisons
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                    Rounded progress bars with baseline deltas & recall curves
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Metric Select Dropdown */}
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <label
                      htmlFor={`metric-select-${dataset}`}
                      className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold"
                    >
                      Metric:
                    </label>
                    <select
                      id={`metric-select-${dataset}`}
                      value={metricFilter}
                      onChange={(e) => setMetricFilter(e.target.value as MetricKey)}
                      className="px-2.5 py-1 rounded bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text)] uppercase focus:outline-none focus:border-[var(--bl-accent-hot,#ff3d5a)] cursor-pointer"
                    >
                      <option value="both">Both (nDCG@10 & Recall@100)</option>
                      <option value="ndcg_at_10">nDCG@10</option>
                      <option value="recall_at_100">Recall@100</option>
                      <option value="mrr_at_10">MRR@10</option>
                      <option value="recall_at_10">Recall@10</option>
                      <option value="recall_at_1">Recall@1</option>
                    </select>
                  </div>

                  {/* Baseline Select Dropdown */}
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <label
                      htmlFor={`baseline-select-${dataset}`}
                      className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold"
                    >
                      Baseline:
                    </label>
                    <select
                      id={`baseline-select-${dataset}`}
                      value={baselineMethod}
                      onChange={(e) =>
                        setBaselineMethod(e.target.value as 'bm25' | 'tfidf')
                      }
                      className="px-2.5 py-1 rounded bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text)] uppercase focus:outline-none focus:border-[var(--bl-accent-hot,#ff3d5a)] cursor-pointer"
                    >
                      <option value="bm25">BM25 (Strong Keyword)</option>
                      <option value="tfidf">TF-IDF (Simple Keyword)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Recall Progression Line Chart (Curve Graph) */}
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]/20 shadow-inner">
                <RecallLineChart
                  runs={runs}
                  hoveredMethod={hoveredMethod}
                  onHoverMethod={setHoveredMethod}
                />
              </div>

              {/* Progress Bars Chart */}
              <Chart
                runs={runs}
                metricFilter={metricFilter}
                baselineMethod={baselineMethod}
                hoveredMethod={hoveredMethod}
                onHoverMethod={setHoveredMethod}
              />
            </div>
          </section>
        );
      })}

      {/* Footnotes */}
      <div className="space-y-1.5 pt-4 text-xs font-mono uppercase text-[var(--text-muted)] border-t border-[var(--border)]">
        <p>— : not measured end to end</p>
        <p>
          Stars mark the highest raw value in a column. They do not indicate a
          statistically significant difference; see docs/analysis/analysis.md.
        </p>
        <p>
          Lower is better for index build time and query latency. TF-IDF runs on
          the CPU; Sentence-BERT query time includes embedding the query on the
          GPU.
        </p>
      </div>
    </section>
  );
}
