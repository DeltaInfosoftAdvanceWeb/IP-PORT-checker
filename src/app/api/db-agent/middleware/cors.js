/**
 * CORS Middleware for DB Agent APIs
 * Allows cross-origin requests from different agent instances
 */

import { NextResponse } from "next/server";

/**
 * Add CORS headers to response
 * @param {Response} response - NextResponse object
 * @returns {Response} - Response with CORS headers
 */
export function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

/**
 * Handle preflight OPTIONS request
 * @returns {Response} - Response with CORS headers
 */
export function handleCorsPreFlight() {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}

/**
 * Create JSON response with CORS headers
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Response} - Response with CORS headers
 */
export function corsResponse(data, status = 200) {
  const response = NextResponse.json(data, { status });
  return addCorsHeaders(response);
}
