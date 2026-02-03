/**
 * Sessions Service
 * Business logic for livestream session workflow
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Session,
  SessionItem,
  SessionExpense,
  Break,
  SessionOverview,
  PreShowStats,
  SessionPnL,
  ReconcileRow,
  ReconcilePreview,
  ResultsCSVRow,
  AddedVia,
  ExpenseCategory,
} from '@/lib/types/sessions';

// =============================================================================
// SESSION CRUD
// =============================================================================

export async function createSession(
  supabase: SupabaseClient,
  userId: string,
  params: {
    name: string;
    title?: string;
    platform?: string;
    date?: string;
    estimatedFeeRate?: number;
    taxRateDefault?: number;
  }
) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      name: params.name,
      title: params.title || params.name,
      platform: params.platform || 'whatnot',
      date: params.date || new Date().toISOString(),
      estimated_fee_rate: params.estimatedFeeRate ?? 0.12,
      tax_rate_default: params.taxRateDefault ?? 0,
      status: 'DRAFT',
    })
    .select()
    .single();

  return { data, error };
}

export async function getSession(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  return { data: data as Session | null, error };
}

export async function getSessionsOverview(
  supabase: SupabaseClient,
  userId: string,
  filters?: {
    status?: string;
    platform?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<{ data: SessionOverview[] | null; error: Error | null }> {
  let query = supabase
    .from('sessions')
    .select(`
      *,
      session_items(count),
      session_expenses(amount),
      sales(sold_price, fees, net_profit)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.platform) {
    query = query.eq('platform', filters.platform);
  }
  if (filters?.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { data: null, error };
  }

  // Transform to SessionOverview
  const sessions: SessionOverview[] = data.map((s) => {
    const itemCount = (s.session_items as { count: number }[])?.[0]?.count || 0;
    const expenses = (s.session_expenses as { amount: number }[]) || [];
    const sales = (s.sales as { sold_price: number; fees: number; net_profit: number }[]) || [];

    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const soldCount = sales.length;
    const grossRevenue = sales.reduce((sum, sale) => sum + (sale.sold_price || 0), 0);
    const totalFees = sales.reduce((sum, sale) => sum + (sale.fees || 0), 0);
    const netProfit = sales.reduce((sum, sale) => sum + (sale.net_profit || 0), 0);

    return {
      ...s,
      item_count: itemCount,
      total_inventory_cost: 0, // Will need separate query for this
      total_expenses: totalExpenses,
      sold_count: soldCount,
      gross_revenue: grossRevenue,
      total_fees: totalFees,
      net_profit: netProfit,
    } as SessionOverview;
  });

  return { data: sessions, error: null };
}

export async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  updates: Partial<Session>
) {
  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  return { data, error };
}

export async function duplicateSession(
  supabase: SupabaseClient,
  sessionId: string,
  newName: string
) {
  // Get original session
  const { data: original, error: fetchError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (fetchError || !original) {
    return { data: null, error: fetchError };
  }

  // Create new session (copy pre-show data only)
  const { data: newSession, error: createError } = await supabase
    .from('sessions')
    .insert({
      user_id: original.user_id,
      name: newName,
      title: newName,
      platform: original.platform,
      estimated_fee_rate: original.estimated_fee_rate,
      tax_rate_default: original.tax_rate_default,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (createError || !newSession) {
    return { data: null, error: createError };
  }

  // Copy expenses
  const { data: expenses } = await supabase
    .from('session_expenses')
    .select('category, amount, description, notes')
    .eq('session_id', sessionId);

  if (expenses && expenses.length > 0) {
    await supabase.from('session_expenses').insert(
      expenses.map((e) => ({
        session_id: newSession.id,
        category: e.category,
        amount: e.amount,
        description: e.description,
        notes: e.notes,
      }))
    );
  }

  // Copy breaks (without sales)
  const { data: breaks } = await supabase
    .from('breaks')
    .select('title, box_cost, slots_count, estimated_fee_rate, position, notes')
    .eq('session_id', sessionId);

  if (breaks && breaks.length > 0) {
    await supabase.from('breaks').insert(
      breaks.map((b) => ({
        session_id: newSession.id,
        title: b.title,
        box_cost: b.box_cost,
        slots_count: b.slots_count,
        estimated_fee_rate: b.estimated_fee_rate,
        position: b.position,
        notes: b.notes,
      }))
    );
  }

  return { data: newSession, error: null };
}

// =============================================================================
// SESSION ITEMS
// =============================================================================

export async function getSessionItems(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ data: SessionItem[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('session_items')
    .select(`
      *,
      item:inventory_items(
        id, name, display_name, cost_basis, image_url, photo_url, status
      )
    `)
    .eq('session_id', sessionId)
    .order('item_number', { ascending: true, nullsFirst: false });

  return { data: data as SessionItem[] | null, error };
}

export async function addItemToSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  params: {
    itemId?: string;
    newItem?: {
      name: string;
      costBasis: number;
      imageUrl?: string;
      notes?: string;
      certNumber?: string;
      player?: string;
      setName?: string;
      year?: number;
    };
    itemNumber?: number;
    addedVia?: AddedVia;
  }
) {
  let itemId = params.itemId;

  // Get next item number if not provided
  let itemNumber = params.itemNumber;
  if (!itemNumber) {
    const { data: maxItem } = await supabase
      .from('session_items')
      .select('item_number')
      .eq('session_id', sessionId)
      .order('item_number', { ascending: false })
      .limit(1)
      .single();

    itemNumber = (maxItem?.item_number || 0) + 1;
  }

  // Create new item in Lyvefolio if needed
  if (!itemId && params.newItem) {
    const { data: newItem, error: itemError } = await supabase
      .from('inventory_items')
      .insert({
        user_id: userId,
        session_id: sessionId, // For backward compatibility until migration is complete
        card_number: itemNumber, // For backward compatibility until migration is complete
        name: params.newItem.name,
        display_name: params.newItem.name,
        cost_basis: params.newItem.costBasis,
        image_url: params.newItem.imageUrl,
        photo_url: params.newItem.imageUrl,
        notes: params.newItem.notes,
        cert_number: params.newItem.certNumber,
        player: params.newItem.player,
        set_name: params.newItem.setName,
        year: params.newItem.year,
        status: 'ACTIVE',
        lifecycle_status: 'active',
      })
      .select('id')
      .single();

    if (itemError || !newItem) {
      return { data: null, error: itemError };
    }
    itemId = newItem.id;
  }

  if (!itemId) {
    return { data: null, error: new Error('No item provided') };
  }

  // Insert session item
  const { data, error } = await supabase
    .from('session_items')
    .insert({
      session_id: sessionId,
      item_id: itemId,
      item_number: itemNumber,
      position: itemNumber,
      added_via: params.addedVia || 'manual',
    })
    .select()
    .single();

  return { data, error };
}

export async function batchAddItemsToSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  items: Array<{
    name: string;
    costBasis: number;
    imageUrl?: string;
    notes?: string;
  }>,
  startingItemNumber?: number,
  addedVia: AddedVia = 'batch'
) {
  // Get starting item number
  let nextNumber = startingItemNumber;
  if (!nextNumber) {
    const { data: maxItem } = await supabase
      .from('session_items')
      .select('item_number')
      .eq('session_id', sessionId)
      .order('item_number', { ascending: false })
      .limit(1)
      .single();

    nextNumber = (maxItem?.item_number || 0) + 1;
  }

  // Create inventory items
  const inventoryItems = items.map((item, index) => ({
    user_id: userId,
    session_id: sessionId, // For backward compatibility until migration is complete
    card_number: nextNumber! + index, // For backward compatibility until migration is complete
    name: item.name,
    display_name: item.name,
    cost_basis: item.costBasis,
    image_url: item.imageUrl,
    photo_url: item.imageUrl,
    notes: item.notes,
    status: 'ACTIVE',
    lifecycle_status: 'active',
  }));

  const { data: createdItems, error: itemsError } = await supabase
    .from('inventory_items')
    .insert(inventoryItems)
    .select('id');

  if (itemsError || !createdItems) {
    return { data: null, error: itemsError };
  }

  // Link to session
  const sessionItems = createdItems.map((item, index) => ({
    session_id: sessionId,
    item_id: item.id,
    item_number: nextNumber! + index,
    position: nextNumber! + index,
    added_via: addedVia,
  }));

  const { data, error } = await supabase
    .from('session_items')
    .insert(sessionItems)
    .select();

  return { data, error };
}

export async function removeItemFromSession(
  supabase: SupabaseClient,
  sessionId: string,
  sessionItemId: string
) {
  const { error } = await supabase
    .from('session_items')
    .delete()
    .eq('id', sessionItemId)
    .eq('session_id', sessionId);

  return { error };
}

export async function updateItemOrder(
  supabase: SupabaseClient,
  sessionId: string,
  updates: Array<{ id: string; itemNumber: number; position: number }>
) {
  // Update each item
  for (const update of updates) {
    await supabase
      .from('session_items')
      .update({
        item_number: update.itemNumber,
        position: update.position,
      })
      .eq('id', update.id)
      .eq('session_id', sessionId);
  }

  return { error: null };
}

// =============================================================================
// EXPENSES
// =============================================================================

export async function getSessionExpenses(
  supabase: SupabaseClient,
  sessionId: string
) {
  const { data, error } = await supabase
    .from('session_expenses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  return { data: data as SessionExpense[] | null, error };
}

export async function addSessionExpense(
  supabase: SupabaseClient,
  sessionId: string,
  expense: {
    category: ExpenseCategory;
    amount: number;
    description?: string;
    notes?: string;
  }
) {
  const { data, error } = await supabase
    .from('session_expenses')
    .insert({
      session_id: sessionId,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      notes: expense.notes,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateSessionExpense(
  supabase: SupabaseClient,
  expenseId: string,
  updates: Partial<SessionExpense>
) {
  const { data, error } = await supabase
    .from('session_expenses')
    .update(updates)
    .eq('id', expenseId)
    .select()
    .single();

  return { data, error };
}

export async function deleteSessionExpense(
  supabase: SupabaseClient,
  expenseId: string
) {
  const { error } = await supabase
    .from('session_expenses')
    .delete()
    .eq('id', expenseId);

  return { error };
}

// =============================================================================
// BREAKS
// =============================================================================

export async function getSessionBreaks(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from('breaks')
    .select(`
      *,
      break_slot_sales(*)
    `)
    .eq('session_id', sessionId)
    .order('position', { ascending: true, nullsFirst: false });

  return { data: data as Break[] | null, error };
}

export async function addBreak(
  supabase: SupabaseClient,
  sessionId: string,
  params: {
    title: string;
    boxCost: number;
    slotsCount: number;
    estimatedFeeRate?: number;
    position?: number;
    notes?: string;
  }
) {
  // Get next position if not provided
  let position = params.position;
  if (!position) {
    const { data: maxBreak } = await supabase
      .from('breaks')
      .select('position')
      .eq('session_id', sessionId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    position = (maxBreak?.position || 0) + 1;
  }

  const { data, error } = await supabase
    .from('breaks')
    .insert({
      session_id: sessionId,
      title: params.title,
      box_cost: params.boxCost,
      slots_count: params.slotsCount,
      estimated_fee_rate: params.estimatedFeeRate,
      position,
      notes: params.notes,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateBreak(
  supabase: SupabaseClient,
  breakId: string,
  updates: Partial<Break>
) {
  const { data, error } = await supabase
    .from('breaks')
    .update(updates)
    .eq('id', breakId)
    .select()
    .single();

  return { data, error };
}

export async function deleteBreak(supabase: SupabaseClient, breakId: string) {
  const { error } = await supabase.from('breaks').delete().eq('id', breakId);
  return { error };
}

// =============================================================================
// PRE-SHOW STATISTICS
// =============================================================================

export async function getPreShowStats(
  supabase: SupabaseClient,
  sessionId: string
): Promise<PreShowStats> {
  // Get session
  const { data: session } = await supabase
    .from('sessions')
    .select('estimated_fee_rate')
    .eq('id', sessionId)
    .single();

  const feeRate = session?.estimated_fee_rate || 0.12;

  // Get items with cost
  const { data: items } = await supabase
    .from('session_items')
    .select('item:inventory_items(cost_basis)')
    .eq('session_id', sessionId);

  const totalItems = items?.length || 0;
  const totalInventoryCost = items?.reduce(
    (sum, si) => {
      const item = si.item as unknown as { cost_basis: number } | null;
      return sum + (item?.cost_basis || 0);
    },
    0
  ) || 0;

  // Get expenses
  const { data: expenses } = await supabase
    .from('session_expenses')
    .select('amount')
    .eq('session_id', sessionId);

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  // Get breaks
  const { data: breaks } = await supabase
    .from('breaks')
    .select('*')
    .eq('session_id', sessionId);

  const breakStats = (breaks || []).map((b) => {
    const breakFeeRate = b.estimated_fee_rate ?? feeRate;
    const breakevenTotal = b.box_cost / (1 - breakFeeRate);
    const breakevenPerSlot = breakevenTotal / b.slots_count;

    return {
      id: b.id,
      title: b.title,
      box_cost: b.box_cost,
      slots_count: b.slots_count,
      fee_rate: breakFeeRate,
      breakeven_total: Math.round(breakevenTotal * 100) / 100,
      breakeven_per_slot: Math.round(breakevenPerSlot * 100) / 100,
    };
  });

  const totalBreakCosts = breaks?.reduce((sum, b) => sum + (b.box_cost || 0), 0) || 0;
  const totalPlannedOutlay = totalInventoryCost + totalExpenses + totalBreakCosts;

  // Breakeven calculations
  const breakevenRevenue = totalPlannedOutlay / (1 - feeRate);
  const breakevenAvgPerCard = totalItems > 0 ? breakevenRevenue / totalItems : 0;

  return {
    total_items: totalItems,
    total_inventory_cost: Math.round(totalInventoryCost * 100) / 100,
    totalInventoryCost: Math.round(totalInventoryCost * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    total_breaks_cost: totalBreakCosts,
    totalBreaksCost: totalBreakCosts,
    total_planned_outlay: Math.round(totalPlannedOutlay * 100) / 100,
    estimated_fee_rate: feeRate,
    breakeven_revenue: Math.round(breakevenRevenue * 100) / 100,
    breakevenRevenue: Math.round(breakevenRevenue * 100) / 100,
    breakeven_avg_per_card: Math.round(breakevenAvgPerCard * 100) / 100,
    breaks: breakStats,
  };
}

// =============================================================================
// SESSION FINALIZATION
// =============================================================================

export async function finalizeSession(supabase: SupabaseClient, sessionId: string) {
  // Validate all items have cost basis
  const { data: items } = await supabase
    .from('session_items')
    .select('item:inventory_items(cost_basis)')
    .eq('session_id', sessionId);

  const missingCosts = items?.filter(
    (si) => {
      const item = si.item as unknown as { cost_basis: number } | null;
      return !item?.cost_basis;
    }
  );

  if (missingCosts && missingCosts.length > 0) {
    return {
      data: null,
      error: new Error(`${missingCosts.length} items are missing cost basis`),
    };
  }

  // Update session status
  const { data, error } = await supabase
    .from('sessions')
    .update({
      status: 'FINALIZED',
      finalized_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  return { data, error };
}

export async function unlockSession(
  supabase: SupabaseClient,
  sessionId: string,
  reason?: string
) {
  const { data, error } = await supabase
    .from('sessions')
    .update({
      status: 'DRAFT',
      finalized_at: null,
    })
    .eq('id', sessionId)
    .select()
    .single();

  // Could log the unlock reason somewhere
  console.log(`Session ${sessionId} unlocked. Reason: ${reason || 'Not specified'}`);

  return { data, error };
}

// =============================================================================
// POST-SHOW RECONCILIATION
// =============================================================================

export function parseResultsCSV(
  csvText: string,
  options?: { hasHeader?: boolean }
): { rows: ResultsCSVRow[]; errors: string[] } {
  const lines = csvText.trim().split('\n');
  const errors: string[] = [];
  const rows: ResultsCSVRow[] = [];

  if (lines.length === 0) {
    return { rows: [], errors: ['Empty CSV file'] };
  }

  // Parse header
  const hasHeader = options?.hasHeader ?? true;
  const headerLine = hasHeader ? lines[0] : null;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Detect columns from header
  const columns = headerLine?.split(',').map((c) => c.trim().toLowerCase()) || [];

  // Column mapping (flexible)
  const colMap = {
    itemNumber: columns.findIndex(
      (c) => c.includes('item') && (c.includes('number') || c.includes('#')) || c === 'lot'
    ),
    soldPrice: columns.findIndex(
      (c) => c.includes('sold') || c.includes('price') || c.includes('amount') || c.includes('total')
    ),
    fees: columns.findIndex((c) => c.includes('fee')),
    taxes: columns.findIndex((c) => c.includes('tax')),
    shipping: columns.findIndex((c) => c.includes('ship')),
    soldAt: columns.findIndex((c) => c.includes('date') || c.includes('sold_at')),
    channel: columns.findIndex((c) => c.includes('channel') || c.includes('platform')),
    buyer: columns.findIndex((c) => c.includes('buyer') || c.includes('customer')),
    name: columns.findIndex((c) => c.includes('name') || c.includes('title') || c.includes('description')),
  };

  dataLines.forEach((line, index) => {
    if (!line.trim()) return;

    const values = line.split(',').map((v) => v.trim());

    const row: ResultsCSVRow = {
      sold_price: 0,
    };

    // Extract values using column map
    if (colMap.itemNumber >= 0) {
      const val = parseInt(values[colMap.itemNumber]);
      if (!isNaN(val)) row.item_number = val;
    }

    if (colMap.soldPrice >= 0) {
      const val = parseFloat(values[colMap.soldPrice]?.replace(/[$,]/g, ''));
      if (!isNaN(val)) row.sold_price = val;
      else {
        errors.push(`Row ${index + 1}: Invalid sold_price`);
        return;
      }
    } else {
      // Try first numeric column
      for (let i = 0; i < values.length; i++) {
        const val = parseFloat(values[i]?.replace(/[$,]/g, ''));
        if (!isNaN(val) && val > 0) {
          row.sold_price = val;
          break;
        }
      }
    }

    if (colMap.fees >= 0) {
      const val = parseFloat(values[colMap.fees]?.replace(/[$,]/g, ''));
      if (!isNaN(val)) row.fees = val;
    }

    if (colMap.taxes >= 0) {
      const val = parseFloat(values[colMap.taxes]?.replace(/[$,]/g, ''));
      if (!isNaN(val)) row.taxes = val;
    }

    if (colMap.shipping >= 0) {
      const val = parseFloat(values[colMap.shipping]?.replace(/[$,]/g, ''));
      if (!isNaN(val)) row.shipping = val;
    }

    if (colMap.soldAt >= 0) {
      row.sold_at = values[colMap.soldAt];
    }

    if (colMap.channel >= 0) {
      row.channel = values[colMap.channel];
    }

    if (colMap.buyer >= 0) {
      row.buyer = values[colMap.buyer];
    }

    if (colMap.name >= 0) {
      row.name = values[colMap.name];
    }

    rows.push(row);
  });

  return { rows, errors };
}

export async function createReconcilePreview(
  supabase: SupabaseClient,
  sessionId: string,
  csvRows: ResultsCSVRow[],
  options?: {
    matchByRowOrder?: boolean;
    shiftRows?: number;
  }
): Promise<ReconcilePreview> {
  const warnings: string[] = [];
  const shift = options?.shiftRows || 0;

  // Get session items
  const { data: sessionItems } = await supabase
    .from('session_items')
    .select(`
      id,
      item_number,
      item_id,
      item:inventory_items(id, name, display_name, cost_basis, image_url, photo_url)
    `)
    .eq('session_id', sessionId)
    .order('item_number', { ascending: true });

  if (!sessionItems || sessionItems.length === 0) {
    return {
      rows: [],
      unmatchedCSVRows: csvRows.map((_, i) => i),
      totalMatched: 0,
      totalUnmatched: csvRows.length,
      totalUnsold: 0,
      soldCount: 0,
      unsoldCount: 0,
      totalRevenue: 0,
      totalCOGS: 0,
      totalFees: 0,
      netProfit: 0,
      warnings: ['No items in session'],
    };
  }

  // Get existing sales for this session to detect duplicates
  const { data: existingSales } = await supabase
    .from('sales')
    .select('item_id')
    .eq('session_id', sessionId);

  const alreadySoldItemIds = new Set((existingSales || []).map((s) => s.item_id));

  // Build reconcile rows
  const rows: ReconcileRow[] = [];
  const matchedCSVIndices = new Set<number>();

  for (const si of sessionItems) {
    const item = si.item as unknown as {
      id: string;
      name: string | null;
      display_name: string | null;
      cost_basis: number;
      image_url: string | null;
      photo_url: string | null;
    } | null;

    const row: ReconcileRow = {
      sessionItemId: si.id,
      itemNumber: si.item_number,
      itemId: si.item_id,
      itemName: item?.name || item?.display_name || `Item ${si.item_number}`,
      costBasis: item?.cost_basis || 0,
      imageUrl: item?.image_url || item?.photo_url || null,
      csvRowIndex: null,
      soldPrice: null,
      fees: null,
      taxes: null,
      shipping: null,
      netProfit: null,
      matchConfidence: 'none',
      matchMethod: null,
      status: 'unsold',
    };

    // Check if already sold
    if (alreadySoldItemIds.has(si.item_id)) {
      row.status = 'conflict';
      warnings.push(`Item ${si.item_number} was already marked as sold`);
      rows.push(row);
      continue;
    }

    // Try to match by item_number first
    let matchedIndex = csvRows.findIndex(
      (csv, idx) => !matchedCSVIndices.has(idx) && csv.item_number === si.item_number
    );

    if (matchedIndex >= 0) {
      row.matchMethod = 'item_number';
      row.matchConfidence = 'high';
    } else if (options?.matchByRowOrder) {
      // Try row order matching with shift
      const rowOrderIndex = si.item_number - 1 + shift;
      if (rowOrderIndex >= 0 && rowOrderIndex < csvRows.length && !matchedCSVIndices.has(rowOrderIndex)) {
        matchedIndex = rowOrderIndex;
        row.matchMethod = 'row_order';
        row.matchConfidence = 'medium';
      }
    }

    if (matchedIndex >= 0) {
      const csvRow = csvRows[matchedIndex];
      matchedCSVIndices.add(matchedIndex);

      row.csvRowIndex = matchedIndex;
      row.soldPrice = csvRow.sold_price;
      row.fees = csvRow.fees ?? 0;
      row.taxes = csvRow.taxes ?? 0;
      row.shipping = csvRow.shipping ?? 0;
      row.netProfit =
        csvRow.sold_price - (csvRow.fees || 0) - (csvRow.taxes || 0) - (csvRow.shipping || 0) - (row.costBasis || 0);
      row.status = 'matched';
    }

    rows.push(row);
  }

  // Find unmatched CSV rows
  const unmatchedCSVRows = csvRows
    .map((_, idx) => idx)
    .filter((idx) => !matchedCSVIndices.has(idx));

  if (unmatchedCSVRows.length > 0) {
    warnings.push(`${unmatchedCSVRows.length} CSV rows could not be matched to items`);
  }

  const matchedRows = rows.filter((r) => r.status === 'matched');
  const totalRevenue = matchedRows.reduce((sum, r) => sum + (r.soldPrice || 0), 0);
  const totalCOGS = matchedRows.reduce((sum, r) => sum + (r.costBasis || 0), 0);
  const totalFees = matchedRows.reduce((sum, r) => sum + (r.fees || 0), 0);
  const netProfit = matchedRows.reduce((sum, r) => sum + (r.netProfit || 0), 0);

  return {
    rows,
    unmatchedCSVRows,
    totalMatched: matchedRows.length,
    totalUnmatched: unmatchedCSVRows.length,
    totalUnsold: rows.filter((r) => r.status === 'unsold').length,
    soldCount: matchedRows.length,
    unsoldCount: rows.filter((r) => r.status === 'unsold').length,
    totalRevenue,
    totalCOGS,
    totalFees,
    netProfit,
    warnings,
  };
}

export async function applyReconciliation(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  rows: ReconcileRow[],
  options?: {
    defaultChannel?: string;
    defaultFeeRate?: number;
  }
) {
  const results = {
    salesCreated: 0,
    itemsUpdated: 0,
    errors: [] as string[],
  };

  for (const row of rows) {
    if (row.status !== 'matched' || row.soldPrice === null) {
      continue;
    }

    try {
      // Calculate fees if not provided
      let fees = row.fees ?? 0;
      if (fees === 0 && options?.defaultFeeRate && row.soldPrice !== undefined && row.soldPrice !== null) {
        fees = row.soldPrice * options.defaultFeeRate;
      }

      const netProfit =
        (row.soldPrice || 0) - fees - (row.taxes || 0) - (row.shipping || 0) - (row.costBasis || 0);

      // Create sale record
      const { error: saleError } = await supabase.from('sales').insert({
        user_id: userId,
        item_id: row.itemId,
        session_id: sessionId,
        channel: options?.defaultChannel || 'whatnot',
        sold_price: row.soldPrice,
        fees: Math.round(fees * 100) / 100,
        taxes: row.taxes || 0,
        shipping: row.shipping || 0,
        net_profit: Math.round(netProfit * 100) / 100,
        sold_at: new Date().toISOString(),
      });

      if (saleError) {
        results.errors.push(`Failed to create sale for item ${row.itemNumber}: ${saleError.message}`);
        continue;
      }

      results.salesCreated++;

      // Update item status to SOLD
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          status: 'SOLD',
          lifecycle_status: 'sold',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.itemId);

      if (updateError) {
        results.errors.push(`Failed to update item ${row.itemNumber} status: ${updateError.message}`);
      } else {
        results.itemsUpdated++;
      }
    } catch (err) {
      results.errors.push(`Error processing item ${row.itemNumber}: ${err}`);
    }
  }

  // Update session status to RECONCILED
  if (results.errors.length === 0) {
    await supabase
      .from('sessions')
      .update({
        status: 'RECONCILED',
        reconciled_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  return results;
}

// =============================================================================
// SESSION P&L
// =============================================================================

export async function getSessionPnL(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionPnL> {
  // Get items
  const { data: items } = await supabase
    .from('session_items')
    .select('item_id')
    .eq('session_id', sessionId);

  const totalItems = items?.length || 0;

  // Get sales
  const { data: sales } = await supabase
    .from('sales')
    .select(`
      sold_price,
      fees,
      taxes,
      shipping,
      net_profit,
      item:inventory_items(name, display_name, cost_basis)
    `)
    .eq('session_id', sessionId);

  const soldCount = sales?.length || 0;
  const grossRevenue = sales?.reduce((sum, s) => sum + (s.sold_price || 0), 0) || 0;
  const totalFees = sales?.reduce((sum, s) => sum + (s.fees || 0), 0) || 0;
  const totalTaxes = sales?.reduce((sum, s) => sum + (s.taxes || 0), 0) || 0;
  const totalShipping = sales?.reduce((sum, s) => sum + (s.shipping || 0), 0) || 0;
  const totalCogs = sales?.reduce(
    (sum, s) => {
      const item = s.item as unknown as { cost_basis: number } | null;
      return sum + (item?.cost_basis || 0);
    },
    0
  ) || 0;

  // Get expenses
  const { data: expenses } = await supabase
    .from('session_expenses')
    .select('amount')
    .eq('session_id', sessionId);

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  const netProfit = grossRevenue - totalFees - totalTaxes - totalShipping - totalCogs - totalExpenses;
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
  const sellThroughRate = totalItems > 0 ? (soldCount / totalItems) * 100 : 0;
  const avgProfitPerItem = soldCount > 0 ? netProfit / soldCount : 0;

  // Find best and worst items
  let bestItem = null;
  let worstItem = null;

  if (sales && sales.length > 0) {
    const sorted = [...sales].sort((a, b) => (b.net_profit || 0) - (a.net_profit || 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const bestItemData = best.item as unknown as { name: string; display_name: string } | null;
    const worstItemData = worst.item as unknown as { name: string; display_name: string } | null;

    bestItem = {
      name: bestItemData?.name || bestItemData?.display_name || 'Unknown',
      profit: best.net_profit || 0,
    };

    worstItem = {
      name: worstItemData?.name || worstItemData?.display_name || 'Unknown',
      profit: worst.net_profit || 0,
    };
  }

  return {
    total_items: totalItems,
    sold_count: soldCount,
    soldCount: soldCount,
    unsoldCount: totalItems - soldCount,
    gross_revenue: Math.round(grossRevenue * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    total_taxes: Math.round(totalTaxes * 100) / 100,
    totalTaxes: Math.round(totalTaxes * 100) / 100,
    total_shipping: Math.round(totalShipping * 100) / 100,
    totalShipping: Math.round(totalShipping * 100) / 100,
    total_cogs: Math.round(totalCogs * 100) / 100,
    totalCOGS: Math.round(totalCogs * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    net_profit: Math.round(netProfit * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profit_margin: Math.round(profitMargin * 10) / 10,
    profitMargin: Math.round(profitMargin * 10) / 10,
    sell_through_rate: Math.round(sellThroughRate * 10) / 10,
    sellThroughRate: Math.round(sellThroughRate * 10) / 10,
    avg_profit_per_item: Math.round(avgProfitPerItem * 100) / 100,
    best_item: bestItem,
    worst_item: worstItem,
  };
}
