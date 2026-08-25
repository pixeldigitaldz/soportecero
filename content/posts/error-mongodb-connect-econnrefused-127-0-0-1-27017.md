---
title: "[SOLUCIONADO] Error 'connect ECONNREFUSED 127.0.0.1:27017' en MongoDB"
description: "Aprende a solucionar el error connect ECONNREFUSED en MongoDB iniciando el servicio mongod, reparando permisos y configurando bindIp."
category: "Web y Código"
tags: ["MongoDB", "Node.js", "Mongoose", "Bases de Datos", "Linux", "DevOps"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El daemon del servidor MongoDB (mongod) está detenido o no se inicia automáticamente** | Iniciar el servicio con `sudo systemctl start mongod` y habilitarlo en el arranque (`enable`) |
| **La directiva bindIp en mongod.conf solo escucha en localhost o permisos corruptos en /var/lib/mongodb** | Configurar `bindIp: 127.0.0.1` y reparar la propiedad de datos con `sudo chown -R mongodb:mongodb /var/lib/mongodb` |

El error `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017` o `MongoNetworkError: failed to connect to server [localhost:27017]` en aplicaciones Node.js y Express ocurre cuando el cliente de base de datos intenta establecer un socket TCP en el puerto 27017 pero no encuentra ningún proceso de MongoDB escuchando en esa interfaz.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el estado del servicio MongoDB
Comprueba si el proceso `mongod` está en ejecución o falló al arrancar:
```bash
# Comprobar estado del servicio
sudo systemctl status mongod

# Si el servicio está inactivo (dead), inícialo:
sudo systemctl start mongod

# Habilitar para que inicie automáticamente tras reiniciar el servidor:
sudo systemctl enable mongod
```

### Paso 2: Corregir permisos en los directorios de datos y logs
Si MongoDB se apagó abruptamente, los permisos de los archivos de base de datos pueden quedar corruptos:
```bash
# Asignar la propiedad correcta al usuario del sistema 'mongodb'
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb

# Asegurar permisos de lectura y escritura
sudo chmod -R 755 /var/lib/mongodb
```

### Paso 3: Verificar la configuración de red en mongod.conf
Abre el archivo de configuración principal (`/etc/mongod.conf`):
```yaml
# /etc/mongod.conf
net:
  port: 27017
  bindIp: 127.0.0.1  # Escucha en localhost. Usa 0.0.0.0 solo si necesitas acceso remoto seguro.
```
Si realizas cambios, reinicia el daemon:
```bash
sudo systemctl restart mongod
```

### Paso 4: Validar la conexión con mongosh
Comprueba que puedes interactuar con el motor de base de datos desde la terminal:
```bash
# Abrir la consola interactiva de MongoDB
mongosh "mongodb://127.0.0.1:27017"
```

## 🛡️ Consejos de Prevención
- **No uses bindIp: 0.0.0.0 sin autenticación:** Exponer el puerto 27017 a internet sin contraseñas fuertes (`security.authorization: enabled`) deja tu base de datos expuesta a ataques de ransomware automatizados.
- **Supervisa el espacio en disco:** MongoDB detiene el motor de almacenamiento WiredTiger si el disco principal tiene menos de 100MB libres.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué hago si mongod falla con código de salida status=14/EXIT_FAILURE?
El error 14 suele deberse a archivos de bloqueo (`mongod.lock`) huérfanos. Repara la base de datos ejecutando `sudo mongod --repair --dbpath /var/lib/mongodb` y reinicia el servicio.

### ¿Por qué mi aplicación en Docker no conecta a 127.0.0.1:27017?
Dentro de un contenedor Docker, `127.0.0.1` apunta al propio contenedor. Utiliza `host.docker.internal` o el nombre del servicio definido en tu `docker-compose.yml`.
