---
title: "Solución: Error de CORS al consumir APIs externas desde plantillas de Shopify"
description: "Aprende a solucionar shopify cors policy en tu tienda y resolver el bloqueo de seguridad 'Access-Control-Allow-Origin' al hacer peticiones fetch."
category: "Web y Código"
tags: ["Shopify", "CORS", "JavaScript"]
readTime: "4 min"
date: "2026-06-27"
---

Para **solucionar shopify cors policy en tu tienda** de manera definitiva cuando el error `Access-Control-Allow-Origin` (CORS) salta en la consola del navegador al intentar hacer una petición `fetch` desde un script de tu plantilla de Shopify hacia un servidor externo propio (por ejemplo, para cargar planners digitales o diarios personalizados desde una base de datos externa), debes configurar la autorización en el origen. El navegador bloquea la respuesta porque el servidor externo no autoriza explícitamente al dominio de tu tienda de Shopify a leer sus datos.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar las cabeceras en tu servidor externo
La solución real no se hace dentro de Shopify, sino en el servidor backend que recibe la petición. Debes responder agregando la cabecera CORS correspondiente.
- **Si usas Node.js (Express), instala y configura el middleware oficial:**
  ```bash
  npm install cors
  ```
  Luego aplícalo restringiendo el acceso únicamente a tu tienda:
  ```javascript
  const cors = require('cors');
  app.use(cors({
    origin: 'https://tu-tienda-shopify.com'
  }));
  ```

### Paso 2: Utilizar los Proxies de Aplicación de Shopify (Alternative Premium)

Si no tienes acceso para modificar el servidor externo, puedes usar el App Proxy de Shopify. Esto hace que tu script le consulte directamente a los propios servidores de Shopify, y ellos hacen la petición por detrás en el backend, evadiendo por completo las restricciones de CORS del navegador.

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Jamás uses el comodín de asterisco `Access-Control-Allow-Origin: *` en servidores de producción que manejen datos confidenciales de usuarios o descargas digitales pagas. Hacer esto le abre la puerta a cualquier sitio web malicioso para hacer peticiones en nombre de tus usuarios y robar información de tu base de datos.
