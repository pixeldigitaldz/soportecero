---
title: "Troubleshooting: Error (auth/admin-restricted-operation) en Firebase"
description: "Aprende a solucionar el error auth/admin-restricted-operation en Firebase Authentication habilitando proveedores y configurando Identity Platform."
category: "Web y Código"
tags: ["Firebase", "Authentication", "JavaScript", "Seguridad", "Cloud"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El método de autenticación invocado (ej. Anónimo o Correo/Contraseña) está deshabilitado en Firebase Console** | Habilitar el proveedor correspondiente en Firebase Console > Authentication > Sign-in method |
| **Operación administrativa restringida ejecutada desde el SDK cliente sin privilegios de Admin SDK** | Mover la operación sensible (como borrado masivo o creación de usuarios con claims) a Cloud Functions o Node.js con Firebase Admin SDK |

La excepción `FirebaseError: Firebase: Error (auth/admin-restricted-operation)` en Firebase Authentication ocurre cuando tu aplicación cliente intenta ejecutar una acción de autenticación que no ha sido activada en la consola de Firebase o que está reservada exclusivamente para credenciales de administrador con privilegios de cuenta de servicio.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Habilitar el proveedor de autenticación en Firebase Console
Si el error ocurre al llamar a `signInAnonymously()` o `createUserWithEmailAndPassword()`:
1. Ingresa a [Firebase Console](https://console.firebase.google.com/).
2. Selecciona tu proyecto y dirígete a **Build > Authentication > Sign-in method** (Métodos de inicio de sesión).
3. Localiza el proveedor que estás invocando (por ejemplo, **Anónimo** o **Correo electrónico/Contraseña**).
4. Haz clic en el proveedor, marca la casilla **Habilitar** (Enable) y pulsa **Guardar**.

### Paso 2: Ejecutar operaciones administrativas en un entorno seguro (Admin SDK)
Si intentas modificar Custom Claims, deshabilitar usuarios o gestionar roles de seguridad desde el frontend, Firebase bloqueará la llamada:
```javascript
// ❌ INCORRECTO: No intentes asignar claims desde el frontend
// ✔️ CORRECTO: Ejecutar en Node.js Backend o Cloud Functions con Firebase Admin:
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// Asignar rol de administrador a un usuario de forma segura
export async function setUserAsAdmin(uid) {
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log(`Rol de administrador asignado exitosamente a ${uid}`);
}
```

### Paso 3: Revisar la configuración de Google Cloud Identity Platform
Si tu proyecto de Firebase está vinculado a Google Cloud Platform:
1. Accede a **Google Cloud Console > Identity Platform > Settings**.
2. En la pestaña **Security**, verifica que la creación de usuarios no esté bloqueada por directivas de acceso condicional o políticas de organización.

### Paso 4: Validar la clave de API de Firebase
Asegúrate de que la clave de API web (`apiKey`) en tu configuración de inicialización de Firebase no tenga restricciones de API que bloqueen *Identity Toolkit API*:
```javascript
// firebaseConfig.js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto"
};
```

## 🛡️ Consejos de Prevención
- **No expongas credenciales de servicio en el frontend:** El archivo de claves privadas `serviceAccountKey.json` nunca debe incluirse en código público de cliente o repositorios Git.
- **Implementa reglas de seguridad en Firestore/Storage:** Valida siempre los tokens de usuario mediante `request.auth != null` en las reglas de seguridad.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué signInAnonymously arroja admin-restricted-operation?
Porque la autenticación anónima viene deshabilitada por defecto en todos los proyectos nuevos de Firebase para prevenir abusos de cuotas.

### ¿Puedo habilitar la creación de usuarios solo para administradores?
Sí. En la configuración avanzada de Authentication puedes desactivar el registro público de nuevos usuarios y gestionarlos únicamente mediante el Admin SDK.
