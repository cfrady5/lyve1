/**
 * API Route: Get comp history for an item
 * GET /api/items/:id/comps/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getItemCompHistory } from '@/lib/comps/updateItemComps';

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

    // Get history
    const history = await getItemCompHistory(itemId, 10);

    return NextResponse.json({
      success: true,
      item_id: itemId,
      history,
    });
  } catch (error) {
    console.error('[API_COMPS_HISTORY] Error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch comp history' },
      { status: 500 }
    );
  }
}
