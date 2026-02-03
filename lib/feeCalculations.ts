/**
 * Platform-Aware Fee Calculations
 * Supports configurable fee structures for multiple platforms
 */

import { Platform } from './types/portfolio';

export interface FeeBreakdown {
  commission: number;
  processing_fee: number;
  fixed_fees: number;
  total_fees: number;
}

export interface CompleteProfitCalculation extends FeeBreakdown {
  gross_revenue: number;
  shipping_costs: number;
  net_payout: number;
  cost_basis: number;
  net_profit: number;
  roi_percent: number;
  margin_percent: number;
}

/**
 * Calculate fees using platform configuration
 */
export function calculatePlatformFees(
  salePrice: number,
  platform: Platform | null,
  overrides?: {
    feePercent?: number;
    processingPercent?: number;
    processingFixed?: number;
    perOrderFee?: number;
  }
): FeeBreakdown {
  // Use overrides if provided, else platform defaults, else zero
  const feePercent = overrides?.feePercent ?? platform?.fee_percent_default ?? 0;
  const processingPercent = overrides?.processingPercent ?? platform?.payment_processing_percent_default ?? 0;
  const processingFixed = overrides?.processingFixed ?? platform?.payment_processing_fixed_default ?? 0;
  const perOrderFee = overrides?.perOrderFee ?? platform?.per_order_fixed_fee_default ?? 0;

  // Calculate fee components
  const commission = salePrice * feePercent;
  const processing_fee = (salePrice * processingPercent) + processingFixed;
  const fixed_fees = perOrderFee;
  const total_fees = commission + processing_fee + fixed_fees;

  return {
    commission: parseFloat(commission.toFixed(2)),
    processing_fee: parseFloat(processing_fee.toFixed(2)),
    fixed_fees: parseFloat(fixed_fees.toFixed(2)),
    total_fees: parseFloat(total_fees.toFixed(2)),
  };
}

/**
 * Legacy Whatnot fee calculation (for backward compatibility)
 */
export function calculateWhatnotFees(
  salePrice: number,
  totalTransaction?: number
): FeeBreakdown {
  const whatnotPlatform: Platform = {
    id: '',
    platform_key: 'whatnot',
    display_name: 'Whatnot',
    fee_percent_default: 0.08,
    payment_processing_percent_default: 0.029,
    payment_processing_fixed_default: 0.30,
    per_order_fixed_fee_default: 0,
    shipping_label_cost_default: 0,
    sales_tax_handling: 'platform_collects',
    notes: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  };

  return calculatePlatformFees(totalTransaction ?? salePrice, whatnotPlatform);
}

/**
 * Calculate complete profit breakdown
 */
export function calculateCompleteProfit(params: {
  salePrice: number;
  costBasis: number;
  platform: Platform | null;
  shippingOut?: number;
  shippingLabelCost?: number;
  taxesCollected?: number;
  feeOverrides?: {
    feePercent?: number;
    processingPercent?: number;
    processingFixed?: number;
    perOrderFee?: number;
  };
}): CompleteProfitCalculation {
  const {
    salePrice,
    costBasis,
    platform,
    shippingOut = 0,
    shippingLabelCost = 0,
    taxesCollected = 0,
    feeOverrides,
  } = params;

  const fees = calculatePlatformFees(salePrice, platform, feeOverrides);

  const shipping_costs = shippingOut + shippingLabelCost;
  const net_payout = salePrice - fees.total_fees - shipping_costs - taxesCollected;
  const net_profit = net_payout - costBasis;

  const roi_percent = costBasis > 0 ? (net_profit / costBasis) * 100 : 0;
  const margin_percent = salePrice > 0 ? (net_profit / salePrice) * 100 : 0;

  return {
    ...fees,
    gross_revenue: salePrice,
    shipping_costs,
    net_payout: parseFloat(net_payout.toFixed(2)),
    cost_basis: costBasis,
    net_profit: parseFloat(net_profit.toFixed(2)),
    roi_percent: parseFloat(roi_percent.toFixed(2)),
    margin_percent: parseFloat(margin_percent.toFixed(2)),
  };
}

/**
 * Calculate break-even price
 */
export function calculateBreakEven(params: {
  costBasis: number;
  platform: Platform | null;
  shippingOut?: number;
  shippingLabelCost?: number;
}): number {
  const { costBasis, platform, shippingOut = 0, shippingLabelCost = 0 } = params;

  const feePercent = platform?.fee_percent_default ?? 0;
  const processingPercent = platform?.payment_processing_percent_default ?? 0;
  const processingFixed = platform?.payment_processing_fixed_default ?? 0;
  const perOrderFee = platform?.per_order_fixed_fee_default ?? 0;

  // break_even = (cost_basis + shipping + fixed_fees) / (1 - fee_percent - processing_percent) - processing_fixed
  const numerator = costBasis + shippingOut + shippingLabelCost + perOrderFee + processingFixed;
  const denominator = 1 - feePercent - processingPercent;

  if (denominator <= 0) {
    // Fees exceed 100%, impossible to break even
    return Infinity;
  }

  const breakEven = numerator / denominator;
  return parseFloat(breakEven.toFixed(2));
}

/**
 * Calculate target price for desired profit
 */
export function calculateTargetPrice(params: {
  costBasis: number;
  desiredProfit: number;
  platform: Platform | null;
  shippingOut?: number;
  shippingLabelCost?: number;
}): number {
  const { costBasis, desiredProfit, platform, shippingOut = 0, shippingLabelCost = 0 } = params;

  const feePercent = platform?.fee_percent_default ?? 0;
  const processingPercent = platform?.payment_processing_percent_default ?? 0;
  const processingFixed = platform?.payment_processing_fixed_default ?? 0;
  const perOrderFee = platform?.per_order_fixed_fee_default ?? 0;

  const numerator = costBasis + desiredProfit + shippingOut + shippingLabelCost + perOrderFee + processingFixed;
  const denominator = 1 - feePercent - processingPercent;

  if (denominator <= 0) {
    return Infinity;
  }

  const targetPrice = numerator / denominator;
  return parseFloat(targetPrice.toFixed(2));
}

/**
 * Legacy profit calculation (for backward compatibility)
 */
export function calculateProfit(
  salePrice: number,
  costBasis: number,
  totalTransaction?: number
): number {
  const fees = calculateWhatnotFees(salePrice, totalTransaction);
  const profit = salePrice - fees.total_fees - costBasis;
  return parseFloat(profit.toFixed(2));
}
