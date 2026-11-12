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
readTime: 7 min
date: '2026-07-27'
---
El error de navegadores **"Access to XMLHttpRequest at '...' from origin '...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource"** es uno de los fallos más comunes al conectar una aplicación frontend (React, Vue, Next.js) con una API REST en Node.js y Express.

Este bloqueo lo ejecuta el navegador web por seguridad cuando el origen (dominio o puerto) del cliente es distinto al del servidor.

## Análisis de Arquitectura y Causa Raíz

En el ecosistema de **Node.js** y compiladores modernos de **JavaScript / TypeScript** (como `tsc`, `esbuild` o `swc`), la ejecución del código transcurre sobre el motor **V8** de Google acoplado a la librería de abstracción de E/S **libuv**, la cual gestiona el bucle de eventos (*Event Loop*) y el pool de hilos para operaciones asíncronas de red y sistema de archivos.

La causa raíz de esta incidencia proviene de desalineaciones en la resolución de módulos, el árbol de tipado AST o la frontera de renderizado:
1. **Árbol de resolución de dependencias y conflictos de pares (`peerDependencies`):** El gestor de paquetes (`npm` v7+) implementa un algoritmo determinista para construir el árbol de módulos en `node_modules`. Cuando dos paquetes requieren versiones mayores distintas de una misma librería compartida como dependencia de pares, el algoritmo de resolución rechaza forzar la instalación para prevenir colisiones en tiempo de ejecución, lanzando el error de conflicto de pares (`ERESOLVE`).
2. **Fase de hidratación y renderizado isomórfico (SSR vs Client):** En frameworks como Next.js o Remix, el código se ejecuta inicialmente en el servidor (entorno Node.js sin interfaz gráfica) antes de compilarse y enviarse al navegador. Si el código fuente intenta acceder a objetos globales del DOM como `window`, `document` o `localStorage` antes del montaje del componente en el cliente (`useEffect`), el motor lanza de inmediato una excepción crítica `ReferenceError: document is not defined` durante el Server-Side Rendering.
3. **Mapeo del Sistema de Tipos AST en TypeScript:** El compilador de TypeScript (`tsc`) genera un árbol de sintaxis abstracta (*Abstract Syntax Tree*) y valida la correspondencia de tipos en tiempo de transpilación. Si una interfaz carece de una definición de propiedad explícita o se utiliza una librería de JavaScript que no expone declaraciones de tipos (`@types/*`), el verificador de tipos emite el error TS2339 para salvaguardar la seguridad de tipos (*type safety*), bloqueando la compilación del proyecto.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **`CORS policy: No 'Access-Control-Allow-Origin'`**: El backend no envía la cabecera `Access-Control-Allow-Origin` | Instalar y configurar el middleware `cors` en Express |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l api-node

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u api-node -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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
