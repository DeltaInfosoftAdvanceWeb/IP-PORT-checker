# HTTP to HTTPS Proxy Setup

## Problem
When deploying this application on Vercel (HTTPS), browser security prevents making HTTP requests to agent endpoints. This causes "Mixed Content" errors.

## Solution
A server-side proxy has been implemented at `/api/db-agent/proxy` that routes all agent requests through the Next.js backend.

## How It Works

```
┌─────────────────┐
│ Browser (HTTPS) │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────┐
│ Next.js API (Vercel)    │
│ /api/db-agent/proxy     │
└────────┬────────────────┘
         │ HTTP/HTTPS
         ▼
┌──────────────────────┐
│ Remote Agent Server  │
│ (HTTP or HTTPS)      │
└──────────────────────┘
```

## Features

### 1. Enhanced Error Logging
- Network errors (connection refused, DNS failures)
- Timeout errors (30 second timeout)
- Invalid response errors
- Detailed error metadata including target URL

### 2. Performance Tracking
- Request duration logging
- Proxy metadata in response (`_proxy` field)

### 3. Browser Console Logging
```javascript
// Success
✅ [Source] Request via proxy took 1234ms

// Error
❌ [Source] Failed to fetch tables:
   Error Code: NETWORK_ERROR
   Message: Cannot connect to agent at http://192.168.1.100:3000
   Target URL: http://192.168.1.100:3000/api/db-agent/source/fetch-tables
```

### 4. Server-Side Logging
```
🔶 [PROXY] DB Agent Proxy Request Started
📡 [PROXY] Proxying POST request
   Target: http://192.168.1.100:3000/api/db-agent/source/fetch-tables
   Body: {"dbType":"postgresql","config":{"host":"192.168.1.100"...
⏱️  [PROXY] Response received in 1234ms
   Status: 200 OK
✅ [PROXY] Agent request successful
   Target: http://192.168.1.100:3000/api/db-agent/source/fetch-tables
   Duration: 1234ms
```

## Updated Components

### 1. Proxy API (`/src/app/api/db-agent/proxy/route.js`)
- Handles all agent communication
- 30-second timeout
- Comprehensive error handling
- Detailed logging

### 2. Frontend (`/src/app/db-sync/page.jsx`)
- `handleFetchSourceTables()` - Updated to use proxy
- `handleFetchTargetTables()` - Updated to use proxy
- Enhanced error messages for users

### 3. Orchestrator (`/src/app/api/db-sync/orchestrate-sync/route.js`)
- `agentRequest()` - Updated to use internal proxy
- Automatic authentication forwarding

## Usage

### Agent Mode with HTTP Endpoints
```javascript
// User enters agent URLs
sourceAgentUrl: "http://192.168.1.100:3000"
targetAgentUrl: "http://192.168.1.200:3000"

// Frontend automatically routes through proxy
// No mixed content errors!
```

### Error Types

| Error Code | Meaning | User Action |
|------------|---------|-------------|
| `NETWORK_ERROR` | Cannot connect to agent | Check agent is running and accessible |
| `TIMEOUT` | Agent didn't respond in 30s | Check network latency or agent performance |
| `INVALID_RESPONSE` | Agent returned non-JSON | Check agent is healthy |
| `PROXY_ERROR` | Unexpected proxy error | Check server logs |

## Testing

### Test Network Error
```bash
# Set agent URL to non-existent server
http://192.168.1.999:3000
```

### Test Timeout
```bash
# Set agent URL to very slow endpoint
# (Will timeout after 30 seconds)
```

### Test Success
```bash
# Set agent URL to running agent
http://localhost:3000
```

## Benefits

✅ **Works on HTTPS (Vercel, production)**
✅ **Detailed error logging for debugging**
✅ **User-friendly error messages**
✅ **Performance tracking**
✅ **30-second timeout protection**
✅ **Backward compatible** (still works with local/HTTPS agents)
