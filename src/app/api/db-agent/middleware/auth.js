/**
 * Simple API Key Authentication for DB Agent APIs
 * No cookies, no JWT, just a simple API key check
 */

/**
 * Validate API key from request header
 * @param {Request} req - Next.js request object
 * @returns {Object} - { authenticated: boolean, error?: string }
 */
export function validateAgentAuth(req) {
  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = process.env.NEXT_PUBLIC_PASS_KEY;

    if (!apiKey) {
      console.log('   ❌ No API key provided');
      return {
        authenticated: false,
        error: 'API key required. Please provide x-api-key header.'
      };
    }

    if (!expectedApiKey) {
      console.error('   ❌ NEXT_PUBLIC_PASS_KEY not configured in .env');
      return {
        authenticated: false,
        error: 'Server configuration error. API key not configured.'
      };
    }

    if (apiKey === expectedApiKey) {
      console.log('   ✅ API key valid');
      return { authenticated: true };
    } else {
      console.log('   ❌ API key invalid');
      return {
        authenticated: false,
        error: 'Invalid API key'
      };
    }
  } catch (error) {
    console.error('   ❌ Auth validation error:', error);
    return {
      authenticated: false,
      error: 'Authentication validation failed.'
    };
  }
}
