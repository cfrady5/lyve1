/**
 * Fee Calculator Service
 * Calculates platform fees, taxes, and net revenue
 */

import { createClient } from '@/lib/supabase/client';

export interface FeeBreakdown {
  commission: number;
  processingFee: number;
  fixedFees: number;
  totalFees: number;
}

export interface Platform {
  id: string;
  platform_key: string;
  display_name: string;
  fee_percent_default: number;
  payment_processing_percent_default: number;
  payment_processing_fixed_default: number;
  per_order_fixed_fee_default: number;
}

/**
 * Calculate fees using the database function
 */
export async function calculateFees(
  salePrice: number,
  platformId: string,
  overrides?: {
    feePercent?: number;
    processingPercent?: number;
    processingFixed?: number;
    perOrderFee?: number;
  }
): Promise<FeeBreakdown> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('calculate_sale_fees', {
    p_sale_price: salePrice,
    p_platform_id: platformId,
    p_fee_override_enabled: !!overrides,
    p_fee_percent_override: overrides?.feePercent,
    p_processing_percent_override: overrides?.processingPercent,
    p_processing_fixed_override: overrides?.processingFixed,
    p_per_order_fee_override: overrides?.perOrderFee,
  });

  if (error) {
    throw new Error(`Failed to calculate fees: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No fee data returned');
  }

  const feeData = data[0];
  return {
    commission: feeData.commission,
    processingFee: feeData.processing_fee,
    fixedFees: feeData.fixed_fees,
    totalFees: feeData.total_fees,
  };
}

/**
 * Calculate fees manually without database call
 * Useful for client-side estimates
 */
export function calculateFeesLocal(
  salePrice: number,
  platform: Platform,
  overrides?: {
    feePercent?: number;
    processingPercent?: number;
    processingFixed?: number;
    perOrderFee?: number;
  }
): FeeBreakdown {
  const feePercent = overrides?.feePercent ?? platform.fee_percent_default;
  const processingPercent =
    overrides?.processingPercent ?? platform.payment_processing_percent_default;
  const processingFixed =
    overrides?.processingFixed ?? platform.payment_processing_fixed_default;
  const perOrderFee =
    overrides?.perOrderFee ?? platform.per_order_fixed_fee_default;

  const commission = salePrice * feePercent;
  const processingFee = salePrice * processingPercent + processingFixed;
  const fixedFees = perOrderFee;
  const totalFees = commission + processingFee + fixedFees;

  return {
    commission: Math.round(commission * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    fixedFees: Math.round(fixedFees * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
  };
}

/**
 * Calculate net revenue after fees
 */
export function calculateNetRevenue(
  salePrice: number,
  fees: number,
  taxes: number = 0,
  shipping: number = 0
): number {
  return salePrice - fees - taxes - shipping;
}

/**
 * Calculate net profit after fees and cost basis
 */
export function calculateNetProfit(
  salePrice: number,
  fees: number,
  costBasis: number,
  taxes: number = 0,
  shipping: number = 0
): number {
  return salePrice - fees - taxes - shipping - costBasis;
}

/**
 * Calculate ROI percentage
 */
export function calculateROI(
  salePrice: number,
  fees: number,
  costBasis: number,
  taxes: number = 0,
  shipping: number = 0
): number | null {
  if (costBasis <= 0) {
    return null;
  }

  const netProfit = calculateNetProfit(salePrice, fees, costBasis, taxes, shipping);
  return Math.round((netProfit / costBasis) * 100 * 10) / 10; // Round to 1 decimal
}

/**
 * Get platform by key
 */
export async function getPlatformByKey(platformKey: string): Promise<Platform | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('platform_key', platformKey)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Platform;
}

/**
 * Get all active platforms
 */
export async function getAllPlatforms(): Promise<Platform[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('is_active', true)
    .order('display_name');

  if (error || !data) {
    return [];
  }

  return data as Platform[];
}

/**
 * Estimate taxes (simple calculation)
 * In production, this would be more sophisticated
 */
export function estimateTaxes(
  salePrice: number,
  taxRate: number = 0,
  platformCollectsTax: boolean = true
): number {
  if (platformCollectsTax || taxRate === 0) {
    return 0;
  }

  return Math.round(salePrice * taxRate * 100) / 100;
}
