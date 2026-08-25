---
title: "How to Fix CORS Error Access-Control-Allow-Origin: Ultimate Guide"
description: "Learn how to resolve 'No Access-Control-Allow-Origin header is present' in Express, Next.js, Django, FastAPI, and Nginx."
category: "Web & Code"
tags: ["CORS", "JavaScript", "Express", "Node.js", "APIs", "Security"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Browser blocks fetch/axios request because backend lacks Access-Control-Allow-Origin header** | Add CORS middleware in backend authorizing frontend origin domain |
| **Preflight OPTIONS request fails or returns non-200/204 HTTP status code** | Configure server to intercept OPTIONS preflights with appropriate access control headers |

The error `Access to XMLHttpRequest at 'https://api.example.com' from origin 'https://app.example.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource` is a browser-enforced security mechanism (Same-Origin Policy) designed to prevent malicious scripts on one origin from accessing sensitive data on another origin without explicit authorization.

## 🚀 Step-by-Step Solution

### Step 1: Configure CORS Middleware in Express (Node.js)
In Node.js applications, apply the official `cors` package:
```javascript
import express from 'express';
import cors from 'cors';

const app = express();

const allowedOrigins = [
  'https://app.yourdomain.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Step 2: Handle CORS in Nginx Reverse Proxy
If running behind an Nginx proxy layer, inject appropriate headers directly:
```nginx
location /api/ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://app.yourdomain.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Content-Length' 0;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        return 204;
    }

    add_header 'Access-Control-Allow-Origin' 'https://app.yourdomain.com' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    proxy_pass http://localhost:5000;
}
```

### Step 3: Implement in Python (FastAPI / Django)
In FastAPI or Django REST Framework:
```python
# FastAPI implementation:
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.yourdomain.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Step 4: Test Preflight Headers with cURL
Verify headers from your terminal:
```bash
curl -I -X OPTIONS https://api.yourdomain.com/data \
  -H "Origin: https://app.yourdomain.com" \
  -H "Access-Control-Request-Method: POST"
```

## 🛡️ Prevention Advice
- **Avoid wildcard (*) with authenticated requests:** Browsers strictly reject responses containing `Access-Control-Allow-Origin: *` when `credentials: 'include'` is requested.
- **Configure CORS at the server level:** CORS cannot be bypassed or configured from client-side JavaScript alone.

## ❓ Frequently Asked Questions (FAQ)

### Why does Postman succeed while my web browser fails?
Postman is a standalone HTTP client that does not execute a browser engine; hence, it does not enforce the browser Same-Origin Policy.

### What is an OPTIONS preflight request?
It is an automated probe dispatched by the browser before complex HTTP methods to confirm that the destination server explicitly allows the request origin, method, and headers.
