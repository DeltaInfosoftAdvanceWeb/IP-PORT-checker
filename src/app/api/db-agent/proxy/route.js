import { NextResponse } from "next/server";

/**
 * Proxy API for DB Agent requests
 * This allows HTTPS frontend to communicate with HTTP agents
 * by proxying requests through the server
 */
export async function POST(req) {
  const requestStartTime = Date.now();
  console.log('\n🔶 [PROXY] DB Agent Proxy Request Started');

  try {
    const { targetUrl, method = "POST", body, headers = {} } = await req.json();

    if (!targetUrl) {
      console.error('❌ [PROXY] Target URL is missing');
      return NextResponse.json(
        { success: false, message: "Target URL is required", error: "MISSING_TARGET_URL" },
        { status: 400 }
      );
    }

    console.log(`📡 [PROXY] Proxying ${method} request`);
    console.log(`   Target: ${targetUrl}`);
    console.log(`   Body:`, body ? JSON.stringify(body).substring(0, 200) + '...' : 'none');

    // Forward the request to the target agent with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch(targetUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error(`❌ [PROXY] Request timeout after 30s`);
        console.error(`   Target: ${targetUrl}`);
        return NextResponse.json(
          {
            success: false,
            message: `Request timeout: Agent at ${targetUrl} did not respond within 30 seconds`,
            error: "TIMEOUT",
            targetUrl,
          },
          { status: 504 }
        );
      }

      // Network error (connection refused, DNS error, etc.)
      console.error(`❌ [PROXY] Network Error:`);
      console.error(`   Target: ${targetUrl}`);
      console.error(`   Error: ${fetchError.message}`);
      console.error(`   Type: ${fetchError.name}`);

      return NextResponse.json(
        {
          success: false,
          message: `Cannot connect to agent at ${targetUrl}. Make sure the agent is running and accessible. Error: ${fetchError.message}`,
          error: "NETWORK_ERROR",
          targetUrl,
          details: fetchError.message,
        },
        { status: 503 }
      );
    }

    const duration = Date.now() - requestStartTime;
    console.log(`⏱️  [PROXY] Response received in ${duration}ms`);
    console.log(`   Status: ${response.status} ${response.statusText}`);

    // Try to parse response as JSON
    let data;
    let responseText;
    try {
      responseText = await response.text();
      data = JSON.parse(responseText);

      // Log the response for debugging
      if (!data.success) {
        console.error(`❌ [PROXY] Agent returned error response:`);
        console.error(`   Target: ${targetUrl}`);
        console.error(`   Status: ${response.status}`);
        console.error(`   Message: ${data.message || 'No message'}`);
        console.error(`   Response:`, JSON.stringify(data).substring(0, 500));
      } else {
        console.log(`✅ [PROXY] Agent request successful`);
        console.log(`   Target: ${targetUrl}`);
        console.log(`   Duration: ${duration}ms`);
      }
    } catch (parseError) {
      console.error(`❌ [PROXY] Failed to parse agent response as JSON:`);
      console.error(`   Target: ${targetUrl}`);
      console.error(`   Status: ${response.status}`);
      console.error(`   Content-Type: ${response.headers.get('content-type')}`);
      console.error(`   Parse Error: ${parseError.message}`);
      console.error(`   Response Preview (first 500 chars):`);
      console.error(responseText.substring(0, 500));

      // Check if it's HTML (common issue)
      const isHtml = responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html');

      return NextResponse.json(
        {
          success: false,
          message: isHtml
            ? `Agent returned HTML instead of JSON. This usually means the endpoint doesn't exist or there's a routing issue. Check that the agent is running the correct API.`
            : `Agent returned invalid response (not JSON). Status: ${response.status}. Response preview: ${responseText.substring(0, 100)}...`,
          error: "INVALID_RESPONSE",
          targetUrl,
          statusCode: response.status,
          contentType: response.headers.get('content-type'),
          responsePreview: responseText.substring(0, 500),
          isHtml,
        },
        { status: 502 }
      );
    }

    // Return the agent's response with additional metadata
    return NextResponse.json(
      {
        ...data,
        _proxy: {
          duration,
          targetUrl,
          status: response.status,
        }
      },
      { status: response.status }
    );

  } catch (error) {
    console.error("❌ [PROXY] Unexpected Error:");
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack:`, error.stack);

    return NextResponse.json(
      {
        success: false,
        message: `Proxy Error: ${error.message}`,
        error: "PROXY_ERROR",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
