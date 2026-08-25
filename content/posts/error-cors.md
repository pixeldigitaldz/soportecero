---
title: "Solución Error CORS Access-Control-Allow-Origin: Guía Definitiva"
description: "Aprende a solucionar el error 'No Access-Control-Allow-Origin header is present' en Express, Next.js, Django, FastAPI y Nginx."
category: "Web y Código"
tags: ["CORS", "JavaScript", "Express", "Node.js", "APIs", "Seguridad"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El navegador bloquea la petición fetch/axios porque el backend no envía la cabecera Access-Control-Allow-Origin** | Añadir el middleware CORS correspondiente en el backend permitiendo el origen del frontend |
| **La petición preflight OPTIONS falla o retorna un código HTTP distinto de 200/204** | Configurar el servidor para responder exitosamente a las solicitudes preflight con método OPTIONS |

El error `Access to XMLHttpRequest at 'https://api.ejemplo.com' from origin 'https://app.ejemplo.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource` es un mecanismo de seguridad implementado por los navegadores web para evitar que scripts maliciosos de un dominio lean datos protegidos de otro origen distinto (mismo protocolo, dominio o puerto).

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar CORS en Node.js con Express
Si tu backend está construido con Express, utiliza el middleware oficial `cors`:
```javascript
import express from 'express';
import cors from 'cors';

const app = express();

// Lista de dominios autorizados
const allowedOrigins = [
  'https://app.tudominio.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por política CORS'));
    }
  },
  credentials: true, // Permitir envío de cookies y tokens Authorization
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Paso 2: Solución en Nginx como Proxy Inverso
Si gestionas tus APIs detrás de un servidor web Nginx, puedes inyectar las cabeceras directamente:
```nginx
location /api/ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://app.tudominio.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Content-Length' 0;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        return 204;
    }

    add_header 'Access-Control-Allow-Origin' 'https://app.tudominio.com' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    proxy_pass http://localhost:5000;
}
```

### Paso 3: Solución en Python (FastAPI / Django)
En frameworks modernos de Python:
```python
# En FastAPI:
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.tudominio.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Paso 4: Validar las cabeceras con cURL
Comprueba que tu servidor responde adecuadamente a una solicitud preflight de prueba:
```bash
curl -I -X OPTIONS https://api.tudominio.com/datos \
  -H "Origin: https://app.tudominio.com" \
  -H "Access-Control-Request-Method: POST"
```

## 🛡️ Consejos de Prevención
- **No utilices comodines (*) si envías credenciales:** Si configuras `Access-Control-Allow-Origin: *` y tu frontend envía cookies o cabeceras de autorización (`credentials: 'include'`), el navegador rechazará la conexión por motivos de seguridad.
- **Configura CORS en el backend, no en el frontend:** CORS es una restricción impuesta por el navegador que solo el servidor de destino puede autorizar.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué Postman o cURL funcionan pero mi navegador falla?
Porque Postman y cURL son clientes de terminal y no ejecutan motores de navegador web; por lo tanto, no aplican la política de seguridad del mismo origen (Same-Origin Policy).

### ¿Qué es una petición preflight (OPTIONS)?
Es una consulta preliminar que el navegador envía de forma automática antes de peticiones complejas (como aquellas con JSON o cabeceras personalizadas) para verificar si el servidor admite la operación.
