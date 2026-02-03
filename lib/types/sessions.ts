// ================================================================
// SESSION TYPES
// ================================================================

export type ShowType = 'singles_only' | 'breaks_only' | 'mixed';

export type SessionStatus = 'DRAFT' | 'FINALIZED' | 'RECONCILED';

export type Platform = 'whatnot' | 'ebay' | 'instagram' | 'show' | 'other';
export type SessionPlatform = Platform; // Alias for backward compatibility

export interface Session {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  date?: string;
  platform: Platform;
  status: SessionStatus;
  show_type: ShowType;
  estimated_fee_rate: number;
  tax_rate_default?: number;
  profit_target_amount?: number;
  profit_target_percent?: number;
  revenue_allocation_singles_percent?: number;
  sell_through_singles_percent?: number;
  sell_through_breaks_percent?: number;
  finalized_at?: string;
  reconciled_at?: string;
  created_at: string;
  updated_at?: string;
}

// ================================================================
// BREAK TYPES
// ================================================================

export type BreakStyle = 'pyt' | 'pyp' | 'random_drafted';

export type BreakType = 'single_product' | 'mixer';

export type SpotType = 'team_30' | 'three_team_10' | 'custom';

export type SpotConfigType = 'TEAM_30' | 'THREE_TEAM_10' | 'CUSTOM';

export type ExpenseAllocationMethod = 'pro_rata_cost' | 'equal_per_break' | 'manual';

export interface Break {
  id: string;
  session_id: string;
  title: string;
  break_style: BreakStyle;
  break_type: BreakType;
  box_cost: number;
  spot_count: number;
  spot_type?: SpotType;
  spot_config_type?: SpotConfigType;
  teams_count?: number;
  players_count?: number;
  estimated_fee_rate?: number;
  profit_target_amount?: number;
  include_expenses_allocation?: boolean;
  expenses_allocation_method?: ExpenseAllocationMethod;
  manual_allocated_expense?: number;
  position?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface BreakBox {
  id: string;
  break_id: string;
  box_name?: string; // Legacy field
  product_name?: string;
  quantity: number;
  price_paid_per_box: number;
  box_cost: number; // Legacy field
  total_cost?: number; // Computed field
  position: number;
  created_at: string;
  updated_at?: string;
}

export interface BreakBreakevenResult {
  box_cost: number;
  allocated_expenses: number;
  profit_target: number;
  fee_rate: number;
  required_revenue: number;
  spot_count: number;
  required_per_spot: number;
}

// ================================================================
// EXPENSE TYPES
// ================================================================

export type ExpenseCategory =
  | 'logistics_supplies'
  | 'shipping_materials'
  | 'grading_auth'
  | 'payroll'
  | 'promo'
  | 'show_fee'
  | 'travel'
  | 'misc'
  | 'supplies'; // Legacy alias for logistics_supplies

export interface PayrollMetadata {
  breakers: number;
  hourly_rate: number;
  hours: number;
}

export interface SessionExpense {
  id: string;
  session_id: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  notes?: string;
  metadata?: PayrollMetadata | Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

// ================================================================
// SESSION ITEM TYPES
// ================================================================

export type AddedVia = 'photo' | 'preshow_csv' | 'manual' | 'batch';

export interface SessionItem {
  id: string;
  session_id: string;
  item_id: string;
  item_number: number;
  position: number;
  added_via: AddedVia;
  created_at: string;
  updated_at?: string;
  item?: {
    id: string;
    name?: string;
    display_name?: string;
    cost_basis: number;
    image_url?: string;
    photo_url?: string;
    status: string;
  };
}

// ================================================================
// BREAKEVEN CALCULATION TYPES
// ================================================================

export interface BreakevenCalculation {
  total_inventory_cost: number;
  total_break_cost: number;
  total_expenses: number;
  total_outlay: number;
  profit_target: number;
  estimated_fee_rate: number;
  breakeven_revenue: number;
}

export interface BreakevenTargets {
  // For singles
  required_avg_per_card?: number;
  required_avg_per_sold_card?: number;

  // For breaks
  required_revenue_breaks?: number;
  required_per_spot?: number;
  breaks_detail?: Array<{
    break_id: string;
    title: string;
    required_per_spot: number;
    spot_count: number;
  }>;

