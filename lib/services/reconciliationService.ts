/**
 * Reconciliation Service
 * Handles post-show CSV import, parsing, and auto-alignment logic
 */

import { markItemSold, MarkItemSoldParams } from './itemService';

export interface CSVRow {
  rowNumber: number;
  itemNumber?: number; // From CSV if present
  lot?: string; // Alternative to item_number
  soldPrice?: number;
  fees?: number;
  taxes?: number;
  shipping?: number;
  channel?: string;
  platform?: string;
  buyerUsername?: string;
  orderId?: string;
  soldAt?: string;
  rawData: Record<string, string>; // Original CSV row
}

export interface ParsedCSV {
  rows: CSVRow[];
  headers: string[];
  format: 'whatnot' | 'ebay' | 'custom';
  errors: string[];
}

export interface AlignmentMatch {
  sessionItemId: string;
  itemId: string;
  itemNumber: number;
  csvRowNumber?: number;
  csvData?: CSVRow;
  matchType: 'exact_item_number' | 'row_order' | 'manual' | 'unmatched';
  confidence: 'high' | 'medium' | 'low';
}

export interface ReconciliationMapping {
  sessionId: string;
  matches: AlignmentMatch[];
  unmatchedSessionItems: string[]; // session_item IDs
  unmatchedCSVRows: number[]; // CSV row numbers
}

export interface ApplyReconciliationResult {
  salesCreated: number;
  itemsSold: number;
  itemsUnsold: number;
  errors: string[];
}

/**
 * Parse CSV file and detect format
 */
export function parseCSV(csvText: string): ParsedCSV {
  const errors: string[] = [];
  const lines = csvText.trim().split('\n');

  if (lines.length === 0) {
    return { rows: [], headers: [], format: 'custom', errors: ['CSV is empty'] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);

  // Detect format based on headers
  const format = detectCSVFormat(headers);

  // Parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every((v) => !v.trim())) {
      continue; // Skip empty rows
    }

    try {
      const row = parseCSVRow(headers, values, i + 1);
      rows.push(row);
    } catch (error) {
      errors.push(
        `Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`
      );
    }
  }

  return { rows, headers, format, errors };
}

/**
 * Parse a single CSV line (handles quotes)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Detect CSV format from headers
 */
function detectCSVFormat(headers: string[]): 'whatnot' | 'ebay' | 'custom' {
  const headersLower = headers.map((h) => h.toLowerCase());

  // WhatNot typically has: lot, price, buyer, etc.
  if (
    headersLower.some((h) => h.includes('lot')) &&
    headersLower.some((h) => h.includes('buyer'))
  ) {
    return 'whatnot';
  }

  // eBay typically has: item number, sale price, buyer username
  if (
    headersLower.some((h) => h.includes('item number') || h.includes('item id')) &&
    headersLower.some((h) => h.includes('sale price'))
  ) {
    return 'ebay';
  }

  return 'custom';
}

/**
 * Parse a CSV row into structured data
 */
function parseCSVRow(
  headers: string[],
  values: string[],
  rowNumber: number
): CSVRow {
  const rawData: Record<string, string> = {};
  headers.forEach((header, index) => {
    rawData[header] = values[index] || '';
  });

  // Extract fields based on format
  let itemNumber: number | undefined;
  let lot: string | undefined;
  let soldPrice: number | undefined;
  let fees: number | undefined;
  let taxes: number | undefined;
  let shipping: number | undefined;
  let channel: string | undefined;
  let platform: string | undefined;
  let buyerUsername: string | undefined;
  let orderId: string | undefined;
  let soldAt: string | undefined;

  // Common field mappings
  const headersLower = headers.map((h) => h.toLowerCase());

  // Item Number / Lot
  const itemNumberIdx = headersLower.findIndex(
    (h) => h.includes('item') && (h.includes('number') || h.includes('#'))
  );
  const lotIdx = headersLower.findIndex((h) => h === 'lot' || h.includes('lot number'));

  if (itemNumberIdx >= 0 && values[itemNumberIdx]) {
    itemNumber = parseInt(values[itemNumberIdx], 10);
  } else if (lotIdx >= 0 && values[lotIdx]) {
    // Try to extract number from lot (e.g., "Lot 5" -> 5)
    const lotMatch = values[lotIdx].match(/\d+/);
    if (lotMatch) {
      itemNumber = parseInt(lotMatch[0], 10);
    }
    lot = values[lotIdx];
  }

  // Sold Price
  const priceIdx = headersLower.findIndex(
    (h) =>
      h.includes('price') ||
      h.includes('sold') ||
      h.includes('amount') ||
      h.includes('total')
  );
  if (priceIdx >= 0 && values[priceIdx]) {
    soldPrice = parseFloat(values[priceIdx].replace(/[$,]/g, ''));
  }

  // Fees
  const feesIdx = headersLower.findIndex((h) => h.includes('fee'));
  if (feesIdx >= 0 && values[feesIdx]) {
    fees = parseFloat(values[feesIdx].replace(/[$,]/g, ''));
  }

  // Taxes
  const taxIdx = headersLower.findIndex((h) => h.includes('tax'));
  if (taxIdx >= 0 && values[taxIdx]) {
    taxes = parseFloat(values[taxIdx].replace(/[$,]/g, ''));
  }

  // Shipping
  const shippingIdx = headersLower.findIndex((h) => h.includes('shipping'));
  if (shippingIdx >= 0 && values[shippingIdx]) {
    shipping = parseFloat(values[shippingIdx].replace(/[$,]/g, ''));
  }

  // Channel / Platform
  const channelIdx = headersLower.findIndex(
    (h) => h.includes('channel') || h.includes('platform')
  );
  if (channelIdx >= 0 && values[channelIdx]) {
    channel = values[channelIdx];
    platform = values[channelIdx];
  }

  // Buyer
  const buyerIdx = headersLower.findIndex((h) => h.includes('buyer'));
  if (buyerIdx >= 0 && values[buyerIdx]) {
    buyerUsername = values[buyerIdx];
  }

  // Order ID
  const orderIdx = headersLower.findIndex(
    (h) => h.includes('order') && h.includes('id')
  );
  if (orderIdx >= 0 && values[orderIdx]) {
    orderId = values[orderIdx];
  }

  // Sold Date
  const dateIdx = headersLower.findIndex(
    (h) => h.includes('date') || h.includes('time')
  );
  if (dateIdx >= 0 && values[dateIdx]) {
    soldAt = values[dateIdx];
  }

  return {
    rowNumber,
    itemNumber,
    lot,
    soldPrice,
    fees,
    taxes,
    shipping,
    channel,
    platform,
    buyerUsername,
    orderId,
    soldAt,
    rawData,
  };
}

