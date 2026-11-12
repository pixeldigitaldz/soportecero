---
title: 'Cómo solucionar el error CORS (Access-Control-Allow-Origin y Allow CORS) en APIs'
description: >-
  Guía definitiva para solucionar el error allow cors y Access-Control-Allow-Origin en APIs Node.js, Express, Next.js, Django, FastAPI y servidores Nginx.
category: Web y Código
tags:
  - CORS
  - JavaScript
  - Express
  - Node.js
  - APIs
  - Seguridad
readTime: 7 min
date: '2026-06-25'
---
El bloqueo por política de CORS ('has been blocked by CORS policy: No Access-Control-Allow-Origin header is present') ocurre cuando un frontend intenta consumir datos de una API sin que esta declare permisos explícitos para permitir el origen (allow cors). Descubre cómo habilitar correctamente allow cors en tus endpoints de Node.js, Express, Python y Nginx respondiendo adecuadamente al preflight OPTIONS.

## Análisis de Arquitectura y Causa Raíz

En servidores web de alto rendimiento como **Nginx** y **Apache HTTP Server**, la arquitectura de despacho de solicitudes se basa en modelos de concurrencia optimizados: bucles de eventos asíncronos no bloqueantes gobernados por multiplexación de E/S (`epoll` en Linux) en el caso de Nginx, y modelos híbridos prefork/worker basados en hilos y procesos en Apache.

El fallo técnico reportado se origina por una discrepancia en la negociación de capas entre el servidor web y los procesos upstream o el sistema de archivos subyacente:
1. **Resolución de sockets y ciclo de vida HTTP:** Cuando Nginx actúa como reverse proxy hacia un servidor de aplicaciones (PHP-FPM, Node.js, Python WSGI o contenedores), delega el tráfico a través de sockets TCP (`127.0.0.1:puerto`) o sockets de dominio UNIX (`AF_UNIX`). Si el backend colapsa por una excepción no controlada, agota su cola de backlog de conexiones entrantes (`somaxconn`), o excede el umbral de tiempo establecido por `proxy_read_timeout`, el kernel emite una señal de cierre de canal que Nginx traduce en un error HTTP 502 Bad Gateway o 504 Gateway Timeout hacia el cliente web.
2. **Evaluación de directivas `.htaccess` y memoria en Apache:** En Apache, cada solicitud hacia un directorio provoca que el servidor escanee y parsee el archivo `.htaccess` en tiempo de ejecución. Si se declara una directiva correspondiente a un módulo no cargado en el kernel de Apache (como reglas de reescritura `RewriteRule` sin el módulo `mod_rewrite`, o manipulación de encabezados sin `mod_headers`), el compilador de configuración interno aborta inmediatamente la petición con un error HTTP 500 Internal Server Error, registrando la alerta en el log del servidor.
3. **Permisos POSIX y herencia de grupos de ejecución:** El servidor web corre bajo una identidad de privilegios mínimos en el sistema operativo (comúnmente `www-data`, `nginx` o `apache`). Si los archivos web carecen de permisos de lectura (`r`, máscara 644) o los directorios carecen de permisos de ejecución y paso (`x`, máscara 755), el kernel deniega la llamada `open()` con el error `EACCES`, transformándose en un error HTTP 403 Forbidden.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **El navegador bloquea la petición fetch/axios porque el backend no envía la cabecera Access-Control-Allow-Origin** | Añadir middleware CORS en el backend autorizando el origen del frontend domain |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Verificar la sintaxis de los archivos de configuración
sudo nginx -t

# 2. Consultar las últimas 50 líneas del registro de errores en tiempo real
sudo tail -n 50 /var/log/nginx/error.log

# 3. Comprobar qué procesos están escuchando en los puertos HTTP/HTTPS
sudo ss -tulpn | grep -E ':(80|443|3000|8080|9000)'
```

- El comando `nginx -t` valida la sintaxis de todos los bloques `server` y `location` incluidos, confirmando si los certificados SSL y las rutas de sockets existen en el disco sin interrumpir el servicio activo.
- El comando `ss` con los flags `-t` (TCP), `-u` (UDP), `-l` (listening), `-p` (procesos y PIDs asociados) y `-n` (numérico sin resolución DNS inversa) identifica con precisión milimétrica si otro servicio está ocupando el puerto o si el backend está inactivo.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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
