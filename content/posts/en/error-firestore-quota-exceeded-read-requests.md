---
title: 'Error: Quota exceeded for quota metric Read requests in Firestore'
description: 'Learn to diagnose why you exceeded your free reading limit in Firebase and how to fix infinite loops in your frontend.'
category: 'Web & Code'
date: '2026-08-18'
readTime: '3 min'
tags: ['Firebase', 'Firestore', 'React']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Infinite loop in `useEffect` (React)** | Add the correct dependencies to the hook's `[]` array |
| **Duplicate listener (`onSnapshot`)** | Unsubscribe from the listener when unmounting the component |
| **Reading too many documents** | Use pagination (`limit`, `startAfter`) instead of fetching the whole collection |

## Step-by-Step Solution

**Check your React hooks (or similar framework)**
The number one cause of this error (exceeding 50,000 free daily reads in seconds) is a misconfigured `useEffect`. If you do a `getDocs` inside an effect and it updates the state without a correct dependency array, the component will infinitely re-render.
*Incorrect:*
```javascript
useEffect(() => {
  fetchData();
}); // <- Missing dependency array
```
*Correct:*
```javascript
useEffect(() => {
  fetchData();
}, []); // <- Runs only once on mount
```

**Clean up your real-time listeners**
If you use `onSnapshot` to listen for real-time changes, Firebase will charge you a read for each document initially. But if the component unmounts and remounts without cleaning up the previous listener, you'll create multiple ghost connections.
Make sure to return the cleanup function:
```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, "cities"), (snapshot) => {
    // ...
  });

  return () => unsubscribe(); // Vital cleanup on unmount
}, []);
```

**Check your Firebase console usage**
Interestingly, leaving the Cloud Firestore tab open in the Firebase web console counts as reads. If you have a collection that changes very quickly and you leave the console open for hours, you will deplete your quota quickly without realizing it.

## Prevention Tips
- **Pagination:** Never fetch whole collections. Use `.limit(20)` and pagination to fetch only what the user sees.
- **Local Cache:** Enable offline persistence in Firestore so recurring reads come from the browser's local cache instead of billing server reads: `enableIndexedDbPersistence(db)`.
