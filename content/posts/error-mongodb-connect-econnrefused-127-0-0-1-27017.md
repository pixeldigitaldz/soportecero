---
title: "[SOLUCIONADO] Error 'connect ECONNREFUSED 127.0.0.1:27017' en MongoDB"
description: "¿Mongoose o tu backend en Node.js no puede conectarse a MongoDB por ECONNREFUSED 27017? Solución paso a paso para el demonio mongod."
category: "Web y Código"
tags: ["MongoDB", "Node.js", "Express", "Database"]
readTime: "4 min"
date: "2026-08-22"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Servidor MongoDB (mongod) no está en ejecución** | Iniciar el servicio de base de datos: `sudo systemctl start mongod` |
| **MongoDB escuchando solo en la interfaz local o puerto cambiado** | Ajustar la directiva `bindIp: 0.0.0.0` en `/etc/mongod.conf` si se requiere acceso remoto |


El error **`connect ECONNREFUSED 127.0.0.1:27017`** o `MongooseServerSelectionError: connect ECONNREFUSED` ocurre cuando tu aplicación en Node.js, Python o cliente GUI (Compass) intenta establecer conexión con MongoDB, pero el servicio **`mongod` no está en ejecución** o está escuchando en una interfaz de red diferente.

> **Solución Rápida (1 Minuto):**
> 1. Inicia el servicio de MongoDB en Linux:
>    `sudo systemctl enable --now mongod`
> 2. Si usas MongoDB 6/7, prueba cambiando la cadena de conexión de `localhost` a la IP `127.0.0.1`:
>    `mongodb://127.0.0.1:27017/midatabase`

## 🚀 Cómo solucionar el error ECONNREFUSED 27017 paso a paso

### Paso 1: Verificar el estado del servicio `mongod`
En muchas instalaciones recientes de Linux (Ubuntu, Debian, Arch), el servicio de MongoDB no se inicia automáticamente tras reiniciar el servidor.

```bash
# Comprobar estado del servicio
sudo systemctl status mongod
```
Si el estado indica `inactive (dead)`, inicia el demonio:
```bash
sudo systemctl enable --now mongod
```

### Paso 2: Cambiar `localhost` por `127.0.0.1` en Mongoose
En Node.js v17+, `localhost` se resuelve preferentemente por IPv6 (`::1`). Si MongoDB solo está configurado para escuchar en la pila IPv4 (`127.0.0.1`), la conexión fallará.

Modifica tu archivo de conexión en Mongoose:

* ❌ **Antes:** `mongoose.connect('mongodb://localhost:27017/mi_app');`
* ✅ **Ahora:** `mongoose.connect('mongodb://127.0.0.1:27017/mi_app');`

### Paso 3: Revisar la interfaz de escucha en `mongod.conf`
Abre el archivo de configuración de MongoDB en `/etc/mongod.conf`:
```bash
sudo nano /etc/mongod.conf
```
Busca la sección `net` y verifica la variable `bindIp`:
```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```
*(Si estás conectando desde un contenedor de Docker o servidor remoto, añade la IP del contenedor o usa `0.0.0.0`).*

Reinicia el servicio:
```bash
sudo systemctl restart mongod
```

## 🛡️ Consejo de Prevención
* Elimina archivos lock corruptos en `/var/lib/mongodb/mongod.lock` si el servicio rehusara iniciar tras un apago forzado del servidor.
