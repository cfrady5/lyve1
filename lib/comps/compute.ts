/**
 * Compute LyveValue and LyveRange from price observations
 */

import type { PriceObservation, CompStats, CompConfidence } from './types';

/**
 * Compute statistics from price observations
 */
export function computeCompStats(observations: PriceObservation[]): CompStats {
  const n = observations.length;

  if (n === 0) {
    return {
      sample_size: 0,
      median_price: null,
      avg_price: null,
      p25: null,
      p75: null,
      min_trim: null,
      max_trim: null,
      confidence: 'low',
    };
  }

  // Extract prices and sort
  const prices = observations
    .map(obs => obs.price_total)
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return {
      sample_size: 0,
      median_price: null,
      avg_price: null,
      p25: null,
      p75: null,
      min_trim: null,
      max_trim: null,
      confidence: 'low',
    };
  }

  // Compute median (LyveValue)
  const median = percentile(prices, 50);

  // Compute average
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  // Compute percentiles for LyveRange
  const p25 = percentile(prices, 25);
  const p75 = percentile(prices, 75);

  // Min/max of trimmed set
  const minTrim = prices[0];
  const maxTrim = prices[prices.length - 1];

  // Determine confidence
  const confidence = determineConfidence(prices.length, median, p25, p75);

  return {
    sample_size: prices.length,
    median_price: round(median),
    avg_price: round(avg),
    p25: round(p25),
    p75: round(p75),
    min_trim: round(minTrim),
    max_trim: round(maxTrim),
    confidence,
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Determine confidence level based on sample size and spread
 */
function determineConfidence(
  sampleSize: number,
  median: number,
  p25: number,
  p75: number
): CompConfidence {
  // Low confidence: small sample
  if (sampleSize < 5) {
    return 'low';
  }

  // High confidence: large sample with tight spread
  if (sampleSize >= 10) {
    const spread = (p75 - p25) / median;
    if (spread <= 0.25) {
      return 'high';
    }
  }

  // Medium confidence: everything else
  return 'medium';
}

/**
 * Get LyveRange (low and high) from stats
 */
export function getLyveRange(stats: CompStats): { low: number | null; high: number | null } {
  const n = stats.sample_size;

  if (n === 0) {
    return { low: null, high: null };
  }

  // If N >= 8: use p25 and p75
  if (n >= 8) {
    return {
      low: stats.p25,
      high: stats.p75,
    };
  }

  // If N 4-7: use trimmed min/max
  if (n >= 4) {
    return {
      low: stats.min_trim,
      high: stats.max_trim,
    };
  }

  // If N < 4: use min/max but mark confidence as low
  return {
    low: stats.min_trim,
    high: stats.max_trim,
  };
}

/**
 * Round to 2 decimal places
 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
