/**
 * Comprehensive Portfolio Tracker Type Definitions
 */

// ================================================================
// PLATFORM & FEE CONFIGURATION
// ================================================================

export type SalesTaxHandling = 'platform_collects' | 'seller_collects' | 'none';

export interface Platform {
  id: string;
  platform_key: string;
  display_name: string;
  fee_percent_default: number;
  payment_processing_percent_default: number;
  payment_processing_fixed_default: number;
  per_order_fixed_fee_default: number;
  shipping_label_cost_default: number;
  sales_tax_handling: SalesTaxHandling;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeeBreakdown {
  commission: number;
  processing_fee: number;
  fixed_fees: number;
  total_fees: number;
}

export interface FeeCalculationParams {
  salePrice: number;
  platformId?: string;
  feeOverrideEnabled?: boolean;
  feePercentOverride?: number;
  processingPercentOverride?: number;
  processingFixedOverride?: number;
  perOrderFeeOverride?: number;
}

// ================================================================
// COST BASIS & INVENTORY
// ================================================================

export interface CostStack {
  purchase_price: number;
  purchase_tax: number;
  shipping_in: number;
  supplies_cost: number;
  grading_cost: number;
  other_costs: number;
}

export interface EnhancedInventoryItem {
  // Base fields
  id: string;
  session_id: string;
  card_number: number;
  display_name: string;

  // Cost stack
  purchase_price: number;
  purchase_tax: number;
  shipping_in: number;
  supplies_cost: number;
  grading_cost: number;
  other_costs: number;
  computed_total_cost: number; // Sum of all cost components

  // Metadata
  acquisition_source: string | null;
  acquisition_date: string | null;
  listed_date: string | null;
  sold_date: string | null;
  item_status: ItemStatus;

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
  bucket_type: 'primary' | 'givy';
  item_index: number | null;
  normalized_key: string;

  // Image
  image_url: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export type ItemStatus = 'unlisted' | 'listed' | 'sold' | 'shipped' | 'grading' | 'hold';

export interface EnhancedSaleItem {
  id: string;
  sales_report_id: string;
  row_number: number;
  item_title: string;
  sale_price: number;

  // Platform & fees
  platform_id: string | null;
  platform_key: string | null;
  fees: number;

  // Fee overrides
  fee_override_enabled: boolean;
  fee_percent_override: number | null;
  processing_percent_override: number | null;
  processing_fixed_override: number | null;
  per_order_fee_override: number | null;

  // Transaction details
  shipping_out: number;
  shipping_label_cost: number;
  taxes_collected: number;

  // Matching
  card_number: number | null;

  created_at: string;
}

// ================================================================
// NEEDS REVIEW QUEUE
// ================================================================

export type NeedsReviewReason =
  | 'missing_slot'
  | 'duplicate_slot'
  | 'missing_costs'
  | 'missing_dates'
  | 'fee_anomaly'
  | 'negative_roi'
  | 'missing_platform'
  | 'allocation_needed'
  | 'other';

export type NeedsReviewPriority = 'low' | 'medium' | 'high';
export type NeedsReviewStatus = 'pending' | 'in_progress' | 'resolved' | 'dismissed';

export interface NeedsReviewItem {
  id: string;
  user_id: string;
  inventory_item_id: string | null;
  sale_item_id: string | null;
  session_id: string | null;
  reason_code: NeedsReviewReason;
  reason_detail: string | null;
  priority: NeedsReviewPriority;
  status: NeedsReviewStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ================================================================
// ANALYTICS & METRICS
// ================================================================

export interface ProfitMetrics {
  gross_revenue: number;
  total_fees: number;
  total_shipping_costs: number;
  total_taxes: number;
  net_revenue: number;
  total_cost_basis: number;
  net_profit: number;
  roi_percent: number;
  margin_percent: number;
}

export interface InventoryMetrics {
  total_items: number;
  unlisted_count: number;
  listed_count: number;
  sold_count: number;
  shipped_count: number;
  total_cost_invested: number;
  total_market_value: number;
  unrealized_gain_loss: number;
  average_hold_time_days: number;
}

export interface SessionMetrics {
  session_id: string;
  session_name: string;
  items_offered: number;
  items_sold: number;
  sell_through_rate: number;
  total_revenue: number;
  total_profit: number;
  avg_sale_price: number;
  duration_minutes: number | null;
  items_per_minute: number | null;
  revenue_per_minute: number | null;
}

// ================================================================
// FILTERS
// ================================================================

export interface GlobalFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  platforms?: string[];
  sports?: string[];
  players?: string[];
  grades?: string[];
  itemStatuses?: ItemStatus[];
  acquisitionSources?: string[];
  sessionIds?: string[];
}
