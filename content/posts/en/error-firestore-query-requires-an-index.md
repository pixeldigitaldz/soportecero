---
title: 'Fix: The query requires an index in Cloud Firestore'
description: 'Learn how to resolve the FAILED_PRECONDITION: The query requires an index error when doing compound queries in Firebase.'
category: 'Web & Code'
date: '2026-08-19'
readTime: '2 min'
tags: ['Firebase', 'Firestore', 'Database']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Unindexed compound query** | Click on the link Firebase returns in the error message to create the index |
| **Missing indexes in deployments** | Use Firebase CLI to deploy `firestore.indexes.json` |

## Step-by-Step Solution

**Check the error message in the console**
When you try to make a query in Firestore that combines equality filters (`==`) with inequalities (`>`, `<`, `!=`) or multiple sorting (`orderBy`), Firestore will require a compound index.
The error message in the browser console will look like this:
`FirebaseError: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/...`

**Click on the auto-generated link**
Firestore is extremely friendly. The error itself includes an exact URL.
Simply copy and paste the `https://console.firebase.google.com/...` link into your browser. This will take you directly to the Firebase console with a modal already pre-filled with the exact fields you need to index.

**Wait for the index to build**
Once you click "Create" inside the console, the index state will change to *Building*. This process can take anywhere from a few minutes to a couple of hours depending on the size of your collection. When the state changes to *Enabled*, your query will work immediately without changing any code.

## Prevention Tips
- **Save your indexes in code:** To avoid issues migrating from staging to production, use the Firebase CLI to download your local indexes: `firebase firestore:indexes > firestore.indexes.json` and commit them to version control (Git).
- **Avoid excessive inequalities:** Remember that Firestore only allows one inequality per query (`<`, `<=`, `>`, `>=`, `!=`, `not-in`). If you need very complex filters on multiple fields, you may need an external search engine like Algolia.
