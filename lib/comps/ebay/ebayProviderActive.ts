/**
 * eBay Active Listings Provider
 * Uses Buy Browse API to search active listings
 */

import { getEbayAccessToken, getEbayBaseUrl } from './ebayAuth';
import { normalizeActiveListings, filterByGrade } from './normalize';
import type { PriceObservation, EbaySearchResponse } from '../types';

/**
 * Search active listings on eBay
 */
export async function searchActiveListings(
  query: string,
  options: {
    categoryId?: string;
    gradeFilter?: string | null;
    limit?: number;
  } = {}
): Promise<PriceObservation[]> {
  const { categoryId, gradeFilter, limit = 50 } = options;

  try {
    const token = await getEbayAccessToken();
    const baseUrl = getEbayBaseUrl('buy');

    // Build query parameters
    const params = new URLSearchParams({
      q: query,
      limit: Math.min(limit, 200).toString(),
    });

    // Add category filter for sports cards
    if (categoryId) {
      params.append('category_ids', categoryId);
    }

    // Add filter for buy it now (exclude auctions)
    params.append('filter', 'buyingOptions:{FIXED_PRICE}');

    const url = `${baseUrl}/buy/browse/v1/item_summary/search?${params.toString()}`;

    console.log('[EBAY_ACTIVE] Searching:', { query, categoryId, url });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': 'affiliateCampaignId=<ePNCampaignId>,affiliateReferenceId=<referenceId>',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EBAY_ACTIVE] API error:', response.status, errorText);

      // If 403 or 401, might be auth issue or permission issue
      if (response.status === 403 || response.status === 401) {
        throw new Error('EBAY_AUTH_ERROR');
      }

      throw new Error(`eBay API error: ${response.status}`);
    }

    const data: EbaySearchResponse = await response.json();

    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      console.log('[EBAY_ACTIVE] No results found for query:', query);
      return [];
    }

    console.log('[EBAY_ACTIVE] Found', data.itemSummaries.length, 'listings');

    // Normalize listings
    let observations = normalizeActiveListings(data.itemSummaries);

    // Filter by grade if provided
    if (gradeFilter) {
      observations = filterByGrade(observations, gradeFilter);
      console.log('[EBAY_ACTIVE] After grade filter:', observations.length, 'observations');
    }

    return observations;
  } catch (error) {
    console.error('[EBAY_ACTIVE] Error searching active listings:', error);
    throw error;
  }
}
