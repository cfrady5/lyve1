/**
 * API Route: Bulk refresh comps for multiple items
 * POST /api/items/comps/bulk-refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateItemComps } from '@/lib/comps/updateItemComps';

// Rate limiting: process items with delay
const DELAY_BETWEEN_ITEMS_MS = 1000; // 1 second between items

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { updated_before_days = 7, limit = 20 } = body;

    // Get items needing refresh
    const { data: items, error: itemsError } = await supabase
      .rpc('get_items_needing_comp_refresh', {
        p_user_id: user.id,
        p_days_threshold: updated_before_days,
        p_limit: Math.min(limit, 50), // Cap at 50 for safety
      });

    if (itemsError) {
      console.error('[BULK_REFRESH] Error getting items:', itemsError);
      return NextResponse.json({ error: 'Failed to get items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items need refresh',
        processed: 0,
        failed: 0,
        skipped: 0,
      });
    }

    console.log('[BULK_REFRESH] Found', items.length, 'items to refresh');

    // Process items sequentially with delay
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as Array<{ item_id: string; error: string }>,
    };

    for (const item of items) {
      try {
        await updateItemComps(item.item_id);
        results.processed++;

        // Delay between items to respect rate limits
        if (results.processed < items.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ITEMS_MS));
        }
      } catch (error) {
        console.error('[BULK_REFRESH] Error updating item', item.item_id, ':', error);
        results.failed++;
        results.errors.push({
          item_id: item.item_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // If it's an auth error, stop the whole process
        if (error instanceof Error && error.message.includes('authentication')) {
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_items: items.length,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors.slice(0, 5), // Return first 5 errors
    });
  } catch (error) {
    console.error('[BULK_REFRESH] Error:', error);

    return NextResponse.json(
      { error: 'Failed to bulk refresh comps' },
      { status: 500 }
    );
  }
}
