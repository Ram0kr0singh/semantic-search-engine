import { useEffect, useState } from 'react';
import { api, type EvaluationResponse, type EvaluationRun } from '../api';
import {
  evaluationLabel,
  evaluationMethodOrder,
  isBestMetric,
  selectedBm25Weight,
  type MetricDirection,
} from '../evaluation';

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

function Chart({ runs }: { runs: EvaluationRun[] }) {
  return (
    <div
      className="space-y-3 pt-2"
      role="img"
      aria-label={`nDCG at 10 and Recall at 100 comparison for ${runs[0]?.dataset ?? 'dataset'}`}
    >
      {runs.map((run) => (
        <div key={evaluationLabel(run)} className="text-xs">
          <span className="font-medium text-[var(--text)]" title={run.model ?? undefined}>
            <RunLabel run={run} />
          </span>
          {(['ndcg_at_10', 'recall_at_100'] as const).map((key) => (
            <div key={key} className="flex items-center gap-2 mt-1">
              <span className="w-20 text-[var(--text-muted)] text-[11px]">
                {key === 'ndcg_at_10' ? 'nDCG@10' : 'Recall@100'}
              </span>
              <div
                className={`h-4 rounded text-white text-[10px] leading-4 pl-1.5 font-mono ${
                  key === 'ndcg_at_10'
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-cyan-600 dark:bg-cyan-500'
                }`}
                style={{ width: `${Math.max(3, run[key] * 100)}%` }}
              >
                {run[key].toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function EvaluationView() {
  const [data, setData] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <div
        className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-300 shadow-xs"
        role="alert"
      >
        <p className="font-bold mb-1">Evaluation Error</p>
        <p className="leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-muted)] text-center shadow-xs"
        role="status"
      >
        <span className="inline-block animate-pulse">Loading evaluation results…</span>
      </div>
    );
  }

  if (!data.runs.length) {
    return (
      <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-muted)] text-center shadow-xs">
        No evaluation runs are available.
      </div>
    );
  }

  const grouped = data.runs.reduce<Record<string, EvaluationRun[]>>(
    (accumulator, run) => {
      (accumulator[run.dataset] ??= []).push(run);
      return accumulator;
    },
    {}
  );

  return (
    <section className="space-y-8">
      {/* View Header with Single H1 for Evaluation View */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
          Benchmark Evaluation
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Standard information-retrieval benchmarks measuring ranking quality and latency across models.
        </p>
      </div>

      {/* Guide Callout */}
      <aside className="bg-[var(--surface-raised)] border border-[var(--border-accent)] rounded-2xl p-5 text-sm text-[var(--text)] leading-relaxed shadow-xs">
        <h2 className="font-bold text-[var(--text)] mb-1.5 text-base">
          How to read this
        </h2>
        <p className="text-[var(--text-muted)] leading-relaxed">
          nDCG@10 measures how highly relevant results are ranked in the first ten
          results; Recall@100 measures how much labelled relevant material is
          found in the first hundred. BM25 is the stronger keyword baseline, while
          TF-IDF is the simple keyword baseline. Hybrid combines BM25 and the
          named Sentence-BERT model with reciprocal rank fusion (k = 60), fixed
          in advance and not tuned on test queries. SciFact has exact technical
          terms where keywords do well, while FiQA uses paraphrased
          natural-language questions where semantic models help more. These
          timings came from a single laptop run:{' '}
          <span className="font-semibold text-[var(--text)]">
            {data.hardware_note || 'no hardware note provided'}
          </span>
          . Scores in Compare are not comparable across methods, but these metrics
          are because they use labelled relevance judgements.
        </p>
      </aside>

      {/* Dataset Sections */}
      {Object.entries(grouped).map(([dataset, datasetRuns]) => {
        const runs = [...datasetRuns].sort(
          (a, b) =>
            evaluationMethodOrder(a) - evaluationMethodOrder(b) ||
            a.method.localeCompare(b.method) ||
            evaluationLabel(a).localeCompare(evaluationLabel(b))
        );
        const zeroWeightRuns = runs.filter(
          (run) => selectedBm25Weight(run) === 0
        );

        return (
          <section
            key={dataset}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm"
          >
            <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-xl font-bold text-[var(--text)]">
                {datasetNames[dataset] ?? dataset}
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                {runs[0].query_count.toLocaleString()} queries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left tabular-nums border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="p-2.5 font-semibold sticky left-0 bg-[var(--surface)] z-10">
                      Method / model
                    </th>
                    {columns.map(([, title]) => (
                      <th
                        key={title}
                        className="p-2.5 font-semibold whitespace-nowrap"
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {runs.map((run) => (
                    <tr
                      key={evaluationLabel(run)}
                      className="hover:bg-[var(--surface-raised)]/60 transition-colors"
                    >
                      <th
                        className="p-2.5 font-medium text-[var(--text)] sticky left-0 bg-[var(--surface)] z-10 whitespace-nowrap"
                        title={run.model ?? undefined}
                      >
                        <RunLabel run={run} />
                      </th>
                      {columns.map(([key, , format, direction]) => {
                        const best = isBestMetric(run, runs, key, direction);
                        return (
                          <td
                            key={String(key)}
                            className={`p-2.5 whitespace-nowrap ${
                              best
                                ? 'font-bold text-[var(--text)]'
                                : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {best && (
                              <span
                                aria-label="Best value"
                                className="text-amber-500 font-bold"
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
                  ))}
                </tbody>
              </table>
            </div>

            {zeroWeightRuns.map((run) => (
              <p
                key={evaluationLabel(run)}
                className="text-xs text-[var(--text-muted)] italic"
              >
                The dev-selected BM25 weight for {evaluationLabel(run)} is 0, so it
                is identical to the dense retriever.
              </p>
            ))}

            <Chart runs={runs} />
          </section>
        );
      })}

      {/* Footnotes */}
      <div className="space-y-1.5 pt-2 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
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
