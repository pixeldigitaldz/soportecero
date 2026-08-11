---
title: "[SOLUCIONADO] Error 'curl: (7) Failed to connect to localhost port'"
description: "¿Recibes el fallo de conexión curl (7) al probar APIs o servicios web locales? Solución paso a paso para resolver la escucha de puertos."
category: "Web y Código"
tags: ["cURL", "Node.js", "API", "Linux"]
readTime: "4 min"
date: "2026-08-14"
---

El error **`curl: (7) Failed to connect to localhost port 3000: Connection refused`** ocurre cuando la utilidad de línea de comandos `curl` intenta enviar una petición a un servicio web en tu máquina local, pero no hay ningún proceso escuchando en ese puerto o el servicio solo está enlazado a IPv6 (`::1`) en lugar de IPv4 (`127.0.0.1`).

> **Solución Rápida (1 Minuto):**
> 1. Comprueba si tu servidor local está encendido en otra terminal.
> 2. Prueba conectando a la IP explícita `127.0.0.1` en lugar del nombre `localhost`:
>    `curl http://127.0.0.1:3000`

## 🚀 Cómo solucionar el error curl (7) paso a paso

### Paso 1: Verificar la escucha de puertos activos en tu sistema
Comprueba qué proceso está escuchando en el puerto deseado usando `ss` o `netstat`:

```bash
# Inspeccionar el puerto 3000 (o cambia por tu puerto: 8080, 5000, 80)
sudo ss -tulpn | grep :3000
```
Si la comando no devuelve ninguna salida, el servidor Node.js, Python o Go no está en ejecución. Inicializa tu servidor web antes de lanzar la petición cURL.

### Paso 2: Conflicto entre `localhost` (IPv6 vs IPv4)
En distribuciones de Linux recientes, `localhost` resuelve primero a la dirección de bucle invertido de IPv6 `::1`. Si tu servidor web en Node.js (Express) o Python (Flask/FastAPI) está configurado para escuchar únicamente en `127.0.0.1` (IPv4), cURL fallará al intentar la versión IPv6.

**Solución 1: Forzar cURL a usar IPv4:**
```bash
curl -4 http://localhost:3000
```

**Solución 2: Usar la dirección IP loopback explícita:**
```bash
curl http://127.0.0.1:3000
```

### Paso 3: Configurar la dirección de enlace en tu código (Host Binding)
En tu servidor de aplicaciones backend, asegúrate de enlazar el host a `0.0.0.0` o `127.0.0.1` en lugar de omitirlo:

* **En Express.js (Node.js):**
  ```javascript
  app.listen(3000, '0.0.0.0', () => {
    console.log('Servidor activo en el puerto 3000');
  });
  ```
* **En FastAPI / Uvicorn (Python):**
  ```bash
  uvicorn main:app --host 0.0.0.0 --port 3000
  ```

## 🛡️ Consejo de Prevención
* Si estás probando contenedores de Docker, recuerda mapear el puerto del contenedor hacia el host (`docker run -p 3000:3000 ...`).
