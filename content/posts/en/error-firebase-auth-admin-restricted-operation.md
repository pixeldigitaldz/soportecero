---
title: 'Fix: Error (auth/admin-restricted-operation) in Firebase'
description: 'How to fix the Firebase Auth error when trying to create or delete users and receiving admin-restricted-operation.'
category: 'Web & Code'
date: '2026-08-17'
readTime: '3 min'
tags: ['Firebase', 'Authentication', 'Web']
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Using Admin SDK in the Client** | Use Firebase Admin SDK from a server environment (Node.js/Cloud Functions) |
| **Operation blocked in frontend** | Avoid using `deleteUser` or mass creation actions from the browser |

## Step-by-Step Solution

**Understand why the error occurs**
The `auth/admin-restricted-operation` error pops up when you try to execute a privileged operation directly from the client side (Frontend: React, Angular, Vue, iOS, Android). Firebase prohibits creating massive accounts, listing all users, or deleting arbitrary accounts from the client for security reasons.

**Move the logic to the Backend or Cloud Functions**
To perform these actions (like having a web admin panel that creates accounts for employees), you must use the **Firebase Admin SDK**.
Create a Cloud Function (or an endpoint in your backend in Node.js, Python, etc.) to handle the request.
Example in Node.js with Firebase Admin:
```javascript
const admin = require('firebase-admin');
admin.initializeApp();

// Server function
async function createAdminUser(email, password) {
  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });
    console.log('User created:', userRecord.uid);
  } catch (error) {
    console.error('Error creating user:', error);
  }
}
```

**Call the function from your Frontend**
Instead of calling `createUser` from Firebase Auth on the frontend, call your new Cloud Function (or API) using fetch or HTTPS Callables:
```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const createUser = httpsCallable(functions, 'createAdminUserEndpoint');
createUser({ email: 'new@email.com', password: '123' });
```

## Prevention Tips
- **Least privileges:** Never include the service credentials (Service Account Keys) of Firebase Admin SDK inside your frontend code. That would compromise your entire database and authentication.
- **Custom Claims:** Use 'Custom Claims' to assign an "admin" role to certain users and verify that role within your Cloud Functions before allowing them to delete or create users.