/**
 * Auto-align session items with CSV rows
 */
export async function autoAlignItems(
  sessionId: string,
  csvRows: CSVRow[]
): Promise<ReconciliationMapping> {
  // This would normally fetch session items from the database
  // For now, return a structure showing how alignment would work
  // In real implementation, this would call Supabase

  const matches: AlignmentMatch[] = [];
  const unmatchedCSVRows: number[] = [];

  // Match by item_number if present
  for (const csvRow of csvRows) {
    if (csvRow.itemNumber) {
      // In real implementation: find session_item with this item_number
      matches.push({
        sessionItemId: 'placeholder',
        itemId: 'placeholder',
        itemNumber: csvRow.itemNumber,
        csvRowNumber: csvRow.rowNumber,
        csvData: csvRow,
        matchType: 'exact_item_number',
        confidence: 'high',
      });
    } else {
      unmatchedCSVRows.push(csvRow.rowNumber);
    }
  }

  return {
    sessionId,
    matches,
    unmatchedSessionItems: [],
    unmatchedCSVRows,
  };
}

/**
 * Apply reconciliation (create sales, update item statuses)
 */
export async function applyReconciliation(
  sessionId: string,
  mapping: ReconciliationMapping
): Promise<ApplyReconciliationResult> {
  const salesCreated: string[] = [];
  const errors: string[] = [];

  for (const match of mapping.matches) {
    if (!match.csvData || match.matchType === 'unmatched') {
      continue;
    }

    try {
      const saleParams: MarkItemSoldParams = {
        item_id: match.itemId,
        session_id: sessionId,
        sold_price: match.csvData.soldPrice || 0,
        fees: match.csvData.fees,
        taxes_collected: match.csvData.taxes,
        shipping_cost: match.csvData.shipping,
        platform_key: match.csvData.platform,
        buyer_username: match.csvData.buyerUsername,
        order_id: match.csvData.orderId,
        sold_at: match.csvData.soldAt,
      };

      const saleId = await markItemSold(saleParams);
      salesCreated.push(saleId);
    } catch (error) {
      errors.push(
        `Failed to mark item ${match.itemNumber} as sold: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return {
    salesCreated: salesCreated.length,
    itemsSold: salesCreated.length,
    itemsUnsold: mapping.unmatchedSessionItems.length,
    errors,
  };
}

/**
 * Shift CSV mapping by N rows (fix off-by-one errors)
 */
export function shiftMapping(
  mapping: ReconciliationMapping,
  shiftAmount: number
): ReconciliationMapping {
  // Shift all CSV row numbers by the specified amount
  const shiftedMatches = mapping.matches.map((match) => {
    if (match.csvRowNumber) {
      const newRowNumber = match.csvRowNumber + shiftAmount;
      return {
        ...match,
        csvRowNumber: newRowNumber >= 1 ? newRowNumber : match.csvRowNumber,
      };
    }
    return match;
  });

  return {
    ...mapping,
    matches: shiftedMatches,
  };
}

/**
 * Validate reconciliation mapping
 */
export function validateMapping(mapping: ReconciliationMapping): string[] {
  const errors: string[] = [];

  // Check for duplicate item matches
  const itemIds = new Set<string>();
  for (const match of mapping.matches) {
    if (match.matchType !== 'unmatched') {
      if (itemIds.has(match.itemId)) {
        errors.push(`Duplicate match for item ${match.itemNumber}`);
      }
      itemIds.add(match.itemId);
    }
  }

  // Check for duplicate CSV row matches
  const csvRows = new Set<number>();
  for (const match of mapping.matches) {
    if (match.csvRowNumber && match.matchType !== 'unmatched') {
      if (csvRows.has(match.csvRowNumber)) {
        errors.push(`Duplicate match for CSV row ${match.csvRowNumber}`);
      }
      csvRows.add(match.csvRowNumber);
    }
  }

  return errors;
}