  // For mixed
  revenue_allocation_singles?: number;
  revenue_allocation_breaks?: number;
}

// ================================================================
// LABELS AND CONSTANTS
// ================================================================

export const SHOW_TYPE_LABELS: Record<ShowType, string> = {
  singles_only: 'Singles Only',
  breaks_only: 'Breaks Only',
  mixed: 'Mixed (Singles + Breaks)',
};

export const BREAK_STYLE_LABELS: Record<BreakStyle, string> = {
  pyt: 'PYT (Pick Your Team)',
  pyp: 'PYP (Pick Your Player)',
  random_drafted: 'Random / Drafted',
};

export const BREAK_TYPE_LABELS: Record<BreakType, string> = {
  single_product: 'Single Product',
  mixer: 'Mixer',
};

export const SPOT_TYPE_LABELS: Record<SpotType, string> = {
  team_30: 'Team Spot (30)',
  three_team_10: '3-Team Spot (10)',
  custom: 'Custom',
};

export const SPOT_CONFIG_TYPE_LABELS: Record<SpotConfigType, string> = {
  TEAM_30: 'Team Spots (30)',
  THREE_TEAM_10: '3-Team Spots (10)',
  CUSTOM: 'Custom Spots',
};

export const EXPENSE_ALLOCATION_METHOD_LABELS: Record<ExpenseAllocationMethod, string> = {
  pro_rata_cost: 'Pro-rata by Cost',
  equal_per_break: 'Equal per Break',
  manual: 'Manual',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  logistics_supplies: 'Logistics & Supplies',
  shipping_materials: 'Shipping Materials',
  grading_auth: 'Grading & Authentication',
  payroll: 'Payroll',
  promo: 'Promotion',
  show_fee: 'Show Fee',
  travel: 'Travel',
  misc: 'Miscellaneous',
  supplies: 'Supplies', // Legacy alias
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  whatnot: 'WhatNot',
  ebay: 'eBay',
  instagram: 'Instagram',
  show: 'Live Show',
  other: 'Other',
};

export const DEFAULT_FEE_RATES: Record<Platform, number> = {
  whatnot: 0.12,
  ebay: 0.135,
  instagram: 0.05,
  show: 0.0,
  other: 0.10,
};

// ================================================================
// LEGACY TYPES (for backward compatibility with old SessionDetailContent)
// ================================================================

export interface PreShowStats {
  total_items: number;
  total_inventory_cost: number;
  totalInventoryCost: number;
  total_expenses: number;
  totalExpenses: number;
  total_breaks_cost: number;
  totalBreaksCost: number;
  total_planned_outlay: number;
  estimated_fee_rate?: number;
  breakeven_revenue: number;
  breakevenRevenue: number;
  breakeven_avg_per_card?: number;
  avgPerCard?: number;
  avgPerSpot?: number;
  breaks?: unknown[];
}

export interface SessionOverview {
  id: string;
  name: string;
  title: string | null;
  date: string;
  platform: string;
  status: string;
  item_count: number;
  sold_count: number;
  gross_revenue: number;
  total_expenses: number;
  total_fees: number;
  net_profit: number;
}

export interface ResultsCSVRow {
  item_number?: number;
  sold_price: number;
  fees?: number;
  taxes?: number;
  shipping?: number;
  sold_at?: string;
  channel?: string;
  buyer?: string;
  name?: string;
}

export interface ReconcileRow {
  status: 'matched' | 'unmatched' | 'unsold' | 'conflict';
  itemNumber?: number | string;
  itemName?: string;
  matchConfidence?: 'high' | 'medium' | 'low' | 'none';
  matchMethod?: string | null;
  soldPrice?: number | null;
  costBasis?: number | null;
  fees?: number | null;
  taxes?: number | null;
  shipping?: number | null;
  profit?: number | null;
  netProfit?: number | null;
  csvRowIndex?: number | null;
  [key: string]: unknown;
}

export interface ReconcilePreview {
  soldCount: number;
  unsoldCount: number;
  totalRevenue: number;
  totalCOGS: number;
  totalFees: number;
  netProfit: number;
  totalMatched: number;
  totalUnmatched?: number;
  totalUnsold: number;
  rows: ReconcileRow[];
  unmatchedCSVRows?: number[];
  warnings?: string[];
}

export interface SessionPnL {
  gross_revenue: number;
  total_cogs: number;
  totalCOGS: number;
  total_fees: number;
  totalFees: number;
  total_taxes: number;
  totalTaxes: number;
  total_shipping: number;
  totalShipping: number;
  total_expenses: number;
  net_profit: number;
  netProfit: number;
  profit_margin: number;
  profitMargin: number;
  avg_profit_per_item?: number;
  best_item?: unknown;
  worst_item?: unknown;
  sold_count: number;
  soldCount: number;
  total_items: number;
  unsoldCount: number;
  sell_through_rate: number;
  sellThroughRate: number;
}
