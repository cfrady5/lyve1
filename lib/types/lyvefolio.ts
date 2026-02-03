/**
 * Lyvefolio Inventory-Centric Type Definitions
 * Single source of truth for item lifecycle
 */

// ================================================================
// LIFECYCLE STATUS
// ================================================================

export type LifecycleStatus = 'active' | 'sold' | 'archived';

// ================================================================
// INVENTORY ITEM (BASE)
// ================================================================

export interface InventoryItem {
  id: string;
  user_id: string;
  session_id: string | null;
  card_number: number;
  
  // Display info
  display_name: string;
  name: string | null;
  image_url: string | null;
  
  // Cost basis
  cost_basis: number;
  purchase_price: number | null;
  purchase_tax: number | null;
  shipping_in: number | null;
  supplies_cost: number | null;
  grading_cost: number | null;
  other_costs: number | null;
  
  // Metadata
  acquisition_source: string | null;
  acquisition_date: string | null;
  listed_date: string | null;
  sold_date: string | null;
  
  // Lifecycle
  lifecycle_status: LifecycleStatus;
  archived_at: string | null;
  archived_reason: string | null;
  archived_notes: string | null;
  
  // Listing info
  listing_platform_id: string | null;
  listing_price: number | null;
  market_value: number | null;
  
  // Categorization
  sport: string | null;
  player: string | null;
  set_name: string | null;
  grade: string | null;
  year: number | null;
  
  // Classification
  bucket_type: 'primary' | 'givy' | null;
  item_index: number | null;
  normalized_key: string | null;
  
  // Notes
  notes: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ================================================================
// SALE TRANSACTION
// ================================================================

export interface Sale {
  id: string;
  user_id: string;
  item_id: string;
  session_id: string | null;
  
  // Platform
  platform_id: string | null;
  platform_key: string | null;
  
  // Transaction details
  sold_price: number;
  fees: number;
  shipping_cost: number | null;
  taxes_collected: number | null;
  
  // Computed
  gross_revenue: number;
  total_deductions: number;
  net_revenue: number;
  
  // Metadata
  buyer_username: string | null;
  order_id: string | null;
  sold_at: string;
  notes: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ================================================================
// SESSION ITEM (JOIN TABLE)
// ================================================================

export interface SessionItem {
  id: string;
  session_id: string;
  item_id: string;
  position: number | null;
  ran_at: string | null;
  notes: string | null;
  created_at: string;
}

// ================================================================
// LYVEFOLIO VIEWS
// ================================================================

export interface LyvefolioActiveItem extends InventoryItem {
  session_name: string | null;
  session_date: string | null;
  days_held: number;
}

export interface LyvefolioSoldItem {
  id: string;
  user_id: string;
  session_id: string | null;
  card_number: number;
  display_name: string;
  name: string | null;
  image_url: string | null;
  cost_basis: number;
  acquisition_date: string | null;
  item_created_at: string;
  
  // Sale details
  sale_id: string;
  sold_price: number;
  fees: number;
  shipping_cost: number | null;
  net_revenue: number;
  sold_at: string;
  platform_id: string | null;
  platform_key: string | null;
  buyer_username: string | null;
  order_id: string | null;
  
  // Session info
  session_name: string | null;
  
  // Profit calculations
  net_profit: number;
  roi_percent: number;
  margin_percent: number;
  
  // Platform info
  platform_name: string | null;
}

export interface LyvefolioArchivedItem extends InventoryItem {
  session_name: string | null;
  days_held_before_archive: number | null;
}

// ================================================================
// SESSION ITEM WITH STATUS
// ================================================================

export interface SessionItemWithStatus extends SessionItem {
  lifecycle_status: LifecycleStatus;
  display_name: string;
  name: string | null;
  cost_basis: number;
  image_url: string | null;
  card_number: number;
  session_name: string;
  
  // Sale info (if sold)
  sold_price: number | null;
  fees: number | null;
  net_revenue: number | null;
  sold_at: string | null;
  profit: number | null;
}

// ================================================================
// LYVEFOLIO METRICS
// ================================================================

export interface LyvefolioMetrics {
  // Active inventory
  active_count: number;
  active_total_cost: number;
  active_total_market_value: number;
  active_unrealized_gain: number;
  active_avg_days_held: number;
  
  // Sold inventory
  sold_count: number;
  sold_total_revenue: number;
  sold_total_cost: number;
  sold_total_fees: number;
  sold_total_profit: number;
  sold_avg_roi: number;
  sold_avg_margin: number;
  
  // Archived
  archived_count: number;
  archived_total_cost: number;
}

export interface SoldTabMetrics {
  total_revenue: number;
  total_profit: number;
  total_fees: number;
  avg_roi: number;
  avg_margin: number;
  items_count: number;
}

// ================================================================
// MARK SOLD PAYLOAD
// ================================================================

export interface MarkSoldPayload {
  item_id: string;
  sold_price: number;
  fees?: number;
  session_id?: string;
  platform_id?: string;
  platform_key?: string;
  shipping_cost?: number;
  buyer_username?: string;
  order_id?: string;
  sold_at?: string;
  notes?: string;
}

// ================================================================
// ARCHIVE PAYLOAD
// ================================================================

export interface ArchivePayload {
  item_id: string;
  reason?: string;
  notes?: string;
}

// ================================================================
// FILTERS
// ================================================================

export interface LyvefolioFilters {
  search?: string;
  session_id?: string;
  platform_id?: string;
  date_from?: string;
  date_to?: string;
  min_cost?: number;
  max_cost?: number;
  min_profit?: number;
  max_profit?: number;
  sort_by?: 'date' | 'cost' | 'profit' | 'roi' | 'days_held' | 'name';
  sort_direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
