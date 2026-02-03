/**
 * Lyvefolio Inventory Services
 * Server-side functions for managing inventory lifecycle
 */

import { createClient } from "@/lib/supabase/server";
import type { 
  MarkSoldPayload, 
  ArchivePayload, 
  LyvefolioFilters,
  LyvefolioActiveItem,
  LyvefolioSoldItem,
  LyvefolioArchivedItem,
  LyvefolioMetrics,
  SoldTabMetrics
} from "@/lib/types/lyvefolio";

// ================================================================
// MARK ITEM AS SOLD
// ================================================================

export async function markItemSold(payload: MarkSoldPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Verify ownership
  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, user_id, lifecycle_status')
    .eq('id', payload.item_id)
    .single();

  if (!item || item.user_id !== user.id) {
    throw new Error("Item not found or access denied");
  }

  if (item.lifecycle_status === 'sold') {
    throw new Error("Item is already sold");
  }

  // Create sale transaction
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      user_id: user.id,
      item_id: payload.item_id,
      session_id: payload.session_id || null,
      platform_id: payload.platform_id || null,
      platform_key: payload.platform_key || null,
      sold_price: payload.sold_price,
      fees: payload.fees || 0,
      shipping_cost: payload.shipping_cost || 0,
      buyer_username: payload.buyer_username || null,
      order_id: payload.order_id || null,
      sold_at: payload.sold_at || new Date().toISOString(),
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (saleError) {
    throw new Error(`Failed to create sale: ${saleError.message}`);
  }

  // Update item status
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({
      lifecycle_status: 'sold',
      sold_date: (payload.sold_at || new Date().toISOString()).split('T')[0],
    })
    .eq('id', payload.item_id);

  if (updateError) {
    throw new Error(`Failed to update item status: ${updateError.message}`);
  }

  // Ensure session_items entry exists if session_id provided
  if (payload.session_id) {
    const { error: sessionItemError } = await supabase
      .from('session_items')
      .upsert({
        session_id: payload.session_id,
        item_id: payload.item_id,
      }, {
        onConflict: 'session_id,item_id'
      });

    if (sessionItemError) {
      console.error('Failed to create session_item:', sessionItemError);
    }
  }

  return sale;
}

// ================================================================
// ARCHIVE ITEM
// ================================================================

export async function archiveItem(payload: ArchivePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Verify ownership and check for sales
  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, user_id, lifecycle_status')
    .eq('id', payload.item_id)
    .single();

  if (!item || item.user_id !== user.id) {
    throw new Error("Item not found or access denied");
  }

  if (item.lifecycle_status === 'sold') {
    throw new Error("Cannot archive a sold item");
  }

  // Check for existing sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id')
    .eq('item_id', payload.item_id)
    .limit(1);

  if (sales && sales.length > 0) {
    throw new Error("Cannot archive an item with sale records");
  }

  // Archive the item
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      lifecycle_status: 'archived',
      archived_at: new Date().toISOString(),
      archived_reason: payload.reason || 'manual',
      archived_notes: payload.notes || null,
    })
    .eq('id', payload.item_id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to archive item: ${error.message}`);
  }

  return data;
}

// ================================================================
// RESTORE TO ACTIVE
// ================================================================

export async function restoreToActive(itemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Verify ownership
  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, user_id, lifecycle_status')
    .eq('id', itemId)
    .single();

  if (!item || item.user_id !== user.id) {
    throw new Error("Item not found or access denied");
  }

  if (item.lifecycle_status === 'sold') {
    throw new Error("Cannot restore a sold item to active");
  }

  // Check for existing sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id')
    .eq('item_id', itemId)
    .limit(1);

  if (sales && sales.length > 0) {
    throw new Error("Cannot restore an item with sale records");
  }

  // Restore the item
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      lifecycle_status: 'active',
      archived_at: null,
      archived_reason: null,
      archived_notes: null,
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to restore item: ${error.message}`);
  }

  return data;
}

