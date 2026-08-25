---
title: "Fix: Quota exceeded for quota metric Read requests in Firestore"
description: "Learn how to fix Firestore Read quota exceeded errors using client-side cache persistence, pagination, and server aggregation counts."
category: "Web & Code"
tags: ["Firebase", "Cloud Firestore", "JavaScript", "Optimization", "NoSQL", "Cloud"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Excessive document reads caused by unindexed scans, unpaginated collections, or leaked listeners** | Implement cursor pagination via `limit()` / `startAfter()` and enable local cache persistence |
| **Spark free tier 50,000 daily read limit exceeded by client development loops** | Identify offending query in Firebase Console and configure billing budget thresholds |

The error `RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Read requests' and limit 'Read requests per day' of service 'firestore.googleapis.com'` indicates your application exhausted the complimentary 50,000 daily document reads granted by the Firebase Spark plan. All subsequent read operations fail until quota refresh.

## 🚀 Step-by-Step Solution

### Step 1: Enable Multi-Tab Local Cache Persistence
Eliminate redundant network reads on page refresh by enabling offline disk persistence:
```javascript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Initialize Firestore with robust local storage caching
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

### Step 2: Enforce Cursor-Based Pagination
Never fetch entire collections in a single round-trip. Segment results into discrete chunks:
```javascript
import { collection, query, orderBy, startAfter, limit, getDocs } from "firebase/firestore";

// Efficient cursor-based pagination
async function fetchPage(lastVisibleDoc = null) {
  let q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(15)
  );

  if (lastVisibleDoc) {
    q = query(q, startAfter(lastVisibleDoc));
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const lastDoc = snapshot.docs[snapshot.docs.length - 1];

  return { items, lastDoc };
}
```

### Step 3: Use Aggregation Queries for Document Counting
To count collection documents, avoid full document fetching. Use `getCountFromServer()`, which consumes only **1 single read** regardless of collection size:
```javascript
import { collection, getCountFromServer } from "firebase/firestore";

// Count millions of documents with exactly 1 document read cost
const coll = collection(db, "orders");
const snapshot = await getCountFromServer(coll);
console.log("Total orders:", snapshot.data().count);
```

### Step 4: Unsubscribe Realtime onSnapshot Listeners
In frontend frameworks (React/Vue), lingering listeners continue streaming document mutations indefinitely:
```javascript
// Inside React useEffect:
useEffect(() => {
  const unsubscribe = onSnapshot(doc(db, "chats", chatId), (doc) => {
    setMessages(doc.data());
  });

  // Teardown listener on component unmount
  return () => unsubscribe();
}, [chatId]);
```

## 🛡️ Prevention Advice
- **Configure Google Cloud Billing Alerts:** Set up automated email budget thresholds in Google Cloud Console to catch anomalous usage spikes early.
- **Denormalize relational aggregates:** Maintain summary counters inside parent documents to bypass multi-document read traversals.

## ❓ Frequently Asked Questions (FAQ)

### What time does the daily Spark quota reset?
Firestore daily quotas reset at midnight Pacific Time (PST/PDT), which corresponds to 00:00 UTC-8.

### Do cached reads consume daily quota limits?
No. Reads satisfied from IndexedDB client cache are completely free and consume zero network read quota.
