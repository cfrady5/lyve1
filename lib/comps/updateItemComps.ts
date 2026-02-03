/**
 * Update Item Comps Orchestrator
 * Main entry point for refreshing comps for an item
 */

import { createClient } from '@/lib/supabase/server';
import { buildCompQuery, getSportsCardCategoryId, buildGradeFilter } from './queryBuilder';
import { searchActiveListings } from './ebay/ebayProviderActive';
import { trimOutliers } from './ebay/normalize';
import { computeCompStats, getLyveRange } from './compute';
import type { ItemForComps, CompResult, CompSource } from './types';

/**
 * Update comps for a single item
 */
export async function updateItemComps(itemId: string): Promise<CompResult> {
  const supabase = await createClient();

  // 1. Load item data
  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('id, name, sport, player, year, set_name, brand, parallel, card_number, grade, grader, cert_number')
    .eq('id', itemId)
    .single();

  if (itemError || !item) {
    throw new Error(`Item not found: ${itemId}`);
  }

  // 2. Build search query
  const query = buildCompQuery(item as ItemForComps);
  console.log('[UPDATE_COMPS] Query for item', itemId, ':', query);

  if (!query || query.trim().length === 0) {
    throw new Error('Unable to build search query for item');
  }

  // 3. Search for comps (using active listings provider)
  // TODO: Try sold comps provider first, fall back to active if permission error
  const source: CompSource = 'ebay_active';

  try {
    const categoryId = getSportsCardCategoryId();
    const gradeFilter = buildGradeFilter(item.grader, item.grade);

    let observations = await searchActiveListings(query, {
      categoryId,
      gradeFilter,
      limit: 50,
    });

    console.log('[UPDATE_COMPS] Found', observations.length, 'initial observations');

    // 4. Trim outliers
    const { trimmed, removed } = trimOutliers(observations);
    observations = trimmed;

    console.log('[UPDATE_COMPS] After trimming:', observations.length, 'observations (removed', removed, ')');

    // 5. Compute stats
    const stats = computeCompStats(observations);
    const range = getLyveRange(stats);

    console.log('[UPDATE_COMPS] Stats:', {
      sample_size: stats.sample_size,
      median: stats.median_price,
      confidence: stats.confidence,
    });

    // 6. Update item in database
    const updateData = {
      comp_query: query,
      lyve_value: stats.median_price,
      lyve_range_low: range.low,
      lyve_range_high: range.high,
      lyve_comp_source: source,
      lyve_comp_sample_size: stats.sample_size,
      lyve_value_updated_at: new Date().toISOString(),
      lyve_comp_confidence: stats.confidence,
    };

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', itemId);

    if (updateError) {
      console.error('[UPDATE_COMPS] Error updating item:', updateError);
      throw updateError;
    }

    // 7. Insert comp history
    const compHistoryData = {
      item_id: itemId,
      source,
      query,
      marketplace: 'EBAY_US',
      sample_size: stats.sample_size,
      median_price: stats.median_price,
      avg_price: stats.avg_price,
      p25: stats.p25,
      p75: stats.p75,
      min_trim: stats.min_trim,
      max_trim: stats.max_trim,
      currency: 'USD',
      retrieved_at: new Date().toISOString(),
      observations: observations.map(obs => ({
        price_total: obs.price_total,
        price_item: obs.price_item,
        shipping: obs.shipping,
        currency: obs.currency,
        title: obs.title,
        source_id: obs.source_id,
      })),
    };

    const { error: historyError } = await supabase
      .from('item_comps')
      .insert(compHistoryData);

    if (historyError) {
      console.error('[UPDATE_COMPS] Error inserting comp history:', historyError);
      // Don't throw - item was updated successfully
    }

    // 8. Return result
    const result: CompResult = {
      query,
      source,
      marketplace: 'EBAY_US',
      observations,
      stats,
      retrieved_at: new Date().toISOString(),
    };

    return result;
  } catch (error) {
    console.error('[UPDATE_COMPS] Error fetching comps:', error);

    // If it's an auth error, we can't proceed
    if (error instanceof Error && error.message === 'EBAY_AUTH_ERROR') {
      throw new Error('eBay authentication failed. Please check API credentials.');
    }

    throw error;
  }
}

/**
 * Get comp history for an item
 */
export async function getItemCompHistory(itemId: string, limit: number = 10) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('item_comps')
    .select('*')
    .eq('item_id', itemId)
    .order('retrieved_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[COMP_HISTORY] Error fetching history:', error);
    throw error;
  }

  return data || [];
}
