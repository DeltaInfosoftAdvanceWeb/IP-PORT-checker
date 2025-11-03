/**
 * Authentication middleware for DB Agent APIs
 * Validates auth token from cookies to ensure secure communication
 */

import { cookies } from 'next/headers';

/**
 * Validate authentication token from request
 * @param {Request} req - Next.js request object
 * @returns {Object} - { authenticated: boolean, error?: string }
 */
export async function validateAgentAuth(req) {
  try {
    // Check for auth token in Authorization header (for agent-to-agent calls)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // For agent calls, validate the token matches expected format
      if (token && token.length > 20) {
        return { authenticated: true, token };
      }
    }

    // Check for auth token in cookies (for direct browser calls)
    const cookieStore = cookies();
    const authToken = cookieStore.get('authToken')?.value;

    if (!authToken) {
      return {
        authenticated: false,
        error: 'Authentication required. Please login to access this endpoint.'
      };
    }

    // Validate token exists and is not empty
    if (authToken.length < 20) {
      return {
        authenticated: false,
        error: 'Invalid authentication token.'
      };
    }

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
