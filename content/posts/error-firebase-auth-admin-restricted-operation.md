---
title: 'Solución: Error (auth/admin-restricted-operation) en Firebase'
description: 'Cómo solucionar el error de Firebase Auth cuando intentas crear o eliminar usuarios y recibes admin-restricted-operation.'
category: 'Web y Código'
date: '2026-08-17'
readTime: '3 min'
tags: ['Firebase', 'Autenticación', 'Web']
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Uso de SDK Admin en el Cliente** | Usar Firebase Admin SDK desde un entorno de servidor (Node.js/Cloud Functions) |
| **Operación bloqueada en frontend** | Evitar usar `deleteUser` o acciones masivas de creación desde el navegador |

## La Solución Paso a Paso

**Comprende por qué ocurre el error**
El error `auth/admin-restricted-operation` salta cuando intentas ejecutar una operación privilegiada directamente desde el lado del cliente (Frontend: React, Angular, Vue, iOS, Android). Firebase prohíbe crear cuentas masivamente, listar todos los usuarios, o borrar cuentas arbitrarias desde el cliente por seguridad.

**Mueve la lógica al Backend o Cloud Functions**
Para realizar estas acciones (como tener un panel de administrador web que crea cuentas para empleados), debes utilizar el **Firebase Admin SDK**.
Crea una Cloud Function (o un endpoint en tu backend en Node.js, Python, etc.) para manejar la solicitud.
Ejemplo en Node.js con Firebase Admin:
```javascript
const admin = require('firebase-admin');
admin.initializeApp();

// Función de servidor
async function crearUsuarioAdmin(email, password) {
  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });
    console.log('Usuario creado:', userRecord.uid);
  } catch (error) {
    console.error('Error al crear usuario:', error);
  }
}
```

**Llama a la función desde tu Frontend**
En lugar de llamar a `createUser` de Firebase Auth en el frontend, llama a tu nueva Cloud Function (o API) usando fetch o HTTPS Callables:
```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const crearUsuario = httpsCallable(functions, 'crearUsuarioAdminEndpoint');
crearUsuario({ email: 'nuevo@correo.com', password: '123' });
```

## Prevención
- **Privilegios mínimos:** Nunca incluyas las credenciales de servicio (Service Account Keys) de Firebase Admin SDK dentro de tu código frontend. Eso comprometería toda tu base de datos y autenticación.
- **Custom Claims:** Usa 'Custom Claims' para asignar un rol de "admin" a ciertos usuarios y verifica ese rol dentro de tus Cloud Functions antes de permitirles borrar o crear usuarios.
