---
title: "Troubleshooting: Firebase auth/admin-restricted-operation Error"
description: "Learn how to resolve auth/admin-restricted-operation in Firebase Authentication by enabling providers and configuring Identity Platform."
category: "Web & Code"
tags: ["Firebase", "Authentication", "JavaScript", "Security", "Cloud"]
readTime: "5 min"
date: "2026-06-25"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **The invoked authentication provider (e.g., Anonymous or Email/Password) is disabled in Firebase Console** | Enable target sign-in provider under Firebase Console > Authentication > Sign-in method |
| **Privileged administrative method called from client-side Web SDK instead of Firebase Admin SDK** | Migrate administrative logic (claims, user bans) to backend Cloud Functions using Firebase Admin |

The exception `FirebaseError: Firebase: Error (auth/admin-restricted-operation)` in Firebase Authentication occurs when a client-side web or mobile application attempts an authentication workflow that is currently disabled in project settings or strictly reserved for authenticated service account credentials.

## 🚀 Step-by-Step Solution

### Step 1: Enable Sign-in Method in Firebase Console
If the exception triggers during `signInAnonymously()` or `createUserWithEmailAndPassword()`:
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Open your project and go to **Build > Authentication > Sign-in method**.
3. Locate the target provider (e.g., **Anonymous** or **Email/Password**).
4. Toggle **Enable** to active and click **Save**.

### Step 2: Delegate Privileged Operations to Firebase Admin SDK
Frontend applications cannot mutate user claims or perform administrative deletes:
```javascript
// ❌ INCORRECT: Calling admin methods directly from browser JavaScript
// ✔️ CORRECT: Execute inside secure Node.js Cloud Functions with Admin SDK:
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// Safely assign administrative role claims
export async function assignAdminRole(uid) {
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log(`Admin role successfully granted to ${uid}`);
}
```

### Step 3: Verify Google Cloud Identity Platform Settings
If your project operates under GCP Organization Policies:
1. Open **Google Cloud Console > Identity Platform > Settings**.
2. Under the **Security** tab, verify that user registration is not blocked by organizational guardrails.

### Step 4: Verify API Key API Restrictions
Confirm that your public client `apiKey` allows access to the *Identity Toolkit API*:
```javascript
// firebaseConfig.js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project"
};
```

## 🛡️ Prevention Advice
- **Never bundle service account JSON files in frontend bundles:** Keep `serviceAccountKey.json` strictly isolated on serverless backends or protected cloud runtimes.
- **Enforce Firestore security rules:** Always validate caller authorization states using `request.auth != null`.

## ❓ Frequently Asked Questions (FAQ)

### Why does anonymous sign-in throw admin-restricted-operation?
Anonymous authentication is disabled by default in new Firebase projects to prevent automated bot quota exhaustion.

### Can I restrict account creation exclusively to administrators?
Yes. You can disable public client self-signup in the Authentication settings and provision users programmatically via the Admin SDK.
