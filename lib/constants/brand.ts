/**
 * Brand Constants
 *
 * BRAND TEXT RULE: Always use lowercase "lyve"
 * - Product name must always be lowercase: "lyve"
 * - This applies to all UI copy, headings, buttons, nav labels, tooltips
 * - Never capitalize, even at sentence start
 *
 * Examples:
 * - "lyve" ✓
 * - "lyvefolio" ✓
 * - "lyverange" ✓
 * - "Lyve" ✗
 * - "LYVE" ✗
 */

export const BRAND = {
  /** Product name - always lowercase */
  NAME: 'lyve' as const,

  /** Portfolio product name - always lowercase */
  PORTFOLIO: 'lyvefolio' as const,

  /** Value range product name - always lowercase */
  RANGE: 'lyverange' as const,

  /** Value product name - always lowercase */
  VALUE: 'lyve value' as const,
} as const;

/**
 * Helper to format brand name (currently just returns lowercase "lyve")
 * Centralizes usage to ensure consistency
 */
export function formatBrand(name: keyof typeof BRAND = 'NAME'): string {
  return BRAND[name];
}

/**
 * Get the brand name
 * @returns 'lyve' (always lowercase)
 */
export function getBrandName(): string {
  return BRAND.NAME;
}

/**
 * Get the portfolio product name
 * @returns 'lyvefolio' (always lowercase)
 */
export function getPortfolioName(): string {
  return BRAND.PORTFOLIO;
}
