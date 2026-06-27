---
title: "Solución Error CORS Access-Control-Allow-Origin"
description: "Aprende a solucionar el error de CORS 'Access-Control-Allow-Origin' en JavaScript. Soluciones rápidas para Express, Node.js..."
category: "Web y Código"
tags: ["CORS", "JS", "Express"]
readTime: "4 min"
date: "2026-06-26"
---

El error de CORS (Cross-Origin Resource Sharing) ocurre estrictamente en el navegador del cliente. Sucede cuando una aplicación web en un dominio (ej. `localhost:3000`) intenta consumir recursos de una API alojada en otro dominio, y el servidor de la API no incluye las cabeceras HTTP necesarias para autorizar la petición.

## 🚀 Cómo solucionar el error paso a paso
La forma correcta de solucionar esto es configurar el **Backend (servidor)** para que acepte las peticiones de tu cliente. Jamás uses extensiones del navegador en entornos de producción.

### Paso 1: Solución en Node.js (Express)
Instala el middleware oficial de CORS en tu proyecto:
```bash
npm install cors
```
Luego, impleméntalo restringiendo el acceso únicamente a tus dominios de confianza:
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

const corsOptions = {
  origin: 'https://tusitioweb.com', // Tu dominio frontend
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### Paso 2: Solución mediante cabeceras HTTP nativas
Si manejas las respuestas del servidor manualmente, asegúrate de inyectar la siguiente cabecera en los encabezados de respuesta:
```http
Access-Control-Allow-Origin: https://tusitioweb.com
```

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas:
* Evita usar el comodín * en entornos de producción ya que expone tu API de forma pública.
* Configura correctamente los métodos permitidos (GET, POST, PUT, DELETE).
