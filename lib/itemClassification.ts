/**
 * Item Classification and Ordering Utility
 *
 * Classifies inventory items into two buckets:
 * - Bucket A (Primary Products): Regular products with numbers
 * - Bucket B (GIVY/Promo): Giveaways, promos, and bonus items
 *
 * Items are ordered with primary products first, GIVY items last,
 * and within each bucket sorted numerically by extracted item_index.
 */

export type BucketType = 'primary' | 'givy';

export interface ItemClassification {
  displayName: string;
  normalizedKey: string;
  bucketType: BucketType;
  itemIndex: number | null;
}

/**
 * GIVY/Giveaway pattern matchers
 */
const GIVY_PATTERNS = [
  /^givy$/i,
  /^giveaway$/i,
  /givy/i,
  /giveaway/i,
  /promo/i,
  /bonus/i,
];

/**
 * Normalizes a product name for grouping
 * - Trims whitespace
 * - Collapses multiple spaces
 * - Converts to lowercase for matching
 */
function normalizeProductName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Extracts the first integer found in a product name
 * Examples:
 *   "Product #12" → 12
 *   "GIVY 7" → 7
 *   "Singles Box" → null
 */
function extractItemIndex(name: string): number | null {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Checks if a product name matches GIVY/giveaway patterns
 */
function isGivyItem(name: string): boolean {
  const normalized = normalizeProductName(name);
  return GIVY_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Classifies a product name into the appropriate bucket
 *
 * Bucket A (Primary Products):
 * - Contains a number AND
 * - Does NOT match GIVY/giveaway patterns
 *
 * Bucket B (GIVY/Promo):
 * - Matches any GIVY/giveaway pattern
 */
function classifyBucket(name: string, itemIndex: number | null): BucketType {
  if (isGivyItem(name)) {
    return 'givy';
  }

  // If it has a number and is not a GIVY item, it's primary
  if (itemIndex !== null) {
    return 'primary';
  }

  // Default to primary for items without numbers (edge case)
  return 'primary';
}

/**
 * Main classification function
 *
 * Takes a product name and returns full classification metadata
 */
export function classifyItem(productName: string): ItemClassification {
  const displayName = productName.trim().replace(/\s+/g, ' ');
  const normalizedKey = normalizeProductName(productName);
  const itemIndex = extractItemIndex(productName);
  const bucketType = classifyBucket(productName, itemIndex);

  return {
    displayName,
    normalizedKey,
    bucketType,
    itemIndex,
  };
}

/**
 * Comparison function for sorting items
 *
 * Ordering rules:
 * 1. Bucket A (Primary Products) FIRST
 * 2. Bucket B (GIVY/Promo) SECOND
 * 3. Within each bucket, sort by item_index ASC
 * 4. Items with null item_index come AFTER numbered items
 */
export function compareItems(
  a: { bucketType: BucketType; itemIndex: number | null },
  b: { bucketType: BucketType; itemIndex: number | null }
): number {
  // Primary products come before GIVY items
  if (a.bucketType !== b.bucketType) {
    return a.bucketType === 'primary' ? -1 : 1;
  }

  // Within the same bucket, sort by item_index
  // Nulls come after numbers
  if (a.itemIndex === null && b.itemIndex === null) return 0;
  if (a.itemIndex === null) return 1;
  if (b.itemIndex === null) return -1;

  return a.itemIndex - b.itemIndex;
}

/**
 * Sorts an array of items according to the ordering rules
 */
export function sortItems<T extends { bucketType: BucketType; itemIndex: number | null }>(
  items: T[]
): T[] {
  return [...items].sort(compareItems);
}
