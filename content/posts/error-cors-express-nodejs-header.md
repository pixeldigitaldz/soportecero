---
title: >-
  Cómo solucionar el error CORS 'No Access-Control-Allow-Origin' en Express y
  Node.js
description: >-
  Aprende a solucionar los bloqueos de políticas CORS en tu backend con Express
  y Node.js configurando correctamente las cabeceras HTTP y el middleware.
category: Web y Código
tags:
  - Nodejs
  - Express
  - CORS
readTime: 4 min
date: '2026-07-27'
---

El error de navegadores **"Access to XMLHttpRequest at '...' from origin '...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource"** es uno de los fallos más comunes al conectar una aplicación frontend (React, Vue, Next.js) con una API REST en Node.js y Express.

Este bloqueo lo ejecuta el navegador web por seguridad cuando el origen (dominio o puerto) del cliente es distinto al del servidor.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **`CORS policy: No 'Access-Control-Allow-Origin'`**: El backend no envía la cabecera `Access-Control-Allow-Origin` | Instalar e integrar el middleware `cors` en Express |
| **Bloqueo en peticiones con `POST`, `PUT` o `DELETE`**: Fallo en la petición de verificación previa (`OPTIONS` preflight) | Habilitar el manejo de solicitudes preflight en el servidor |
| **Error al enviar cookies o JWT (`credentials: true`)**: Incompatibilidad al usar comodín `*` con credenciales | Especificar el origen exacto `origin: 'http://localhost:3000'` |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Instalar y configurar el paquete `cors` en Express
La solución más limpia en Express es utilizar el paquete oficial `cors`. Instálalo ejecutando:

```bash
npm install cors
```

Luego, en tu archivo principal de la API (`server.js` o `app.js`), habilita la configuración básica:

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Permitir solicitudes desde tu frontend
const corsOptions = {
  origin: 'http://localhost:3000', // Reemplaza por tu dominio en producción
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
```

### Paso 2: Permitir múltiples orígenes (Entornos de Desarrollo y Staging)
Si necesitas permitir peticiones desde localhost durante el desarrollo y desde tu dominio en producción, utiliza una función dinámica en el campo `origin`:

```javascript
const allowedOrigins = ['http://localhost:3000', 'https://soportecero.com'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por política CORS'));
    }
  },
  credentials: true
}));
```

### Paso 3: Asegurar la respuesta a solicitudes Preflight (`OPTIONS`)
Para peticiones HTTP con encabezados personalizados o métodos de modificación, el navegador envía primero una petición `OPTIONS`. Asegúrate de responder correctamente:

```javascript
// Responder a todas las solicitudes preflight
app.options('*', cors(corsOptions));
```

## 🛡️ Consejos de Prevención

- **Evita usar `origin: '*'` con credenciales**: Si tu app usa cookies de sesión o encabezados `Authorization`, los navegadores modernos rechazarán el comodín `*`.
- **Valida tus proxies inversos**: Si usas Nginx o Cloudflare frente a Node.js, asegúrate de no duplicar las cabeceras `Access-Control-Allow-Origin` tanto en el proxy como en la app Express.
