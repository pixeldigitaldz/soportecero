---
title: How to Fix CORS 'No Access-Control-Allow-Origin' Error in Express and Node.js
description: >-
  Learn how to resolve CORS policy blocks in your Express and Node.js backend by
  properly configuring HTTP headers and middleware.
category: Web & Code
tags:
  - Nodejs
  - Express
  - CORS
readTime: 4 min
date: '2026-07-27'
---

The browser error **"Access to XMLHttpRequest at '...' from origin '...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource"** is one of the most common issues encountered when connecting a frontend application (React, Vue, Next.js) with a REST API running on Node.js and Express.

This block is enforced by the web browser for security reasons whenever the client's origin (domain or port) differs from the server's origin.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `CORS policy: No 'Access-Control-Allow-Origin'` | Backend is not sending the `Access-Control-Allow-Origin` header | Install and configure the `cors` middleware in Express |
| Blocked on `POST`, `PUT`, or `DELETE` requests | Failed preflight verification (`OPTIONS` request) | Enable preflight request handling on the server |
| Error sending cookies or JWT (`credentials: true`) | Incompatibility when using wildcard `*` with credentials | Specify the exact origin `origin: 'http://localhost:3000'` |

## 🚀 Step-by-Step Solution

### Step 1: Install and configure the `cors` package in Express
The cleanest way to handle CORS in Express is using the official `cors` package. Install it by running:

```bash
npm install cors
```

Then, in your main API file (`server.js` or `app.js`), enable the basic configuration:

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Allow requests from your frontend
const corsOptions = {
  origin: 'http://localhost:3000', // Replace with your production domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
```

### Step 2: Allow multiple origins (Development & Staging Environments)
If you need to allow requests from localhost during development and from your live domain in production, use a dynamic function for `origin`:

```javascript
const allowedOrigins = ['http://localhost:3000', 'https://soportecero.com'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));
```

### Step 3: Handle Preflight (`OPTIONS`) requests properly
For HTTP requests with custom headers or non-simple methods, the browser sends a preflight `OPTIONS` request first. Ensure your server responds to it:

```javascript
// Respond to all preflight requests
app.options('*', cors(corsOptions));
```

## 🛡️ Prevention Advice

- **Avoid using `origin: '*'` with credentials**: If your application relies on session cookies or `Authorization` headers, modern browsers will reject the wildcard `*`.
- **Validate reverse proxies**: If you run Nginx or Cloudflare in front of Node.js, ensure you don't duplicate `Access-Control-Allow-Origin` headers on both the proxy and the Express app.
