---
title: 'Cómo resolver FATAL: sorry, too many clients already en PostgreSQL y Node.js'
description: >-
  Aprende a diagnosticar y solucionar el agotamiento de conexiones en PostgreSQL
  max_connections utilizando Connection Pooling con PgBouncer o Prisma.
category: Web y Código
date: '2026-08-24'
readTime: 7 min
tags:
  - PostgreSQL
  - Node.js
  - Databases
---
El error `FATAL: sorry, too many clients already` en PostgreSQL ocurre cuando el número de conexiones simultáneas abiertas hacia el servidor de base de datos supera el límite configurado en la directiva `max_connections` (que por defecto suele ser 100 en instancias estándar).

En entornos web modernos con Node.js, Next.js, microservicios o arquitecturas Serverless (AWS Lambda, Vercel), abrir conexiones directas en cada solicitud sin un gestor de pool satura rápidamente la memoria del motor PostgreSQL.

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
| **Conexiones abiertas sin cerrar (`connection leaks`)** |

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

**Inspecciona las conexiones activas e inactivas en tiempo real**
Conéctate a PostgreSQL con `psql` y consulta el estado de las sesiones para identificar qué aplicación está reteniendo las conexiones:
```sql
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;
```
Para ver qué consultas o usuarios están consumiendo más conexiones:
```sql
SELECT pid, usename, client_addr, state, query_start, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start DESC;
```

**Termina conexiones colgadas de emergencia**
Si necesitas recuperar el acceso al servidor inmediatamente para labores de mantenimiento:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND pid <> pg_backend_pid();
```

**Configura correctamente un Connection Pool en Node.js (pg / pg-pool)**
Nunca instancies un nuevo `new Client()` en cada ruta o solicitud de tu API. Usa un `Pool` global compartido:
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo 20 conexiones simultáneas por instancia
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release(); // Vital: liberar la conexión de vuelta al pool
  }
}
```

**Aumenta el límite de `max_connections` en el servidor**
Si tu servidor cuenta con hardware potente (más de 8 GB de RAM), edita `/etc/postgresql/16/main/postgresql.conf`:
```ini
max_connections = 250
shared_buffers = 2GB
```
Aplica los cambios reiniciando el servicio:
```bash
sudo systemctl restart postgresql
```

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

- **Uso obligatorio de PgBouncer:** En producción con alto tráfico, coloca PgBouncer en modo `transaction pooling` delante de PostgreSQL. Esto permite gestionar más de 10,000 conexiones concurrentes consumiendo únicamente 50 conexiones reales en la base de datos.
- **Monitoreo de métricas:** Configura alertas en Prometheus o Datadog cuando las conexiones superen el 80% del valor de `max_connections`.
