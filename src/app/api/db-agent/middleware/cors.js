/**
 * CORS Middleware for DB Agent APIs
 * Allows cross-origin requests from different agent instances
 */

import { NextResponse } from "next/server";

/**
 * Add CORS headers to response
 * @param {Response} response - NextResponse object
 * @param {Request} req - Request object (to get origin)
 * @returns {Response} - Response with CORS headers
 */
export function addCorsHeaders(response, req = null) {
  // Get origin from request or allow all
  const origin = req?.headers?.get('origin') || '*';

  // For credentials to work, we need specific origin, not '*'
  if (origin !== '*') {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

/**
 * Handle preflight OPTIONS request
 * @param {Request} req - Request object
 * @returns {Response} - Response with CORS headers
 */
export function handleCorsPreFlight(req) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response, req);
}

/**
 * Create JSON response with CORS headers
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Request} req - Request object (optional)
 * @returns {Response} - Response with CORS headers
 */
export function corsResponse(data, status = 200, req = null) {
  const response = NextResponse.json(data, { status });
  return addCorsHeaders(response, req);
}
