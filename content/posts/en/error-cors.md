---
title: "How to Fix CORS Access-Control-Allow-Origin Error"
description: "Learn how to configure allow cors and fix CORS Access-Control-Allow-Origin errors on your backend step-by-step."
category: "Web & Code"
tags: ["CORS", "JS", "Express"]
readTime: "4 min"
date: "2026-06-26"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Missing CORS policy on the backend server** | Add CORS middleware to backend (e.g. `app.use(cors())` in Express) |
| **Preflight (OPTIONS) requests rejected due to missing allowed headers** | Allow `GET, POST, PUT, DELETE` methods and `Content-Type, Authorization` headers |


The CORS (Cross-Origin Resource Sharing) error occurs strictly in the client's browser. It happens when a web application on one domain (e.g., `localhost:3000`) tries to consume resources from an API hosted on another domain, and the API server does not include the necessary HTTP headers to authorize the request.

## 🚀 Step-by-Step Solution
The correct way to solve this is to configure the **Backend (server)** to accept requests from your client. Never use browser extensions in production environments.

### Step 1: Node.js (Express) Solution
Install the official CORS middleware in your project:
```bash
npm install cors
```
Then, implement it by restricting access only to your trusted domains:
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

const corsOptions = {
  origin: 'https://yourwebsite.com', // Your frontend domain
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### Step 2: Native HTTP Headers Solution
If you handle server responses manually, make sure to inject the following header into the response headers:
```http
Access-Control-Allow-Origin: https://yourwebsite.com
```

## 🛡️ Prevention Advice
Recommended security practices:
* Avoid using the wildcard * in production environments as it exposes your API publicly.
* Properly configure allowed methods (GET, POST, PUT, DELETE).