// ================================================================
// GET ACTIVE ITEMS
// ================================================================

export async function getActiveItems(filters?: LyvefolioFilters): Promise<LyvefolioActiveItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  let query = supabase
    .from('inventory_items')
    .select(`
      *,
      sessions(name, created_at)
    `)
    .eq('user_id', user.id)
    .eq('lifecycle_status', 'active');

  // Apply filters
  if (filters?.search) {
    query = query.or(`display_name.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
  }
  
  if (filters?.session_id) {
    query = query.eq('session_id', filters.session_id);
  }

  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  // Sorting
  const sortBy = filters?.sort_by || 'date';
  const sortDir = filters?.sort_direction === 'asc';
  
  switch (sortBy) {
    case 'cost':
      query = query.order('cost_basis', { ascending: sortDir });
      break;
    case 'days_held':
      query = query.order('created_at', { ascending: sortDir });
      break;
    case 'name':
      query = query.order('display_name', { ascending: sortDir });
      break;
    default:
      query = query.order('created_at', { ascending: sortDir });
  }

  // Pagination
  const page = filters?.page || 1;
  const perPage = filters?.per_page || 50;
  const offset = (page - 1) * perPage;
  query = query.range(offset, offset + perPage - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch active items: ${error.message}`);
  }

  // Calculate days_held for each item
  return (data || []).map(item => ({
    ...item,
    session_name: item.sessions?.name || null,
    session_date: item.sessions?.created_at || null,
    days_held: Math.floor(
      (Date.now() - new Date(item.acquisition_date || item.created_at).getTime()) / 
      (1000 * 60 * 60 * 24)
    ),
  }));
}

// ================================================================
// GET SOLD ITEMS
// ================================================================

export async function getSoldItems(filters?: LyvefolioFilters): Promise<LyvefolioSoldItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  let query = supabase
    .from('inventory_items')
    .select(`
      id,
      user_id,
      session_id,
      card_number,
      display_name,
      name,
      image_url,
      cost_basis,
      acquisition_date,
      created_at,
      sessions(name),
      sales(
        id,
        sold_price,
        fees,
        shipping_cost,
        net_revenue,
        sold_at,
        platform_id,
        platform_key,
        buyer_username,
        order_id,
        platforms(display_name)
      )
    `)
    .eq('user_id', user.id)
    .eq('lifecycle_status', 'sold');

  // Apply filters
  if (filters?.search) {
    query = query.or(`display_name.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
  }
  
  if (filters?.session_id) {
    query = query.eq('session_id', filters.session_id);
  }

  if (filters?.platform_id) {
    query = query.eq('sales.platform_id', filters.platform_id);
  }

  // Sorting (default by sold date)
  const sortBy = filters?.sort_by || 'date';
  const sortDir = filters?.sort_direction === 'asc';
  
  switch (sortBy) {
    case 'cost':
      query = query.order('cost_basis', { ascending: sortDir });
      break;
    case 'name':
      query = query.order('display_name', { ascending: sortDir });
      break;
    default:
      query = query.order('created_at', { ascending: !sortDir }); // Default newest first
  }

  // Pagination
  const page = filters?.page || 1;
  const perPage = filters?.per_page || 50;
  const offset = (page - 1) * perPage;
  query = query.range(offset, offset + perPage - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sold items: ${error.message}`);
  }

  // Transform to LyvefolioSoldItem format
  return (data || []).map(item => {
    const sale = Array.isArray(item.sales) ? item.sales[0] : item.sales;
    const sessions = Array.isArray(item.sessions) ? item.sessions[0] : item.sessions;
    const platforms = sale?.platforms ? (Array.isArray(sale.platforms) ? sale.platforms[0] : sale.platforms) : null;
    const costBasis = item.cost_basis || 0;
    const netRevenue = sale?.net_revenue || (sale?.sold_price || 0) - (sale?.fees || 0) - (sale?.shipping_cost || 0);
    const netProfit = netRevenue - costBasis;
    const roiPercent = costBasis > 0 ? Math.round((netProfit / costBasis) * 10000) / 100 : 0;
    const marginPercent = sale?.sold_price > 0 ? Math.round((netProfit / sale.sold_price) * 10000) / 100 : 0;

    return {
      id: item.id,
      user_id: item.user_id,
      session_id: item.session_id,
      card_number: item.card_number,
      display_name: item.display_name,
      name: item.name,
      image_url: item.image_url,
      cost_basis: costBasis,
      acquisition_date: item.acquisition_date,
      item_created_at: item.created_at,
      sale_id: sale?.id || '',
      sold_price: sale?.sold_price || 0,
      fees: sale?.fees || 0,
      shipping_cost: sale?.shipping_cost || 0,
      net_revenue: netRevenue,
      sold_at: sale?.sold_at || item.created_at,
      platform_id: sale?.platform_id || null,
      platform_key: sale?.platform_key || null,
      buyer_username: sale?.buyer_username || null,
      order_id: sale?.order_id || null,
      session_name: sessions?.name || null,
      net_profit: netProfit,
      roi_percent: roiPercent,
      margin_percent: marginPercent,
      platform_name: platforms?.display_name || null,
    };
  });
}

