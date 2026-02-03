/**
 * API Route: Refresh comps for a single item
 * GET /api/items/:id/comps/refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateItemComps } from '@/lib/comps/updateItemComps';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params;

  try {
    const supabase = await createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify item belongs to user
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select('id, user_id')
      .eq('id', itemId)
      .single();

    if (itemError || !item || item.user_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Update comps
    const result = await updateItemComps(itemId);

    // Return updated values
    const { data: updatedItem } = await supabase
      .from('inventory_items')
      .select('lyve_value, lyve_range_low, lyve_range_high, lyve_comp_source, lyve_comp_sample_size, lyve_value_updated_at, lyve_comp_confidence')
      .eq('id', itemId)
      .single();

    return NextResponse.json({
      success: true,
      item_id: itemId,
      lyve_value: updatedItem?.lyve_value,
      lyve_range_low: updatedItem?.lyve_range_low,
      lyve_range_high: updatedItem?.lyve_range_high,
      source: updatedItem?.lyve_comp_source,
      sample_size: updatedItem?.lyve_comp_sample_size,
      confidence: updatedItem?.lyve_comp_confidence,
      updated_at: updatedItem?.lyve_value_updated_at,
      query: result.query,
    });
  } catch (error) {
    console.error('[API_COMPS_REFRESH] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh comps';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
