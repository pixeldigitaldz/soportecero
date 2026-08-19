---
title: 'Guía: API resolved without sending a response for /api/ en Next.js'
description: 'Aprende a resolver el aviso API resolved without sending a response en Next.js Pages y App Router al manejar llamadas asíncronas o callbacks.'
category: 'Web y Código'
date: '2026-08-21'
readTime: '3 min'
tags: ['Next.js', 'Node.js', 'React']
---

El error y advertencia `API resolved without sending a response for /api/...` en Next.js ocurre cuando un endpoint de API (Route Handler o Pages API) ejecuta operaciones asíncronas como consultas a bases de datos o llamadas externas con promesas sin utilizar `await` o sin retornar una promesa explícita antes de que finalice la función controladora.

Este fallo provoca que el servidor de Node.js cierre prematuramente el contexto de la solicitud o genere fugas de memoria y respuestas colgadas (timeouts) en el cliente.

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Promesa asíncrona no esperada (`missing await`)** | Asegurarse de anteponer `await` a todas las llamadas a base de datos y APIs |
| **Uso de callbacks tradicionales (como Stripe webhooks o JWT)** | Envolver el callback en un objeto `new Promise((resolve, reject) => ...)` |
| **Falta de `return res.status(...)` en ramas condicionales** | Verificar que todas las rutas de código envíen una respuesta HTTP válida |

## La Solución Paso a Paso

**Asegura el uso de async/await en tu controlador**
Si estás usando el Pages Router (`pages/api/...`), cada promesa ejecutada dentro del handler debe ser esperada antes de invocar `res.json()` o `res.send()`:
```javascript
// pages/api/usuarios.js
export default async function handler(req, res) {
  try {
    // Si olvidas el await aquí, Next.js resolverá antes de que la DB responda
    const usuarios = await db.collection('usuarios').find().toArray();
    return res.status(200).json({ success: true, data: usuarios });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
```

**Maneja librerías basadas en callbacks con Promesas**
Si trabajas con librerías externas que usan firmas de callbacks (como `multer`, `passport` o `jsonwebtoken`), debes envolver la llamada:
```javascript
export default async function handler(req, res) {
  await new Promise((resolve, reject) => {
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        res.status(401).json({ error: 'Token inválido' });
        return resolve();
      }
      res.status(200).json({ user: decoded });
      return resolve();
    });
  });
}
```

**Migración a Route Handlers en App Router (Next.js 13+)**
Si utilizas el App Router (`app/api/.../route.js`), debes retornar un objeto `Response` o `NextResponse` nativo:
```javascript
// app/api/usuarios/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const data = await obtenerDatosDeServidor();
  return NextResponse.json(data);
}
```

## Prevención
- **Linter de promesas:** Habilita la regla `@typescript-eslint/no-floating-promises` en ESLint para advertir automáticamente sobre promesas no resueltas en tiempo de desarrollo.
- **Manejo de timeouts:** Configura tiempos límite de respuesta en tus clientes de base de datos para evitar que un bloqueo de red deje las solicitudes colgadas indefinidamente.
