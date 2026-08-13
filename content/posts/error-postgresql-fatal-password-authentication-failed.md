---
title: "Cómo solucionar el error FATAL: password authentication failed for user en PostgreSQL"
description: "Aprende a resolver la falla de autenticación por contraseña en PostgreSQL actualizando las contraseñas de usuario y ajustando el archivo pg_hba.conf."
category: "Sistemas y Servidores"
tags: ["PostgreSQL", "Databases", "Sysadmin"]
readTime: "4 min"
date: "2026-08-01"
---

El error **FATAL: password authentication failed for user** ocurre en PostgreSQL cuando el servidor de base de datos rechaza la conexión de un cliente debido a una contraseña incorrecta, la falta de un método de autenticación válido en `pg_hba.conf` o una discrepancia entre el usuario del sistema operativo y el rol de PostgreSQL.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **`psql: error: FATAL: password authentication failed for user "postgres"`**: Contraseña incorrecta, usuario no existente o método de autenticación (scram-sha-256 / md5 / peer) desconfigurado en `pg_hba.conf` | Acceder mediante el usuario local del sistema `postgres` con socket UNIX, restablecer la contraseña con `ALTER USER` y configurar `pg_hba.conf` |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Conectarse como usuario del sistema postgres mediante socket local

En entornos Linux, el usuario superadministrador predeterminado de PostgreSQL (`postgres`) utiliza autenticación `peer` por defecto a través de sockets de UNIX locales. Accede directamente cambiando al usuario del sistema:

```bash
# Cambiar al usuario de sistema postgres e ingresar a psql
sudo -u postgres psql
```

Si el comando anterior funciona y te otorga acceso al prompt `postgres=#`, no hay ningún problema grave en el motor; el fallo se limita a la autenticación por contraseña vía TCP/IP.

### Paso 2: Restablecer la contraseña del rol de PostgreSQL

Desde la consola interactiva `psql`, asigna una nueva contraseña segura para el rol afectado (por ejemplo, `postgres` o tu usuario de aplicación):

```sql
-- Cambiar la contraseña del usuario postgres
ALTER USER postgres WITH PASSWORD 'TuNuevaContraseniaSegura123!';
```

Sal de la consola con `\q`.

### Paso 3: Configurar el archivo de autenticación pg_hba.conf

Abre el archivo de configuración de autenticación de clientes de PostgreSQL (`pg_hba.conf`). Puedes encontrar su ubicación exacta ejecutando `SHOW hba_file;` dentro de `psql` o buscando en `/etc/postgresql/`:

```bash
# Ejemplo para PostgreSQL 15/16 en Ubuntu/Debian
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Inspecciona las líneas de control de acceso para conexiones locales y TCP/IP (`127.0.0.1/32` o `::1/128`). Asegúrate de que utilicen `scram-sha-256` o `md5` en lugar de métodos restrictivos:

```config
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# Conexiones locales por socket de UNIX
local   all             postgres                                peer
local   all             all                                     md5

# Conexiones IPv4 en localhost (TCP/IP)
host    all             all             127.0.0.1/32            scram-sha-256

# Conexiones IPv6 en localhost
host    all             all             ::1/128                 scram-sha-256
```

### Paso 4: Recargar la configuración de PostgreSQL

Aplica los cambios en `pg_hba.conf` recargando el servicio sin interrumpir las conexiones activas:

```bash
# Recargar la configuración en el servidor Linux
sudo systemctl reload postgresql
```

Prueba la conexión TCP pasando el parámetro `-h localhost` y `-U postgres`:

```bash
psql -h localhost -U postgres -W
```

## 🛡️ Consejos de Prevención

- **Utilizar `scram-sha-256`**: Evita usar el método `md5` en versiones modernas de PostgreSQL (13+), ya que `scram-sha-256` ofrece mayor protección frente a ataques de fuerza bruta y sniffing de contraseñas.
- **Usar variables de entorno o `.pgpass`**: Para scripts automatizados, almacena las credenciales en un archivo local `~/.pgpass` con permisos `0600` en lugar de exponer contraseñas en texto plano dentro de la línea de comandos.
- **Verificar el archivo `postgresql.conf`**: Si intentas conectarte de forma remota, asegúrate de que la directiva `listen_addresses = '*'` esté configurada además de permitir la subred en `pg_hba.conf`.
