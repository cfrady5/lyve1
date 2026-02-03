/**
 * Query Builder for eBay Comps
 * Builds search queries from structured metadata
 */

import type { ItemForComps } from './types';

/**
 * Build eBay search query from item metadata
 * Priority: structured metadata > item name fallback
 */
export function buildCompQuery(item: ItemForComps): string {
  const parts: string[] = [];

  // Priority 1: Use structured metadata if available
  if (hasStructuredMetadata(item)) {
    // Year
    if (item.year) {
      parts.push(item.year.toString());
    }

    // Set name or brand
    if (item.set_name) {
      parts.push(item.set_name);
    } else if (item.brand) {
      parts.push(item.brand);
    }

    // Player name
    if (item.player) {
      parts.push(item.player);
    }

    // Card number (if specific)
    if (item.card_number) {
      parts.push(item.card_number);
    }

    // Parallel
    if (item.parallel && item.parallel.toLowerCase() !== 'base') {
      parts.push(item.parallel);
    }

    // Grader and grade (if graded)
    if (item.grader && item.grade) {
      parts.push(item.grader);
      parts.push(item.grade);
    }
  } else {
    // Priority 2: Fallback to item name
    if (item.name) {
      return cleanQuery(item.name);
    }
  }

  const query = parts.join(' ');
  return cleanQuery(query);
}

/**
 * Check if item has enough structured metadata for query building
 */
function hasStructuredMetadata(item: ItemForComps): boolean {
  // Need at least: (year OR set_name) AND player
  const hasTimeContext = !!(item.year || item.set_name || item.brand);
  const hasPlayer = !!item.player;

  return hasTimeContext && hasPlayer;
}

/**
 * Clean and normalize query string
 */
function cleanQuery(query: string): string {
  return query
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters that might break search
    .replace(/[^\w\s#-]/g, '')
    // Limit length
    .substring(0, 200);
}

/**
 * Build category filter for sports cards
 * eBay category: 261328 (Sports Trading Cards)
 */
export function getSportsCardCategoryId(): string {
  return '261328';
}

/**
 * Add sport context to query if helpful
 * (only if not already present in query)
 */
export function addSportContext(query: string, sport?: string | null): string {
  if (!sport) return query;

  const sportLower = sport.toLowerCase();
  const queryLower = query.toLowerCase();

  // Don't add if sport is already in query
  if (queryLower.includes(sportLower)) {
    return query;
  }

  // Add sport context for clarity
  const sportTerms: Record<string, string> = {
    basketball: 'basketball card',
    baseball: 'baseball card',
    football: 'football card',
    hockey: 'hockey card',
    soccer: 'soccer card',
  };

  const sportTerm = sportTerms[sportLower];
  if (sportTerm) {
    return `${query} ${sportTerm}`;
  }

  return query;
}

/**
 * Build filter for grade matching
 */
export function buildGradeFilter(grader?: string | null, grade?: string | null): string | null {
  if (!grader || !grade) return null;

  // Build grade string like "PSA 10" or "BGS 9.5"
  return `${grader} ${grade}`;
}
