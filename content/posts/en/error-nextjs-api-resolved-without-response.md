---
title: 'Guide: Fix API resolved without sending a response for /api/ in Next.js'
description: 'Learn how to resolve the API resolved without sending a response warning in Next.js Pages and App Router when handling async promises and callbacks.'
category: 'Web & Code'
date: '2026-08-21'
readTime: '5 min'
tags: ['Next.js', 'Node.js', 'React']
---

The warning `API resolved without sending a response for /api/..., this may result in stalled requests` appears in Next.js Pages Router (`pages/api/*`) when your handler function's returned `Promise` resolves—or the synchronous function exits—before `res.send()`, `res.json()`, or `res.end()` is ever invoked. Left unresolved, clients hang until the gateway times out with `504 Gateway Timeout`.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Missing `await` before async DB or `fetch` call** | `await` every Promise before returning from `handler` |
| **Legacy callback library (`jwt.verify`, `formidable`, `multer`)** | Wrap the callback in `await new Promise((resolve, reject) => ...)` |
| **Conditional `if` branch exits without `return res...`** | Add an explicit `return res.status(405).end()` fallback |
| **Streaming / WebSocket / external `res.end()` intentional** | Export `config = { api: { externalResolver: true } }` |

## Root Cause & Technical Mechanics

Next.js's Pages Router API wrapper monitors the lifecycle of `export default async function handler(req, res)`. Because `handler` is an `async` function, Next.js awaits its returned `Promise`. As soon as that `Promise` settles, Next.js checks `res.writableEnded` (whether a response was flushed to the Node.js `http.ServerResponse` stream).

Three coding patterns cause `handler` to settle prematurely while work is still pending:
1. **Fire-and-Forget Promises:** Calling `db.query(...)` or `axios.post(...)` without `await` schedules a microtask and immediately returns `undefined` from `handler`. Next.js logs the warning while the response is still open.
2. **Event-Loop Callbacks:** Node.js callback APIs (such as `crypto.pbkdf2`, `jsonwebtoken`, or `busboy`) register a callback and return `undefined` synchronously. `handler` finishes before the callback ever fires `res.status(200).json(...)`.
3. **Unreturned Switch/If Branches:** Checking `if (req.method === 'POST')` without a trailing `else` or `return res.status(405).json(...)` lets `GET` requests fall off the end of the function silently.

## Step-by-Step Solution

### 1. Await All Asynchronous Calls and Return Every Branch

Ensure every async operation is awaited and every control-flow path explicitly ends the response:

```javascript
// pages/api/orders.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const orders = await db.collection('orders').find({ active: true }).toArray();
    return res.status(200).json({ orders });
  } catch (err) {
    console.error('Orders API failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
```

### 2. Promisify Callback-Based Middleware and Libraries

When using callback-style libraries (like `multer`, `formidable`, or `jwt.verify`), wrap them in a `Promise` and `await` it so Next.js does not exit early:

```javascript
import jwt from 'jsonwebtoken';

function verifyToken(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await verifyToken(token, process.env.JWT_SECRET);
    return res.status(200).json({ user });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### 3. Silence False Positives for Custom Proxies (`externalResolver`)

If you deliberately delegate `res` to an external Express middleware or `http-proxy-middleware` that closes the socket itself, tell Next.js not to warn:

```javascript
export const config = {
  api: {
    externalResolver: true,
  },
};
```

### 4. Verify Response Termination Locally

Test your endpoint with `curl -i` and confirm it returns a complete HTTP status and closes cleanly with zero warnings in your `next dev` terminal:

```bash
curl -i -X GET http://localhost:3000/api/orders
```

## Frequently Asked Questions

### Does this error happen in the Next.js App Router (`app/api/.../route.ts`)?
No, not with the same message. App Router Route Handlers require you to return a standard Web `Response` or `NextResponse` object directly (`return NextResponse.json(...)`). If an App Router handler finishes without returning a `Response`, Next.js throws a `TypeError: No response is returned from route handler`.

### Why does my API still return data in `next dev` even when the warning appears?
In development, Node.js keeps the underlying HTTP socket open until your unawaited callback eventually calls `res.json()`. However, in serverless production (Vercel, AWS Lambda), the runtime freezes or kills the execution context the instant the handler `Promise` resolves, causing `502`/`504` failures.

### Can `try/catch` hide a missing response?
Yes—if your `catch` block only runs `console.error(err)` without calling `res.status(500).json(...)`, any thrown error will leave the request hanging and trigger this warning.

## Prevention Advice

- **Enable `@typescript-eslint/no-floating-promises`:** Catch unawaited `Promise` calls directly in your IDE and CI pipeline before they reach production.
- **Prefer `return res.status(...).json(...)`:** Always prefix `res.json()` or `res.end()` with `return` so execution cannot accidentally continue into another branch.
- **Migrate new endpoints to App Router `route.ts`:** Returning `NextResponse.json()` enforces compile-time type safety on every branch when using TypeScript.
- **Add integration tests with `supertest` or `node-mocks-http`:** Assert both HTTP status codes and `res._isEndCalled()` across all HTTP methods (`GET`, `POST`, `PUT`, `OPTIONS`).
