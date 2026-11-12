---
title: 'Reparar: Pérdida de conexión a internet por fallo de DNS en Docker (Umbrel OS)'
description: >-
  Aprende a resolver el bloqueo de red donde tus contenedores en Umbrel pierden
  el acceso al exterior debido a conflictos con el resolvedor DNS interno.
category: Sistemas y Servidores
tags:
  - Umbrel
  - Docker
  - DNS
readTime: 6 min
date: '2026-06-27'
---
Un fallo crítico muy común en servidores domésticos basados en el ecosistema **Umbrel OS** ocurre cuando los contenedores de Docker (como Sonarr o tus nodos) dejan de descargar actualizaciones o pierden la conexión con los servidores exteriores de repente, arrojando errores de tipo `Temporary failure in name resolution`. Esto sucede porque el demonio de Docker pierde la ruta hacia el resolvedor DNS local del sistema operativo anfitrión.

## Análisis de Arquitectura y Causa Raíz

En entornos contenerizados, el motor de **Docker** se apoya en primitivas fundamentales del kernel de Linux: **Namespaces** (PID, NET, MNT, IPC, UTS) para el aislamiento lógico de procesos y **Control Groups (cgroups v1/v2)** para el límite estricto de recursos de hardware (memoria RAM, ciclos de CPU y cuotas de I/O de disco).

Cuando se produce este fallo, la anomalía suele situarse en la frontera entre el demonio `dockerd`, el runtime OCI (`containerd` / `runc`) y el subsistema de red del host:
1. **Comunicación con el socket IPC (`/var/run/docker.sock`):** El cliente de Docker interactúa con la API REST local mediante llamadas al sistema sobre un socket de dominio UNIX. Si los permisos de usuario en el socket no pertenecen al grupo `docker` o si el demonio ha quedado bloqueado por un hilo zombie, la llamada al sistema devuelve inmediatamente un descriptor de error `EACCES` o `ECONNREFUSED`.
2. **Ciclo de vida del contenedor y estados OCI:** Durante la creación del contenedor (`container create / start`), `runc` solicita al kernel la creación de los namespaces y el montaje del sistema de archivos en capas mediante el driver de almacenamiento **Overlay2** (`lowerdir`, `upperdir` y `merged`). Si existe corrupción en las capas de imagen, agotamiento de inodos en `/var/lib/docker`, o incompatibilidad con la arquitectura del binario, el runtime aborta con códigos de salida específicos (ej. Exit Code 137 por OOM Killer o Exit Code 126/127 por permisos o dependencias ausentes).
3. **Pila de red virtual y cadenas de iptables:** Para exponer puertos (`-p`), Docker manipula directamente las tablas `nat` y `filter` del subsistema Netfilter mediante cadenas personalizadas (`DOCKER`, `DOCKER-USER`). Reinicios no sincronizados del firewall (`ufw` o `firewalld`) eliminan estas cadenas en memoria del kernel, provocando que los paquetes TCP entrantes sean descartados silenciosamente con paquetes TCP RST.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **El servicio DNS interno de Docker no resuelve nombres en Umbrel OS** | Configurar DNS público en `/etc/docker/daemon.json` (e.g. `"dns": ["1.1.1.1"]`) |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps umbrel-docker

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
```

- El comando `docker logs` con el parámetro `--tail 50` extrae únicamente las últimas 50 líneas emitidas en `stdout` y `stderr`, mientras que `--timestamps` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag `--no-stream` en `docker stats` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Entra a tu servidor Umbrel por SSH e ingresa al contenedor afectado para comprobar si responde a un ping numérico directo pero falla al resolver nombres de texto:
```bash
# Probar IP directa de Google (Si responde, hay internet pero no DNS)
docker exec -it nombre_contenedor ping -c 3 8.8.8.8
```

### Paso 2: Forzar DNS públicos globales en la configuración de Docker

Para saltarte los bloqueos del enrutamiento de Umbrel, podemos definir DNS estáticos e inmutables para todo el motor de Docker. Edita el archivo de configuración global:
```bash
sudo nano /etc/docker/daemon.json
```

Añade o fusiona las siguientes líneas con las DNS estables de Cloudflare y Google dentro del objeto JSON:
```json
{
  "dns": ["1.1.1.1", "8.8.8.8"]
}
```

Guarda el archivo (`Ctrl + O`, `Enter`) y cierra el editor (`Ctrl + X`).

### Paso 3: Reiniciar el servicio de Docker

Aplica un reinicio forzado al servicio del sistema para que vuelva a levantar todas las interfaces de red con las nuevas DNS inyectadas:
```bash
sudo systemctl restart docker
```

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Evita modificar directamente el archivo `/etc/resolv.conf` en Umbrel OS de forma manual, ya que este archivo es administrado de manera dinámica por el sistema y se sobrescribirá por completo en cada reinicio físico de tu Mini PC o Raspberry Pi, borrando tus correcciones.
