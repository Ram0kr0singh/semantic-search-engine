import { describe, expect, it } from 'vitest';
import {
  generateBellCurvePath,
  interpolateRankColor,
  normalizeScores,
} from './curveMath';

describe('curveMath', () => {
  describe('interpolateRankColor', () => {
    it('returns hot pink-red for rank 1', () => {
      expect(interpolateRankColor(1, 10)).toBe('rgb(255, 61, 90)');
    });

    it('returns deep violet for the last rank', () => {
      expect(interpolateRankColor(10, 10)).toBe('rgb(138, 43, 226)');
    });

    it('interpolates intermediate ranks smoothly', () => {
      const mid = interpolateRankColor(5, 10);
      expect(mid).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    });

    it('handles single item without division by zero', () => {
      expect(interpolateRankColor(1, 1)).toBe('#ff3d5a');
    });
  });

  describe('normalizeScores', () => {
    it('normalizes scores within minRel and maxRel bounds', () => {
      const normalized = normalizeScores([10, 20, 30], 0.2, 0.9);
      expect(normalized[0]).toBeCloseTo(0.2);
      expect(normalized[2]).toBeCloseTo(0.9);
      expect(normalized[1]).toBeCloseTo(0.55);
    });

    it('handles equal scores gracefully', () => {
      const normalized = normalizeScores([5, 5, 5], 0.2, 0.9);
      expect(normalized).toHaveLength(3);
      expect(normalized[0]).toBeCloseTo(0.55);
    });

    it('handles empty and single scores', () => {
      expect(normalizeScores([])).toEqual([]);
      expect(normalizeScores([42])).toEqual([0.94]);
    });
  });

  describe('generateBellCurvePath', () => {
    it('generates a valid SVG path with peak at specified coordinates', () => {
      const { pathD, peakX, peakY } = generateBellCurvePath(500, 440, 300, 120, 1000);
      expect(peakX).toBe(500);
      expect(peakY).toBe(140);
      expect(pathD.startsWith('M ')).toBe(true);
      expect(pathD).toContain(' L ');
    });
  });
});
