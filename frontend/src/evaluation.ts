import type { EvaluationRun } from './api';

export function isBestMetric(run: EvaluationRun, runs: EvaluationRun[], key: keyof EvaluationRun): boolean {
  const values = runs.map((item) => Number(item[key]));
  return Number(run[key]) === Math.max(...values);
}
