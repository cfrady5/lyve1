/**
 * Session Service
 * Handles session rollups, breakeven calculations, and workflow state management
 */

import { createClient } from '@/lib/supabase/client';

export interface SessionRollups {
  itemsLoaded: number;
  itemsSold: number;
  itemsUnsold: number;
  inventoryCost: number;
  expenses: number;
  breakCosts: number;
  grossRevenue: number;
  totalFees: number;
  totalTaxes: number;
  totalShipping: number;
  cogs: number;
  netProfit: number;
  profitMargin: number;
  sellThroughRate: number;
  avgProfitPerSold: number;
}

export interface BreakevenCalculation {
  totalInventoryCost: number;
  totalExpenses: number;
  totalBreakCosts: number;
  totalPlannedOutlay: number;
  estimatedFeeRate: number;
  breakevenRevenue: number;
  breakevenAvgPerCard: number;
  breakevenAvgPerItem: number; // Alias for clarity
}

export interface SessionExpense {
  id?: string;
  session_id: string;
  category: 'supplies' | 'shipping_materials' | 'promo' | 'show_fee' | 'travel' | 'misc';
  amount: number;
  description?: string;
  notes?: string;
}

export interface Break {
  id?: string;
  session_id: string;
  title: string;
  box_cost: number;
  slots_count: number;
  estimated_fee_rate?: number;
  position?: number;
}

export interface BreakBreakeven {
  breakId: string;
  title: string;
  boxCost: number;
  slotsCount: number;
  feeRate: number;
  breakevenTotal: number;
  breakevenPerSlot: number;
}

/**
 * Calculate comprehensive session rollups including P&L
 */
export async function calculateSessionRollups(
  sessionId: string
): Promise<SessionRollups> {
  const supabase = createClient();

  // Fetch session items count
  const { data: sessionItems } = await supabase
    .from('session_items')
    .select('item_id, inventory_items!inner(cost_basis)')
    .eq('session_id', sessionId);

  const itemsLoaded = sessionItems?.length || 0;

  // Fetch sales for this session
  const { data: sales } = await supabase
    .from('sales')
    .select('sold_price, fees, taxes_collected, shipping_cost, item_id, inventory_items!inner(cost_basis)')
    .eq('session_id', sessionId);

  const itemsSold = sales?.length || 0;
  const itemsUnsold = itemsLoaded - itemsSold;

  // Calculate inventory cost (sum cost_basis of all session items)
  const inventoryCost = sessionItems?.reduce(
    (sum, si) => {
      const itemData = Array.isArray(si.inventory_items) ? si.inventory_items[0] : si.inventory_items;
      return sum + (itemData?.cost_basis || 0);
    },
    0
  ) || 0;

  // Fetch expenses
  const { data: expenses } = await supabase
    .from('session_expenses')
    .select('amount')
    .eq('session_id', sessionId);

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  // Fetch breaks
  const { data: breaks } = await supabase
    .from('breaks')
    .select('box_cost')
    .eq('session_id', sessionId);

  const breakCosts = breaks?.reduce((sum, b) => sum + (b.box_cost || 0), 0) || 0;

  // Calculate sales metrics
  const grossRevenue = sales?.reduce((sum, s) => sum + (s.sold_price || 0), 0) || 0;
  const totalFees = sales?.reduce((sum, s) => sum + (s.fees || 0), 0) || 0;
  const totalTaxes = sales?.reduce((sum, s) => sum + (s.taxes_collected || 0), 0) || 0;
  const totalShipping = sales?.reduce((sum, s) => sum + (s.shipping_cost || 0), 0) || 0;

  // COGS = sum of cost_basis for sold items
  const cogs = sales?.reduce(
    (sum, s) => {
      const itemData = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
      return sum + (itemData?.cost_basis || 0);
    },
    0
  ) || 0;

  // Net Profit = Revenue - Fees - Taxes - Shipping - COGS - Expenses
  const netProfit =
    grossRevenue - totalFees - totalTaxes - totalShipping - cogs - totalExpenses - breakCosts;

  // Profit Margin = (Net Profit / Gross Revenue) * 100
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  // Sell-through Rate = (Sold / Loaded) * 100
  const sellThroughRate = itemsLoaded > 0 ? (itemsSold / itemsLoaded) * 100 : 0;

  // Avg Profit Per Sold Item
  const avgProfitPerSold = itemsSold > 0 ? netProfit / itemsSold : 0;

  return {
    itemsLoaded,
    itemsSold,
    itemsUnsold,
    inventoryCost,
    expenses: totalExpenses,
    breakCosts,
    grossRevenue,
    totalFees,
    totalTaxes,
    totalShipping,
    cogs,
    netProfit,
    profitMargin,
    sellThroughRate,
    avgProfitPerSold,
  };
}

/**
 * Calculate breakeven revenue for a session
 */
