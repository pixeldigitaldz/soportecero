---
title: How to Fix Unhandled Promise Rejection Error in React and Async/Await
description: >-
  A step-by-step technical guide to identify and fix Unhandled Promise Rejection errors in React applications using async/await and fetch.
category: Web & Code
tags:
  - React
  - JavaScript
  - Web
readTime: 4 min
date: '2026-08-03'
---

The **"Unhandled Promise Rejection"** (or `Uncaught (in promise)`) error occurs in React and JavaScript applications whenever a Promise is rejected—due to a network glitch, bad HTTP response, or runtime exception—without an attached `.catch()` block or an enclosing `try...catch` statement. In React apps, unhandled rejections can cause silent UI freezes, stale state, or component crashes in production.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **`Uncaught (in promise) Error` in browser developer console during form submit or API fetch**: Async function executed without wrapping `await` calls in a `try...catch` block | Wrap `await` expressions inside `try...catch` blocks and manage error state |
| **Unhandled rejection triggered inside a `useEffect` hook**: Promise launched inside an event handler or effect missing proper error handling | Create an internal `async` function inside `useEffect` and handle errors explicitly |
| **HTTP 4xx/5xx API errors are not caught as promise rejections**: The native `fetch()` API does not reject promises on HTTP error status codes (e.g., 404 or 500) | Check `response.ok` before parsing JSON and throw an `Error` manually if false |

## 🚀 Step-by-Step Solution

### Step 1: Wrap `async/await` Calls in `try...catch...finally` Blocks
The primary cause of unhandled rejections is executing asynchronous logic without catching potential failures. Refactor your API handlers:

```javascript
// ❌ INCORRECT: If network fails or res.json() throws, the promise rejects unhandled
const handleFetchData = async () => {
  const res = await fetch('/api/user-data');
  const data = await res.json();
  setUser(data);
};

// ✅ CORRECT: Clean error interception and state management
const handleFetchData = async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/user-data');
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    setUser(data);
  } catch (err) {
    console.error('Failed to fetch user data:', err.message);
    setError(err.message || 'Connection error');
  } finally {
    setLoading(false);
  }
};
```

### Step 2: Handle Promises Properly Inside `useEffect`
In React, callback functions passed to `useEffect` cannot be directly marked as `async` because effects must return clean-up functions or `undefined`. Declare an internal async function:

```jsx
import React, { useState, useEffect } from 'react';

export const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true; // Prevents state updates on unmounted components

    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) throw new Error('User profile not found');
        const result = await response.json();
        
        if (isMounted) {
          setUser(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      }
    };

    fetchUserProfile();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (error) return <div className="error-banner">Error: {error}</div>;
  if (!user) return <div>Loading...</div>;

  return <div>{user.name}</div>;
};
```

### Step 3: Register a Global Fallback for Unhandled Rejections
To prevent uncaught promise errors from polluting your application logs unnoticed in production, attach a fallback listener to the `window` object:

```javascript
// In index.js / main.jsx / App.jsx
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn(`[Unhandled Rejection Captured]: ${event.reason}`);
    // Optional: Log error details to Sentry or monitoring service
    // event.preventDefault(); // Suppresses default browser console warning if needed
  });
}
```

## 🛡️ Prevention Advice

- **Remember `fetch()` Behavior**: Native `fetch()` only rejects on network failures (e.g., DNS lookup failure, connection refused), not on HTTP status 404 or 500. Always check `response.ok`.
- **Consider Axios for Auto-Rejection**: Libraries like `axios` automatically reject promises for any HTTP response outside the 2xx status range.
- **Implement React Error Boundaries**: Pair local async error handling with top-level React Error Boundaries to display graceful fallback UI components when unexpected errors occur.
