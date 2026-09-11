---
title: "[SOLUCIONADO] Cross-Origin Request Blocked en Route Handlers y API Routes de Next.js"
description: "Cómo solucionar el error de CORS en Next.js App Router (route.js) y Pages Router al consumir APIs desde dominios externos o móviles."
category: "Web y Código"
tags: ["Nextjs","React","CORS","Webdev"]
readTime: "4 min"
date: "2026-10-11"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Falta de cabeceras Access-Control-Allow-Origin en las respuestas del App Router de Next.js** | Configurar cabeceras de respuesta en next.config.js o añadir un middleware de CORS |
| **Navegadores bloqueando la petición previa (Preflight OPTIONS request) no manejada en route.js** | Exportar una función OPTIONS en app/api/.../route.js con las cabeceras permitidas |

Al consumir una API creada en Next.js (utilizando el directorio App Router `app/api/.../route.ts` o Pages Router `pages/api/...`) desde una aplicación frontend externa (como una app de React Native, Flutter o un subdominio diferente), el navegador bloquea la llamada con: `Access to fetch at ... from origin ... has been blocked by CORS policy: Response to preflight request doesn't pass access control check`.

> **Solución Rápida (1 Minuto):**
> 1. En el App Router de Next.js, exporta la respuesta para peticiones OPTIONS:
>    `export async function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }`
> 2. O habilita cabeceras globales en next.config.js con headers().

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Manejar la petición previa OPTIONS en Next.js App Router
Los navegadores envían una petición preliminar `OPTIONS` antes de cualquier `POST`, `PUT` o petición con cabeceras personalizadas. En tu archivo `app/api/tu-ruta/route.js`:
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  return Response.json({ mensaje: "Éxito" }, { headers: corsHeaders });
}
```

### Paso 2: Configurar cabeceras CORS globales en next.config.js
Si tienes muchas rutas API, es más limpio aplicar las cabeceras en `next.config.js` o `next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

### Paso 3: Manejo de credenciales (Cookies y Authorization)
Si tu aplicación envía cookies de sesión o tokens de autenticación con `credentials: 'include'`, el comodín `Access-Control-Allow-Origin: *` será rechazado por los navegadores por seguridad.
Debes especificar el dominio exacto:
```javascript
'Access-Control-Allow-Origin': 'https://tu-dominio-cliente.com',
'Access-Control-Allow-Credentials': 'true'
```

## 🛡️ Consejo de Prevención
* Nunca uses comodines `*` si transmites cookies de autenticación o datos sensibles.
* Utiliza el paquete oficial `cors` si sigues utilizando el Pages Router tradicional de Next.js (`pages/api`).

## Preguntas Frecuentes

### ¿Por qué ocurre este error en producción pero funcionaba en localhost?
Porque en desarrollo local ambos proyectos compartían el puerto o se originaban en localhost, lo que relaja las políticas en ciertos navegadores, mientras que en producción los dominios son completamente distintos.

### ¿Puedo solucionar CORS usando un Middleware de Next.js?
Sí, creando un archivo middleware.js en la raíz que intercepte rutas /api/:path* e inyecte los encabezados CORS en cada NextResponse.
