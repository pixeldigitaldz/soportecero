---
title: "Solution: CORS Error When Consuming External APIs from Shopify Templates"
description: "Learn how to resolve Cross-Origin Resource Sharing (CORS) errors in Liquid themes, storefront JavaScript, and Shopify App Proxies."
category: "Web & Code"
tags: ["Shopify", "Liquid", "CORS", "JavaScript", "APIs", "Frontend"]
readTime: "5 min"
date: "2026-07-24"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **fetch() request from Liquid theme to external backend missing Access-Control-Allow-Origin** | Add proper CORS response headers on external server or route via Shopify App Proxy |
| **Blocked preflight OPTIONS requests or HTTP mixed content on HTTPS storefront** | Ensure endpoints support HTTPS and return HTTP 200/204 to OPTIONS requests |

When sending `fetch()` or `axios` requests from a Shopify theme storefront script to an external backend, the browser halts execution with: `Access to fetch at 'https://my-api.com' from origin 'https://my-store.myshopify.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`.

## 🚀 Step-by-Step Solution

### Step 1: Configure CORS Headers on External Backend
Allow the Shopify storefront domain to communicate with your backend. In Node.js / Express:
```javascript
import cors from 'cors';
import express from 'express';
const app = express();

const allowedOrigins = [
  'https://my-store.myshopify.com',
  'https://www.my-store.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

### Step 2: Utilize Shopify App Proxies (Recommended Architecture)
Shopify **Application Proxies** tunnel requests through your store domain, completely avoiding CORS restrictions:
1. In **Shopify Partner Dashboard > App Setup > App Proxy**, define a proxy path such as `apps/my-proxy`.
2. Point the destination to your server URL: `https://my-api.com/api/`.
3. Execute client-side storefront requests against the same-origin URL:
```javascript
// Fetch directly from same origin - no CORS headers needed
fetch('/apps/my-proxy/get-data', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(res => res.json())
.then(data => console.log('Storefront Data:', data));
```

### Step 3: Support Preflight OPTIONS Requests
Ensure your backend returns HTTP 200 or 204 status codes for preflight `OPTIONS` requests when `Content-Type: application/json` is utilized.

## 🛡️ Prevention Advice
- **Do not use wildcard wildcard (*) with credentials:** Wildcard origin matching disables cookies/authorization tokens and leaves endpoints open to third-party scraping.
- **Enforce HTTPS everywhere:** Shopify storefronts run strictly over HTTPS. Any HTTP resource request will be blocked immediately as Mixed Content.

## ❓ Frequently Asked Questions (FAQ)

### Can CORS headers be set in Liquid files?
No. Liquid is a server-side template engine that produces HTML. CORS validation happens on the client browser when dispatching AJAX requests to external hosts.

### Why is App Proxy superior for private store data?
Shopify signs all App Proxy requests using HMAC-SHA256 headers, allowing your backend to verify that requests originate from an authorized store session.
