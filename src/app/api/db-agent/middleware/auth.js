/**
 * Authentication middleware for DB Agent APIs
 * Note: Main authentication is handled by src/middleware.js
 * This is just a helper to check if auth passed through
 */

import { cookies } from 'next/headers';

/**
 * Validate authentication token from request
 * Since src/middleware.js already validates JWT, we just check if token exists
 * @param {Request} req - Next.js request object
 * @returns {Object} - { authenticated: boolean, error?: string }
 */
export async function validateAgentAuth(req) {
  try {
    // Main middleware already validated the JWT token
    // We just need to confirm the cookie exists
    const cookieStore = cookies();
    const authToken = cookieStore.get('authToken')?.value;

    if (!authToken) {
      return {
        authenticated: false,
        error: 'Authentication required. No auth token found in cookies.'
      };
    }

    // Token exists and was validated by middleware
    return { authenticated: true, token: authToken };
  } catch (error) {
    console.error('Auth validation error:', error);
    return {
      authenticated: false,
      error: 'Authentication validation failed.'
    };
  }
}

/**
 * Get auth token for making agent requests
 * @returns {string|null} - Auth token or null
 */
export function getAuthToken() {
  try {
    const cookieStore = cookies();
    const authToken = cookieStore.get('authToken')?.value;
    return authToken || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}
