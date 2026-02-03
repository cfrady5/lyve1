/**
 * Types for eBay comps integration
 */

export type CompSource = 'ebay_sold' | 'ebay_active';

export type CompConfidence = 'low' | 'medium' | 'high';

/**
 * Normalized price observation from eBay
 */
export interface PriceObservation {
  /** Total price including shipping */
  price_total: number;
  /** Item price before shipping */
  price_item: number;
  /** Shipping cost (0 if not available) */
  shipping: number;
  /** Currency code */
  currency: string;
  /** Listing title */
  title: string;
  /** URL to the listing */
  item_web_url?: string;
  /** Condition or grade if available */
  condition?: string;
  /** When item sold or was listed */
  timestamp?: string;
  /** eBay item ID */
  source_id: string;
}

/**
 * Computed statistics from observations
 */
export interface CompStats {
  /** Number of observations */
  sample_size: number;
  /** Median price (LyveValue) */
  median_price: number | null;
  /** Average price */
  avg_price: number | null;
  /** 25th percentile (LyveRange low) */
  p25: number | null;
  /** 75th percentile (LyveRange high) */
  p75: number | null;
  /** Minimum after trimming */
  min_trim: number | null;
  /** Maximum after trimming */
  max_trim: number | null;
  /** Confidence level */
  confidence: CompConfidence;
}

/**
 * Complete comp result
 */
export interface CompResult {
  query: string;
  source: CompSource;
  marketplace: string;
  observations: PriceObservation[];
  stats: CompStats;
  retrieved_at: string;
}

/**
 * Item data for query building
 */
export interface ItemForComps {
  id: string;
  name: string;
  // Structured metadata
  sport?: string | null;
  player?: string | null;
  year?: number | null;
  set_name?: string | null;
  brand?: string | null;
  parallel?: string | null;
  card_number?: string | null;
  grade?: string | null;
  grader?: string | null;
  cert_number?: string | null;
}

/**
 * eBay API response types (simplified)
 */
export interface EbayActiveListingItem {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  shippingOptions?: Array<{
    shippingCost?: {
      value: string;
      currency: string;
    };
  }>;
  itemWebUrl?: string;
  condition?: string;
}

export interface EbaySearchResponse {
  itemSummaries?: EbayActiveListingItem[];
  total?: number;
  warnings?: Array<{
    message: string;
  }>;
}
