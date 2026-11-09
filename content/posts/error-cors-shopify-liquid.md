---
title: >-
  Cómo resolver: Error de CORS al consumir APIs externas desde plantillas de
  Shopify
description: >-
  Aprende a solucionar fallos de Cross-Origin Resource Sharing (CORS) en Liquid,
  JavaScript storefront y Proxies de Aplicación de Shopify.
category: Web y Código
tags:
  - Shopify
  - Liquid
  - CORS
  - JavaScript
  - APIs
  - Frontend
readTime: 7 min
date: '2026-06-27'
---
Cuando realizas una petición `fetch()` o `axios` desde el archivo JavaScript de un tema de Shopify (`theme.liquid` o secciones storefront) hacia tu API externa, el navegador bloquea la respuesta con el error: `Access to fetch at 'https://mi-api.com' from origin 'https://mi-tienda.myshopify.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource`.

## Contexto de Arquitectura y Causa Raíz del Fallo

En el ecosistema de **Node.js** y compiladores modernos de **JavaScript / TypeScript** (como `tsc`, `esbuild` o `swc`), la ejecución del código transcurre sobre el motor **V8** de Google acoplado a la librería de abstracción de E/S **libuv**, la cual gestiona el bucle de eventos (*Event Loop*) y el pool de hilos para operaciones asíncronas de red y sistema de archivos.

La causa raíz de esta incidencia proviene de desalineaciones en la resolución de módulos, el árbol de tipado AST o la frontera de renderizado:
1. **Árbol de resolución de dependencias y conflictos de pares (`peerDependencies`):** El gestor de paquetes (`npm` v7+) implementa un algoritmo determinista para construir el árbol de módulos en `node_modules`. Cuando dos paquetes requieren versiones mayores distintas de una misma librería compartida como dependencia de pares, el algoritmo de resolución rechaza forzar la instalación para prevenir colisiones en tiempo de ejecución, lanzando el error de conflicto de pares (`ERESOLVE`).
2. **Fase de hidratación y renderizado isomórfico (SSR vs Client):** En frameworks como Next.js o Remix, el código se ejecuta inicialmente en el servidor (entorno Node.js sin interfaz gráfica) antes de compilarse y enviarse al navegador. Si el código fuente intenta acceder a objetos globales del DOM como `window`, `document` o `localStorage` antes del montaje del componente en el cliente (`useEffect`), el motor lanza de inmediato una excepción crítica `ReferenceError: document is not defined` durante el Server-Side Rendering.
3. **Mapeo del Sistema de Tipos AST en TypeScript:** El compilador de TypeScript (`tsc`) genera un árbol de sintaxis abstracta (*Abstract Syntax Tree*) y valida la correspondencia de tipos en tiempo de transpilación. Si una interfaz carece de una definición de propiedad explícita o se utiliza una librería de JavaScript que no expone declaraciones de tipos (`@types/*`), el verificador de tipos emite el error TS2339 para salvaguardar la seguridad de tipos (*type safety*), bloqueando la compilación del proyecto.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Petición fetch() desde tema Liquid hacia servidor externo sin cabecera Access-Control-Allow-Origin** |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l NOMBRE_SERVICIO

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u NOMBRE_SERVICIO -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

## Casos Borde (Troubleshooting) y Prácticas en Producción

### Caso Borde 1: Restricciones de seguridad aplicadas por SELinux o AppArmor

En distribuciones de clase empresarial como Red Hat Enterprise Linux, AlmaLinux o Rocky Linux (que utilizan **SELinux** en modo Enforcing) o en Ubuntu/Debian (que implementan **AppArmor**), las políticas de confinamiento del sistema operativo pueden bloquear el acceso a archivos, sockets UNIX o puertos de red incluso cuando los permisos tradicionales `chmod 777` y el usuario `root` están en uso.

Para verificar y solventar bloqueos por contexto de seguridad:
```bash
# Consultar si SELinux generó denegaciones recientes en el log de auditoría
sudo ausearch -m avc -ts recent 2>/dev/null

# En caso de AppArmor, revisar eventos bloqueados en el diario del kernel
sudo dmesg | grep -i apparmor | tail -n 20
```
Si se confirma una denegación de contexto en SELinux, restaura el contexto de seguridad predeterminado del archivo o directorio afectado ejecutando:
```bash
# Restaurar etiquetas de contexto de seguridad recursivamente
sudo restorecon -Rv /ruta/afectada
```

### Caso Borde 2: Persistencia tras reinicio y desincronización de procesos huérfanos

En ocasiones, tras aplicar una solución en caliente en la terminal, el problema reaparece inesperadamente en el siguiente reinicio del servidor o al finalizar la sesión SSH. Esto ocurre comúnmente cuando existen procesos huérfanos (*zombie processes*) que retienen el bloqueo de archivos o sockets en memoria sin permitir que el nuevo servicio tome control del recurso.

Para identificar y limpiar procesos bloqueados de forma segura:
```bash
# Identificar qué proceso tiene abierto el descriptor de archivo o socket
sudo lsof +D /ruta/o/archivo/afectado

# Si es necesario liberar el proceso huérfano de manera ordenada (señal SIGTERM)
sudo kill -15 PID_DEL_PROCESO
```

### Verificación de Logs en Tiempo Real y Validación en Producción

Una vez aplicadas las modificaciones correctivas, valida en consola que el sistema opere con total estabilidad y sin emitir advertencias residuales:
```bash
# Monitorear registros en vivo filtrando por palabras clave de fallo
sudo journalctl -f -n 100 | grep -Ei "(error|fail|warn|critical)"

# Verificar que el código de retorno del último comando ejecutado sea exitoso (0)
echo $?
```
Un valor de retorno `0` confirma la ejecución exitosa en el estándar POSIX, garantizando que el servicio o comando ha completado su ciclo sin excepciones pendientes.

## 🛡️ Consejos de Prevención

- **No uses Access-Control-Allow-Origin: * si manejas datos privados:** Permitir todos los orígenes con asterisco (`*`) inhabilita el envío de cookies/tokens de autenticación (`credentials: true`) y expone tus endpoints a abusos desde cualquier sitio web.
- **Comprueba el protocolo HTTPS:** Shopify fuerza HTTPS. Cualquier intento de conectar con `http://` fallará por políticas de seguridad de contenido mixto del navegador.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Se pueden configurar cabeceras CORS directamente dentro del código Liquid?
No. Liquid es un lenguaje de plantillas que se renderiza en los servidores de Shopify para generar HTML estático. Las peticiones CORS ocurren del lado del navegador del cliente hacia tu servidor externo.

### ¿Por qué App Proxy es más seguro que CORS abierto?
Porque Shopify firma criptográficamente cada petición del App Proxy con un parámetro `signature` (HMAC SHA-256), permitiendo a tu backend verificar con certeza que la petición proviene legítimamente de tu tienda.
