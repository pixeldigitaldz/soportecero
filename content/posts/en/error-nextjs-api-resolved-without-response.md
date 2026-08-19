---
title: 'Guide: Fix API resolved without sending a response for /api/ in Next.js'
description: 'Learn how to resolve the API resolved without sending a response warning in Next.js Pages and App Router when handling async promises and callbacks.'
category: 'Web & Code'
date: '2026-08-21'
readTime: '3 min'
tags: ['Next.js', 'Node.js', 'React']
---

The warning `API resolved without sending a response for /api/...` in Next.js occurs when an API Route Handler or Pages API endpoint executes asynchronous logic (such as database queries, third-party APIs, or webhooks) without `await` or without resolving a returned Promise before the handler function finishes execution.

This issue can cause Node.js server connections to hang, resulting in frontend request timeouts, memory leaks, and dropped HTTP responses.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Unawaited async Promise (`missing await`)** | Prefix all database queries and external fetch requests with `await` |
| **Callback-based middleware (Stripe webhooks, JWT)** | Wrap legacy callback functions in `new Promise((resolve, reject) => ...)` |
| **Missing response in conditional branch** | Ensure every `if/else` execution path returns a valid `res.status()` or `Response` |

## Step-by-Step Solution

**Ensure proper async/await flow in your handler**
If you are using the Pages Router (`pages/api/...`), every asynchronous database call must be completed before returning the response:
```javascript
// pages/api/users.js
export default async function handler(req, res) {
  try {
    // Omitting await will trigger the unhandled resolution warning
    const users = await db.collection('users').find().toArray();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

**Wrap callback-based libraries inside Promises**
When dealing with older packages that do not provide native Promises (e.g. `jsonwebtoken` or `multer`), explicitly wrap the call:
```javascript
export default async function handler(req, res) {
  await new Promise((resolve) => {
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        res.status(401).json({ error: 'Invalid token' });
        return resolve();
      }
      res.status(200).json({ user: decoded });
      return resolve();
    });
  });
}
```

**Use App Router Route Handlers (Next.js 13+)**
For the modern App Router (`app/api/.../route.js`), return native web standard `Response` or `NextResponse` instances:
```javascript
// app/api/users/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const data = await fetchUserData();
  return NextResponse.json(data);
}
```

## Prevention Tips
- **ESLint floating promise rule:** Enable `@typescript-eslint/no-floating-promises` to catch unhandled async promises at build time.
- **Client timeout limits:** Configure timeout handlers on database drivers to guarantee requests fail gracefully instead of hanging connections indefinitely.
