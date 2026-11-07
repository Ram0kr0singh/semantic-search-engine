import type { EvaluationRun } from './api';

export type MetricDirection = 'higher' | 'lower';

export function isBestMetric(
  run: Partial<EvaluationRun>,
  runs: Array<Partial<EvaluationRun>>,
  key: keyof EvaluationRun,
  direction: MetricDirection,
): boolean {
  const value = run[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;

  const values = runs
    .map((item) => item[key])
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (values.length === 0) return false;

  const best = direction === 'higher' ? Math.max(...values) : Math.min(...values);
  return value === best;
}
