---
title: "[SOLVED] Cross-Origin Request Blocked in Next.js Route Handlers & API Routes"
description: "How to fix CORS errors in Next.js App Router (route.js) and Pages Router when consumed by external web clients or mobile apps."
category: "Web & Code"
tags: ["Nextjs","React","CORS","Webdev"]
readTime: "4 min"
date: "2026-10-11"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Missing Access-Control-Allow-Origin headers on Next.js App Router Response objects** | Define global headers in next.config.js or implement CORS response middleware |
| **Browser preflight OPTIONS requests receiving 405 Method Not Allowed inside route.js** | Export an explicit OPTIONS handler function in app/api/.../route.js |

When accessing Next.js API endpoints (via modern App Router `app/api/.../route.ts` or legacy `pages/api/...`) from third-party client apps (React Native, Flutter, external web subdomains), modern browsers abort requests with: `Access to fetch at ... from origin ... has been blocked by CORS policy: Response to preflight request doesn't pass access control check`.

> **Quick Solution (1 Minute):**
> 1. In Next.js App Router, export an explicit OPTIONS preflight handler:
>    `export async function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }`
> 2. Or configure cross-origin rules inside next.config.js via async headers().

## 🚀 Step-by-Step Solution

### Step 1: Implement Explicit OPTIONS Preflight Route Handler
Browsers issue a preflight `OPTIONS` probe prior to sending requests with custom headers or non-simple HTTP verbs. In `app/api/your-route/route.js`:
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  return Response.json({ success: true }, { headers: corsHeaders });
}
```

### Step 2: Enforce Global API CORS Headers in next.config.js
For monolithic APIs with numerous routes, register CORS rules globally at the server engine level:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

### Step 3: Handle Authenticated Credential Transmission
When requests carry HTTP-only session cookies or authorization tokens via `credentials: 'include'`, wildcard `*` origins trigger security rejections.
Bind your exact origin domain explicitly:
```javascript
'Access-Control-Allow-Origin': 'https://app.clientdomain.com',
'Access-Control-Allow-Credentials': 'true'
```

## 🛡️ Prevention Tips
* Never leave wildcard origins `*` active in production if returning private user records.
* Consider implementing Next.js Edge Middleware for granular dynamic origin verification.

## Frequently Asked Questions

### Why did this endpoint succeed in local development but fail in production?
Local environments often share origin ports or run on localhost bypasses. Production brings distinct FQDNs, which immediately trigger browser preflight security policies.

### Can Next.js Middleware handle CORS for all routes at once?
Yes. Create `middleware.js` in your project root matching `/api/:path*` to append headers to every outgoing NextResponse.