// ================================================================
// GET ARCHIVED ITEMS
// ================================================================

export async function getArchivedItems(filters?: LyvefolioFilters): Promise<LyvefolioArchivedItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  let query = supabase
    .from('inventory_items')
    .select(`
      *,
      sessions(name)
    `)
    .eq('user_id', user.id)
    .eq('lifecycle_status', 'archived');

  // Apply filters
  if (filters?.search) {
    query = query.or(`display_name.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
  }

  // Sorting
  query = query.order('archived_at', { ascending: false, nullsFirst: false });

  // Pagination
  const page = filters?.page || 1;
  const perPage = filters?.per_page || 50;
  const offset = (page - 1) * perPage;
  query = query.range(offset, offset + perPage - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch archived items: ${error.message}`);
  }

  return (data || []).map(item => {
    const sessions = Array.isArray(item.sessions) ? item.sessions[0] : item.sessions;
    return {
      ...item,
      session_name: sessions?.name || null,
      days_held_before_archive: item.archived_at && item.created_at
        ? Math.floor(
            (new Date(item.archived_at).getTime() - new Date(item.acquisition_date || item.created_at).getTime()) / 
            (1000 * 60 * 60 * 24)
          )
        : null,
    };
  });
}

// ================================================================
// GET LYVEFOLIO METRICS
// ================================================================

