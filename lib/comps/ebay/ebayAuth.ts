/**
 * eBay OAuth Token Management
 */

interface TokenCache {
  access_token: string;
  expires_at: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get eBay credentials from environment
 */
function getEbayCredentials() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const env = process.env.EBAY_ENV || 'production';

  if (!clientId || !clientSecret) {
    throw new Error('[EBAY_AUTH] Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET environment variables');
  }

  return { clientId, clientSecret, env };
}

/**
 * Get base URL for eBay API based on environment
 */
export function getEbayBaseUrl(apiType: 'buy' | 'sell' = 'buy'): string {
  const env = process.env.EBAY_ENV || 'production';

  if (env === 'sandbox') {
    return apiType === 'buy'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.sandbox.ebay.com';
  }

  return apiType === 'buy'
    ? 'https://api.ebay.com'
    : 'https://api.ebay.com';
}

/**
 * Get eBay OAuth token (cached with auto-refresh)
 */
export async function getEbayAccessToken(): Promise<string> {
  // Check cache
  if (tokenCache && tokenCache.expires_at > Date.now() + 60000) {
    return tokenCache.access_token;
  }

  // Get new token
  const { clientId, clientSecret, env } = getEbayCredentials();

  const authUrl = env === 'sandbox'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[EBAY_AUTH] Failed to get access token: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Cache token (expires_in is in seconds)
    tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000) - 60000, // 1 min buffer
    };

    return data.access_token;
  } catch (error) {
    console.error('[EBAY_AUTH] Error getting access token:', error);
    throw error;
  }
}

/**
 * Clear token cache (for testing or error recovery)
 */
export function clearEbayTokenCache() {
  tokenCache = null;
}
