/**
 * Pure mathematical functions for generating Brand Love Score bell curves,
 * score normalization, and color gradients.
 */

export interface CurvePoint {
  x: number;
  y: number;
}

export interface CurveGeometry {
  pathD: string;
  peakX: number;
  peakY: number;
  color: string;
}

/**
 * Interpolates between Hot Pink-Red (#ff3d5a) at rank 1 and
 * Deep Violet (#8a2be2) at rank k.
 */
export function interpolateRankColor(rank: number, total: number): string {
  if (total <= 1) return '#ff3d5a';
  const t = Math.max(0, Math.min(1, (rank - 1) / (total - 1)));

  // RGB for #ff3d5a: (255, 61, 90)
  // RGB for #8a2be2: (138, 43, 226)
  const r = Math.round(255 + t * (138 - 255));
  const g = Math.round(61 + t * (43 - 61));
  const b = Math.round(90 + t * (226 - 90));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Normalizes an array of raw scores to relative heights between minRel and maxRel.
 */
export function normalizeScores(
  scores: number[],
  minRel = 0.22,
  maxRel = 0.94
): number[] {
  if (scores.length === 0) return [];
  if (scores.length === 1) return [maxRel];

  let minScore = Infinity;
  let maxScore = -Infinity;
  for (const s of scores) {
    if (s < minScore) minScore = s;
    if (s > maxScore) maxScore = s;
  }

  const range = maxScore - minScore;
  if (range <= 1e-6) {
    return scores.map(() => (minRel + maxRel) / 2);
  }

  return scores.map((s) => {
    const t = (s - minScore) / range;
    return minRel + t * (maxRel - minRel);
  });
}

/**
 * Generates an SVG path for a Gaussian bell curve that sits gracefully on the baseline.
 *
 * @param centerX Center X of the bell peak
 * @param baselineY Baseline Y where the curve rests
 * @param peakHeight Height of the peak above the baseline
 * @param sigma Standard deviation / horizontal spread of the curve
 * @param totalWidth Total width of the SVG canvas
 */
export function generateBellCurvePath(
  centerX: number,
  baselineY: number,
  peakHeight: number,
  sigma: number,
  totalWidth: number,
  sampleSteps = 70
): { pathD: string; peakX: number; peakY: number } {
  const peakY = baselineY - peakHeight;

  // We sample points across the span [centerX - 3.8 * sigma, centerX + 3.8 * sigma]
  const span = 3.8 * sigma;
  const startX = Math.max(0, centerX - span);
  const endX = Math.min(totalWidth, centerX + span);

  const points: CurvePoint[] = [];

  // Anchor to baseline start if startX > 0
  if (startX > 0) {
    points.push({ x: 0, y: baselineY });
  }

  for (let i = 0; i <= sampleSteps; i++) {
    const x = startX + (i / sampleSteps) * (endX - startX);
    const diff = (x - centerX) / sigma;
    // Gaussian formula: y = baselineY - peakHeight * exp(-0.5 * diff^2)
    const factor = Math.exp(-0.5 * diff * diff);
    const y = baselineY - peakHeight * factor;
    points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }

  if (endX < totalWidth) {
    points.push({ x: totalWidth, y: baselineY });
  }

  // Construct SVG path command
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }

  return { pathD, peakX: centerX, peakY };
}
