/**
 * Authentication middleware for DB Agent APIs
 * Note: Main authentication is handled by src/middleware.js
 * This is just a helper to check if auth passed through
 */

import { cookies } from 'next/headers';

/**
 * Validate authentication token from request
 * Supports both cookie-based auth and agent-to-agent auth key
 * @param {Request} req - Next.js request object
 * @returns {Object} - { authenticated: boolean, error?: string }
 */
export async function validateAgentAuth(req) {
  try {
    // Check for agent-to-agent authentication key first
    const agentAuthKey = req.headers.get('x-agent-auth-key');
    const expectedAuthKey = process.env.NEXT_PUBLIC_PASS_KEY;

    if (agentAuthKey) {
      console.log('   🔑 Agent auth key detected, validating...');
      if (agentAuthKey === expectedAuthKey) {
        console.log('   ✅ Agent auth key valid');
        return { authenticated: true, authMethod: 'agent-key' };
      } else {
        console.log('   ❌ Agent auth key invalid');
        return {
          authenticated: false,
          error: 'Invalid agent authentication key'
        };
      }
    }

    // Fallback to cookie-based authentication
    const cookieStore = cookies();
    const authToken = cookieStore.get('authToken')?.value;

    if (!authToken) {
      return {
        authenticated: false,
        error: 'Authentication required. No auth token or agent key found.'
      };
    }

    // Token exists and was validated by middleware
    return { authenticated: true, token: authToken, authMethod: 'cookie' };
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
