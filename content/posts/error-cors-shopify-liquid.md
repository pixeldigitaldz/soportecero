---
title: "Cómo resolver: Error de CORS al consumir APIs externas desde plantillas de Shopify"
description: "Aprende a solucionar fallos de Cross-Origin Resource Sharing (CORS) en Liquid, JavaScript storefront y Proxies de Aplicación de Shopify."
category: "Web y Código"
tags: ["Shopify", "Liquid", "CORS", "JavaScript", "APIs", "Frontend"]
readTime: "5 min"
date: "2026-06-27"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Petición fetch() desde tema Liquid hacia servidor externo sin cabecera Access-Control-Allow-Origin** | Añadir cabeceras CORS en el backend externo o utilizar Shopify App Proxies |
| **Peticiones HTTP bloqueadas en tienda HTTPS por contenido mixto (Mixed Content)** | Asegurar que los endpoints utilicen HTTPS estricto y admitan peticiones preflight OPTIONS |

Cuando realizas una petición `fetch()` o `axios` desde el archivo JavaScript de un tema de Shopify (`theme.liquid` o secciones storefront) hacia tu API externa, el navegador bloquea la respuesta con el error: `Access to fetch at 'https://mi-api.com' from origin 'https://mi-tienda.myshopify.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource`.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar las cabeceras CORS en tu servidor Backend
La solución directa consiste en permitir que el dominio de tu tienda Shopify consulte tu servidor. Si usas Node.js con Express:
```javascript
import cors from 'cors';
import express from 'express';
const app = express();

// Configurar orígenes permitidos (tu dominio myshopify y dominio personalizado)
const allowedOrigins = [
  'https://mi-tienda.myshopify.com',
  'https://www.mi-tienda.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

### Paso 2: Utilizar Shopify App Proxies (Solución recomendada para apps)
Si estás desarrollando una aplicación o deseas evitar problemas de CORS y proteger tus credenciales de backend, utiliza los **Application Proxies** de Shopify:
1. En tu **Shopify Partner Dashboard > App Setup > App Proxy**, configura una ruta proxy como `apps/mi-proxy`.
2. Redirige esa ruta hacia la URL pública de tu backend: `https://mi-api.com/api/`.
3. En el código Liquid/JS de tu tienda, realiza la petición directamente a la misma URL de la tienda:
```javascript
// La petición se hace al mismo origen, eliminando el bloqueo CORS por completo
fetch('/apps/mi-proxy/obtener-datos', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(res => res.json())
.then(data => console.log('Datos recibidos:', data));
```

### Paso 3: Validar la respuesta preflight (OPTIONS)
Asegúrate de que tu servidor responda con código HTTP `200 OK` o `204 No Content` a las peticiones con método `OPTIONS` que los navegadores envían antes de enviar datos en formato JSON (`application/json`).

## 🛡️ Consejos de Prevención
- **No uses Access-Control-Allow-Origin: * si manejas datos privados:** Permitir todos los orígenes con asterisco (`*`) inhabilita el envío de cookies/tokens de autenticación (`credentials: true`) y expone tus endpoints a abusos desde cualquier sitio web.
- **Comprueba el protocolo HTTPS:** Shopify fuerza HTTPS. Cualquier intento de conectar con `http://` fallará por políticas de seguridad de contenido mixto del navegador.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Se pueden configurar cabeceras CORS directamente dentro del código Liquid?
No. Liquid es un lenguaje de plantillas que se renderiza en los servidores de Shopify para generar HTML estático. Las peticiones CORS ocurren del lado del navegador del cliente hacia tu servidor externo.

### ¿Por qué App Proxy es más seguro que CORS abierto?
Porque Shopify firma criptográficamente cada petición del App Proxy con un parámetro `signature` (HMAC SHA-256), permitiendo a tu backend verificar con certeza que la petición proviene legítimamente de tu tienda.
