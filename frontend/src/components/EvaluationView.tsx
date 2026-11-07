import { useEffect, useState } from 'react';
import { api, type EvaluationResponse, type EvaluationRun } from '../api';
import { isBestMetric, type MetricDirection } from '../evaluation';

const columns: Array<[keyof EvaluationRun, string, (value: number) => string, MetricDirection]> = [
  ['ndcg_at_10', 'nDCG@10', v => v.toFixed(4), 'higher'], ['mrr_at_10', 'MRR@10', v => v.toFixed(4), 'higher'], ['recall_at_1', 'Recall@1', v => v.toFixed(4), 'higher'], ['recall_at_10', 'Recall@10', v => v.toFixed(4), 'higher'], ['recall_at_100', 'Recall@100', v => v.toFixed(4), 'higher'], ['index_build_seconds', 'Index build', v => `${v.toFixed(2)} s`, 'lower'], ['average_query_latency_ms', 'Query latency', v => `${v.toFixed(2)} ms`, 'lower'],
];
const datasetNames: Record<string, string> = { scifact: 'SciFact', fiqa: 'FiQA' };
function label(run: EvaluationRun) {
  if (run.method === 'tfidf') return 'TF-IDF';
  if (run.method === 'bm25') return 'BM25';
  return run.model ?? run.method;
}
function methodOrder(run: EvaluationRun): number {
  if (run.method === 'tfidf') return 0;
  if (run.method === 'bm25') return 1;
  if (run.method !== 'sbert') return 4;
  const model = run.model?.toLowerCase() ?? '';
  if (model.includes('minilm')) return 2;
  if (model.includes('mpnet')) return 3;
  return 4;
}
function Chart({ runs }: { runs: EvaluationRun[] }) { return <div className="space-y-3" role="img" aria-label={`nDCG at 10 and Recall at 100 comparison for ${runs[0]?.dataset ?? 'dataset'}`}>{runs.map(run => <div key={label(run)} className="text-xs"><span className="font-medium">{label(run)}</span>{(['ndcg_at_10', 'recall_at_100'] as const).map(key => <div key={key} className="flex items-center gap-2 mt-1"><span className="w-20 text-slate-500">{key === 'ndcg_at_10' ? 'nDCG@10' : 'Recall@100'}</span><div className="h-4 bg-blue-600 rounded text-white text-[10px] leading-4 pl-1" style={{ width: `${Math.max(3, run[key] * 100)}%` }}>{run[key].toFixed(3)}</div></div>)}</div>)}</div>; }
export function EvaluationView() {
  const [data, setData] = useState<EvaluationResponse | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; api.evaluation().then(value => active && setData(value)).catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : 'Unable to load evaluation results.')); return () => { active = false; }; }, []);
  if (error) return <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800" role="alert">{error}</div>;
  if (!data) return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500" role="status">Loading evaluation results…</div>;
  if (!data.runs.length) return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">No evaluation runs are available.</div>;
  const grouped = data.runs.reduce<Record<string, EvaluationRun[]>>((accumulator, run) => { (accumulator[run.dataset] ??= []).push(run); return accumulator; }, {});
  return <section className="space-y-6"><aside className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed"><h2 className="font-bold text-slate-900 mb-1">How to read this</h2><p>nDCG@10 measures how highly relevant results are ranked in the first ten results; Recall@100 measures how much labelled relevant material is found in the first hundred. TF-IDF is the keyword baseline. SciFact has exact technical terms where keywords do well, while FiQA uses paraphrased natural-language questions where semantic models help more. These timings came from a single laptop run: {data.hardware_note || 'no hardware note provided'}. Scores in Compare are not comparable across methods, but these metrics are because they use labelled relevance judgements.</p></aside>{Object.entries(grouped).map(([dataset, datasetRuns]) => {
    const runs = [...datasetRuns].sort((a, b) => methodOrder(a) - methodOrder(b) || label(a).localeCompare(label(b)));
    return <section key={dataset} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4"><h2 className="text-lg font-bold">{datasetNames[dataset] ?? dataset}</h2><p className="text-xs text-slate-500">{runs[0].query_count.toLocaleString()} queries</p><div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr><th className="p-2">Method / model</th>{columns.map(([, title]) => <th key={title} className="p-2 whitespace-nowrap">{title}</th>)}</tr></thead><tbody>{runs.map(run => <tr key={label(run)} className="border-t border-slate-100"><th className="p-2 font-medium">{label(run)}</th>{columns.map(([key,, format, direction]) => {
      const best = isBestMetric(run, runs, key, direction);
      return <td key={String(key)} className={`p-2 ${best ? 'font-bold' : ''}`}>{best && <span aria-label="Best value">★ </span>}{format(Number(run[key]))}</td>;
    })}</tr>)}</tbody></table></div><Chart runs={runs} /></section>;
  })}<p className="text-xs text-slate-500">Lower is better for index build time and query latency. TF-IDF runs on the CPU; Sentence-BERT query time includes embedding the query on the GPU.</p></section>;
}
