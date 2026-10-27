---
title: 'Fix Next.js Error ReferenceError: document is not defined (App Router & SSR)'
description: >-
  Learn how to fix 'ReferenceError: document is not defined' and 'window is not defined' in Next.js App Router using dynamic imports and useEffect.
category: Systems & Servers
tags:
  - Next.js
  - React
  - SSR
  - JavaScript
  - TypeScript
  - Frontend
readTime: 4 min
date: '2026-10-26'
---

The exception `ReferenceError: document is not defined` (along with its counterpart `ReferenceError: window is not defined`) is one of the most frequent errors encountered when building applications with Next.js (across both Pages Router and App Router). This failure happens whenever client-side JavaScript code attempts to interact with the browser's Document Object Model (DOM) during Server-Side Rendering (SSR) or ahead-of-time build generation in Node.js, where global `window` and `document` objects are unavailable.

## Quick Diagnostics

| Cause | Solution |
|---|---|
| **Direct access to document or window in component render body** | Move DOM logic into the useEffect hook or verify typeof window !== 'undefined' |
| **Third-party UI or charting library (Leaflet, Chart.js, canvas) evaluated on server** | Import the component dynamically using next/dynamic with ssr: false |
| **Client component missing directive in Next.js App Router** | Add the 'use client' directive at the very first line of the component file |

## Step-by-Step Solution

### Step 1: Declare the component as a Client Component with 'use client'
In the Next.js App Router paradigm (`app/`), all components are Server Components by default. If your component requires event listeners or client browser APIs, declare the directive on line 1:

```tsx
'use client';

import React, { useState } from 'react';

export default function InteractiveCounter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Clicks: {count}
    </button>
  );
}
```

### Step 2: Move DOM access inside the useEffect hook
Even with `'use client'`, Next.js pre-renders the initial HTML on the server. The `useEffect` hook ensures its execution occurs strictly inside the browser runtime after hydration:

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function WindowDimensions() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    // Safe: executes exclusively on the browser
    setWidth(window.innerWidth);

    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (width === null) return <div>Calculating dimensions...</div>;

  return <p>Window width: {width}px</p>;
}
```

### Step 3: Load third-party libraries dynamically with ssr: false
If a package relies on `document.createElement` or `window` upon module import (common in mapping libraries or rich-text editors), disable server-side rendering for that module using `next/dynamic`:

```tsx
'use client';

import dynamic from 'next/dynamic';

// Disable Server-Side Rendering for this specific component
const LeafletMap = dynamic(
  () => import('./LeafletMapComponent'),
  {
    ssr: false,
    loading: () => <p>Loading map widget...</p>
  }
);

export default function LocationPage() {
  return (
    <section>
      <h1>Our Location</h1>
      <LeafletMap />
    </section>
  );
}
```

### Step 4: Verify the window object before reading localStorage
If you need to retrieve values from `localStorage` or `sessionStorage` in utility helpers outside React lifecycle hooks, guard the execution environment first:

```typescript
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') {
    // Server environment: return early to prevent ReferenceError
    return null;
  }
  return localStorage.getItem('auth_token');
}
```

## Frequently Asked Questions

### Why does 'use client' alone not resolve window is not defined?
The `'use client'` directive demarcates the boundary between Server and Client components, but Next.js still executes the render function of Client Components on the server to output initial static markup. Any code referencing `window` outside of `useEffect` will fail during this server pre-render.

### Does setting ssr: false harm page SEO in Google?
Markup rendered inside a component with `ssr: false` will not be present in the initial static HTML received by search crawlers. Reserve `ssr: false` for client-only widgets, dashboards, canvas graphics, and interactive maps, while keeping headings, descriptions, and primary textual content inside Server Components.

### What is the difference between typeof window !== 'undefined' and useEffect?
While `typeof window !== 'undefined'` checks the immediate environment synchronously, conditionally rendering different JSX based on this check can trigger hydration mismatch errors. Using `useEffect` to trigger client-side re-renders avoids hydration bugs.

## Prevention Advice

* Never call `document.getElementById`, `window.location`, or `navigator.userAgent` in the module root scope or component render bodies.
* Keep data fetching and structural semantic HTML in Server Components, passing data down to focused client leaf components.
* Enforce ESLint rules like `react-hooks/exhaustive-deps` to maintain deterministic client state synchronization.