export async function calculateBreakeven(
  sessionId: string
): Promise<BreakevenCalculation> {
  const supabase = createClient();

  // Get session to retrieve estimated fee rate
  const { data: session } = await supabase
    .from('sessions')
    .select('estimated_fee_rate')
    .eq('id', sessionId)
    .single();

  const estimatedFeeRate = session?.estimated_fee_rate || 0.08; // Default 8%

  // Get inventory cost (sum cost_basis of session items)
  const { data: sessionItems } = await supabase
    .from('session_items')
    .select('item_id, inventory_items!inner(cost_basis)')
    .eq('session_id', sessionId);

  const totalInventoryCost = sessionItems?.reduce(
    (sum, si) => {
      const itemData = Array.isArray(si.inventory_items) ? si.inventory_items[0] : si.inventory_items;
      return sum + (itemData?.cost_basis || 0);
    },
    0
  ) || 0;

  const itemCount = sessionItems?.length || 0;

  // Get expenses
  const { data: expenses } = await supabase
    .from('session_expenses')
    .select('amount')
    .eq('session_id', sessionId);

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  // Get break costs
  const { data: breaks } = await supabase
    .from('breaks')
    .select('box_cost')
    .eq('session_id', sessionId);

  const totalBreakCosts = breaks?.reduce((sum, b) => sum + (b.box_cost || 0), 0) || 0;

  // Total Planned Outlay = Inventory + Expenses + Break Costs
  const totalPlannedOutlay = totalInventoryCost + totalExpenses + totalBreakCosts;

  // Breakeven Revenue = Total Outlay / (1 - Fee Rate)
  // This is the revenue needed to cover all costs after fees
  const breakevenRevenue =
    estimatedFeeRate < 1 ? totalPlannedOutlay / (1 - estimatedFeeRate) : totalPlannedOutlay;

  // Breakeven Avg Per Card/Item
  const breakevenAvgPerCard = itemCount > 0 ? breakevenRevenue / itemCount : 0;

  return {
    totalInventoryCost,
    totalExpenses,
    totalBreakCosts,
    totalPlannedOutlay,
    estimatedFeeRate,
    breakevenRevenue,
    breakevenAvgPerCard,
    breakevenAvgPerItem: breakevenAvgPerCard, // Alias
  };
}

/**
 * Calculate breakeven for individual breaks
 */
export async function calculateBreakBreakevens(
  sessionId: string
): Promise<BreakBreakeven[]> {
  const supabase = createClient();

  // Get session fee rate
  const { data: session } = await supabase
    .from('sessions')
    .select('estimated_fee_rate')
    .eq('id', sessionId)
    .single();

  const sessionFeeRate = session?.estimated_fee_rate || 0.08;

  // Get all breaks
  const { data: breaks } = await supabase
    .from('breaks')
    .select('id, title, box_cost, slots_count, estimated_fee_rate')
    .eq('session_id', sessionId);

  if (!breaks || breaks.length === 0) {
    return [];
  }

  return breaks.map((brk) => {
    const feeRate = brk.estimated_fee_rate ?? sessionFeeRate;
    const breakevenTotal = feeRate < 1 ? brk.box_cost / (1 - feeRate) : brk.box_cost;
    const breakevenPerSlot = brk.slots_count > 0 ? breakevenTotal / brk.slots_count : 0;

    return {
      breakId: brk.id,
      title: brk.title,
      boxCost: brk.box_cost,
      slotsCount: brk.slots_count,
      feeRate,
      breakevenTotal,
      breakevenPerSlot,
    };
  });
}

/**
 * Finalize a session (lock run order)
 */
export async function finalizeSession(sessionId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'FINALIZED',
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to finalize session: ${error.message}`);
  }
}

/**
 * Unfinalize a session (unlock run order)
 */
export async function unfinalizeSession(sessionId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'DRAFT',
      finalized_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to unfinalize session: ${error.message}`);
  }
}

/**
 * Add expense to session
 */
export async function addSessionExpense(expense: SessionExpense): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('session_expenses')
    .insert([expense])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to add expense: ${error.message}`);
  }

  return data.id;
}

/**
 * Delete session expense
 */
export async function deleteSessionExpense(expenseId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('session_expenses')
    .delete()
    .eq('id', expenseId);

  if (error) {
    throw new Error(`Failed to delete expense: ${error.message}`);
  }
}

/**
 * Add break to session
 */
export async function addBreak(breakData: Break): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('breaks')
    .insert([breakData])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to add break: ${error.message}`);
  }

  return data.id;
}

/**
 * Delete break
 */
export async function deleteBreak(breakId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('breaks')
    .delete()
    .eq('id', breakId);

  if (error) {
    throw new Error(`Failed to delete break: ${error.message}`);
  }
}

/**
 * Update session estimated fee rate
 */
export async function updateSessionFeeRate(
  sessionId: string,
  feeRate: number
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      estimated_fee_rate: feeRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to update fee rate: ${error.message}`);
  }
}
