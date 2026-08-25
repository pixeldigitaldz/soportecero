---
title: "How to fix: The query requires an index in Cloud Firestore"
description: "Learn how to resolve missing composite index errors in Cloud Firestore queries with Firebase Console and firestore.indexes.json."
category: "Web & Code"
tags: ["Firebase", "Cloud Firestore", "JavaScript", "NoSQL", "Databases"]
readTime: "5 min"
date: "2026-08-19"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Composite Firestore query combining multiple equality/range filters or orderBy fields** | Create composite index via direct link in error log or Firebase Console |
| **Missing composite index definition in project firestore.indexes.json** | Define collection, field paths, and sorting order in firestore.indexes.json and deploy via Firebase CLI |

The error FAILED_PRECONDITION: The query requires an index in Cloud Firestore occurs when executing complex queries that filter on multiple distinct fields or combine inequality filters (<, <=, >, >=) with an orderBy() clause on a different field. Firestore enforces composite indexing to guarantee predictable O(N) query performance regardless of dataset scale.

## 🚀 Step-by-Step Solution

### Step 1: Create the Index Automatically via the Error URL
During local development, the fastest method to resolve this is clicking the generated URL found inside your browser or backend terminal output:
```javascript
// Example query requiring a composite index:
const q = query(
  collection(db, "orders"),
  where("status", "==", "completed"),
  where("totalAmount", ">", 100),
  orderBy("totalAmount", "desc")
);
```
1. Copy the URL string in the error message starting with https://console.firebase.google.com/...
2. Open it in your browser. The Firebase Console automatically populates the required collection and field rules.
3. Click **Create Index** and wait until the status transitions from Building to Enabled.

### Step 2: Persist Index Definitions in firestore.indexes.json
To ensure indices persist across CI/CD pipelines and multi-developer teams, add the composite index definition to your repository:
```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "totalAmount", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Step 3: Deploy Indexes via Firebase CLI
Deploy the updated index configuration directly to your project:
```bash
# Deploy only Cloud Firestore indexes
npx firebase deploy --only firestore:indexes
```

### Step 4: Verify Query Execution
Run your application queries again to verify the FAILED_PRECONDITION exception is cleared.

## 🛡️ Prevention Advice
- **Structure query patterns intentionally:** Combine compound states where feasible (e.g. status_region: "active_us") to minimize complex multi-property index overhead.
- **Mind index quotas:** Firestore allows up to 200 composite indexes per database. Periodically audit and prune unused index definitions.

## ❓ Frequently Asked Questions (FAQ)

### How long does Firestore index generation take?
For small collections, indexing finishes in under a minute. For collections containing millions of records, background indexing can take between 10 and 30 minutes without downtime.

### Do single-field queries require manual composite indexes?
No. Firestore automatically creates single-field indexes in both ascending and descending order for all top-level document fields.