export async function getLyvefolioMetrics(): Promise<LyvefolioMetrics> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Get active items metrics
  const { data: activeItems } = await supabase
    .from('inventory_items')
    .select('cost_basis, market_value, created_at, acquisition_date')
    .eq('user_id', user.id)
    .eq('lifecycle_status', 'active');

  // Get sold items with sales
  const { data: soldItems } = await supabase
    .from('inventory_items')
    .select(`
      cost_basis,
      sales(sold_price, fees, shipping_cost, net_revenue)
    `)
    .eq('user_id', user.id)
    .eq('lifecycle_status', 'sold');

  // Get archived count
  const { count: archivedCount } = await supabase
    .from('inventory_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('lifecycle_status', 'archived');

  // Get archived cost
  const { data: archivedItems } = await supabase
    .from('inventory_items')
    .select('cost_basis')
    .eq('user_id', user.id)
    .eq('lifecycle_status', 'archived');

  // Calculate active metrics
  const active = activeItems || [];
  const activeCount = active.length;
  const activeTotalCost = active.reduce((sum, item) => sum + (item.cost_basis || 0), 0);
  const activeTotalMarketValue = active.reduce((sum, item) => sum + (item.market_value || item.cost_basis || 0), 0);
  const activeUnrealizedGain = activeTotalMarketValue - activeTotalCost;
  const activeDaysHeld = active.map(item => {
    const acquired = new Date(item.acquisition_date || item.created_at);
    return Math.floor((Date.now() - acquired.getTime()) / (1000 * 60 * 60 * 24));
  });
  const activeAvgDaysHeld = activeDaysHeld.length > 0 
    ? Math.round(activeDaysHeld.reduce((sum, d) => sum + d, 0) / activeDaysHeld.length) 
    : 0;

  // Calculate sold metrics
  const sold = soldItems || [];
  const soldCount = sold.length;
  let soldTotalRevenue = 0;
  let soldTotalCost = 0;
  let soldTotalFees = 0;
  let soldTotalProfit = 0;
  let totalRoi = 0;
  let totalMargin = 0;

  sold.forEach(item => {
    const sale = Array.isArray(item.sales) ? item.sales[0] : item.sales;
    if (sale) {
      const costBasis = item.cost_basis || 0;
      const netRevenue = sale.net_revenue || (sale.sold_price - (sale.fees || 0) - (sale.shipping_cost || 0));
      const profit = netRevenue - costBasis;
      
      soldTotalRevenue += sale.sold_price || 0;
      soldTotalCost += costBasis;
      soldTotalFees += (sale.fees || 0) + (sale.shipping_cost || 0);
      soldTotalProfit += profit;
      
      if (costBasis > 0) totalRoi += (profit / costBasis) * 100;
      if (sale.sold_price > 0) totalMargin += (profit / sale.sold_price) * 100;
    }
  });

  const soldAvgRoi = soldCount > 0 ? Math.round((totalRoi / soldCount) * 100) / 100 : 0;
  const soldAvgMargin = soldCount > 0 ? Math.round((totalMargin / soldCount) * 100) / 100 : 0;

  // Archived metrics
  const archived = archivedItems || [];
  const archivedTotalCost = archived.reduce((sum, item) => sum + (item.cost_basis || 0), 0);

  return {
    active_count: activeCount,
    active_total_cost: Math.round(activeTotalCost * 100) / 100,
    active_total_market_value: Math.round(activeTotalMarketValue * 100) / 100,
    active_unrealized_gain: Math.round(activeUnrealizedGain * 100) / 100,
    active_avg_days_held: activeAvgDaysHeld,
    
    sold_count: soldCount,
    sold_total_revenue: Math.round(soldTotalRevenue * 100) / 100,
    sold_total_cost: Math.round(soldTotalCost * 100) / 100,
    sold_total_fees: Math.round(soldTotalFees * 100) / 100,
    sold_total_profit: Math.round(soldTotalProfit * 100) / 100,
    sold_avg_roi: soldAvgRoi,
    sold_avg_margin: soldAvgMargin,
    
    archived_count: archivedCount || 0,
    archived_total_cost: Math.round(archivedTotalCost * 100) / 100,
  };
}

// ================================================================
// GET SOLD TAB METRICS (filtered)
// ================================================================

export async function getSoldTabMetrics(items: LyvefolioSoldItem[]): Promise<SoldTabMetrics> {
  const totalRevenue = items.reduce((sum, item) => sum + item.sold_price, 0);
  const totalProfit = items.reduce((sum, item) => sum + item.net_profit, 0);
  const totalFees = items.reduce((sum, item) => sum + item.fees + (item.shipping_cost || 0), 0);
  const avgRoi = items.length > 0 
    ? items.reduce((sum, item) => sum + item.roi_percent, 0) / items.length 
    : 0;
  const avgMargin = items.length > 0 
    ? items.reduce((sum, item) => sum + item.margin_percent, 0) / items.length 
    : 0;

  return {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_profit: Math.round(totalProfit * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    avg_roi: Math.round(avgRoi * 100) / 100,
    avg_margin: Math.round(avgMargin * 100) / 100,
    items_count: items.length,
  };
}

// ================================================================
// GET SESSIONS FOR FILTER DROPDOWN
// ================================================================

export async function getSessions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return data || [];
}
