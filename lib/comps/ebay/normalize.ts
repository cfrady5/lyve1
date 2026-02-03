/**
 * Normalize eBay listings into price observations
 */

import type { PriceObservation, EbayActiveListingItem } from '../types';

/**
 * Normalize active listing from eBay Buy API
 */
export function normalizeActiveListing(item: EbayActiveListingItem): PriceObservation | null {
  try {
    const priceItem = parseFloat(item.price.value);
    if (isNaN(priceItem) || priceItem <= 0) {
      return null;
    }

    // Get shipping cost
    let shipping = 0;
    if (item.shippingOptions && item.shippingOptions.length > 0) {
      const firstShipping = item.shippingOptions[0];
      if (firstShipping.shippingCost) {
        shipping = parseFloat(firstShipping.shippingCost.value) || 0;
      }
    }

    const priceTotal = priceItem + shipping;

    return {
      price_total: priceTotal,
      price_item: priceItem,
      shipping: shipping,
      currency: item.price.currency || 'USD',
      title: item.title || '',
      item_web_url: item.itemWebUrl,
      condition: item.condition,
      source_id: item.itemId,
    };
  } catch (error) {
    console.error('[NORMALIZE] Error normalizing active listing:', error, item);
    return null;
  }
}

/**
 * Normalize multiple active listings
 */
export function normalizeActiveListings(items: EbayActiveListingItem[]): PriceObservation[] {
  const observations: PriceObservation[] = [];

  for (const item of items) {
    const obs = normalizeActiveListing(item);
    if (obs) {
      observations.push(obs);
    }
  }

  return observations;
}

/**
 * Filter observations by grade (if applicable)
 */
export function filterByGrade(
  observations: PriceObservation[],
  gradeFilter: string | null
): PriceObservation[] {
  if (!gradeFilter) return observations;

  const gradeLower = gradeFilter.toLowerCase();

  // Filter to observations that mention the grade in title
  const filtered = observations.filter(obs =>
    obs.title.toLowerCase().includes(gradeLower)
  );

  // If filtering removes too many results, return original
  if (filtered.length < 3 && observations.length >= 5) {
    return observations;
  }

  return filtered.length > 0 ? filtered : observations;
}

/**
 * Remove extreme outliers from observations
 */
export function trimOutliers(observations: PriceObservation[]): {
  trimmed: PriceObservation[];
  removed: number;
} {
  const n = observations.length;

  // Not enough data to trim
  if (n < 5) {
    return { trimmed: observations, removed: 0 };
  }

  // Sort by price_total
  const sorted = [...observations].sort((a, b) => a.price_total - b.price_total);

  let trimCount = 0;

  if (n >= 10) {
    // Trim 10% from each end
    trimCount = Math.floor(n * 0.1);
  } else if (n >= 5) {
    // Trim 1 from each end
    trimCount = 1;
  }

  const trimmed = sorted.slice(trimCount, n - trimCount);

  return {
    trimmed,
    removed: n - trimmed.length,
  };
}
