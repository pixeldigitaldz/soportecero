---
title: >-
  fatal: unable to access: SSL certificate problem: unable to get local issuer
  certificate en Git
description: >-
  Aprende a solucionar el error de certificado SSL en Git al clonar o hacer push
  a repositorios de GitHub, GitLab o Bitbucket.
category: Web y Código
tags:
  - Git
  - SSL
  - DevOps
  - Seguridad
readTime: 7 min
date: '2026-10-07'
---
Al ejecutar `git clone`, `git pull` o `git push` hacia servidores remotos (GitHub, GitLab, servidores corporativos privados), Git aborta inmediatamente la conexión con: `fatal: unable to access "https://github.com/...": SSL certificate problem: unable to get local issuer certificate`. Este fallo de seguridad significa que la biblioteca libcurl utilizada por Git no pudo validar la cadena de confianza del certificado SSL del servidor.

## Contexto de Arquitectura y Causa Raíz del Fallo

El sistema de control de versiones **Git** opera como una base de datos de objetos direccionables por contenido criptográfico (hashes SHA-1 / SHA-256) respaldada por un grafo acíclico dirigido (DAG). La integridad del repositorio descansa en el directorio interno `.git/`, donde se almacenan cuatro tipos de objetos atómicos: **blobs** (contenido puro de archivos), **trees** (representación de directorios y permisos POSIX), **commits** (metadatos del autor, mensaje y puntero al árbol raíz) y **annotated tags**.

La causa raíz de esta incidencia se produce por una alteración en los punteros de referencia o en el mecanismo de bloqueo transaccional del árbol de trabajo:
1. **Mecanismo de Lockfiles atómicos (`.git/*.lock`):** Para garantizar la atomicidad en operaciones concurrentes y evitar condiciones de carrera (*race conditions*), Git genera archivos efímeros de bloqueo (ej. `.git/refs/heads/main.lock` o `.git/index.lock`) antes de mutar cualquier puntero o actualizar el área de preparación (*staging index*). Si un proceso de Git finaliza inesperadamente (por apagado forzado, corte de IDE o fallo de memoria), el lockfile permanece huérfano en el sistema de archivos, impidiendo cualquier operación de lectura/escritura posterior con un error de bloqueo crítico.
2. **Desincronización del grafo DAG y divergencia de ramas:** Durante procesos de `rebase` o `cherry-pick`, Git reescribe la historia aplicando commits de forma secuencial sobre un nuevo commit base. Si se detectan cambios incompatibles en los mismos bloques de código sin un ancestro común directo (o si se fuerza la unión de árboles de commits independientes creados desde cero), el algoritmo de merge trifásico (*three-way merge*) detiene la ejecución para proteger la integridad del historial, dejando al repositorio en un estado transicional (`REBASE-i`, `MERGING` o `DETACHED HEAD`).
3. **Capa de transporte SSL/TLS y validación de certificados:** Al interactuar con remotos a través de HTTPS, el cliente Git delega la autenticación en la librería local `libcurl` y el almacén de certificados CA del sistema operativo. Si la cadena de certificación intermedia no se resuelve o existen desajustes en el reloj del sistema, el handshake criptográfico se cancela de inmediato.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **El almacén de certificados CA de Git no incluye el certificado raíz o está desactualizado** |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Inspeccionar el estado del árbol de trabajo y el área de preparación
git status --short --branch

# 2. Visualizar los últimos commits del historial de forma gráfica y compacta
git log --oneline --graph --decorate -n 10

# 3. Comprobar referencias de bloqueo activas en el repositorio
ls -la .git/*.lock .git/refs/heads/*.lock 2>/dev/null
```

- El flag `--short` en `git status` resume en dos caracteres por archivo el estado entre el staging index y el directorio de trabajo, facilitando identificar archivos en conflicto (`UU`) o no rastreados (`??`).
- El comando `git log` con los parámetros `--oneline` (un commit por línea), `--graph` (diagrama ASCII del árbol) y `-n 10` muestra la topología de las ramas y el punto exacto de divergencia con el repositorio remoto.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

En sistemas Linux, las autoridades raíz caducadas provocan el rechazo de certificados modernos. Reinstala los certificados del sistema:
```bash
# En Debian / Ubuntu
sudo apt-get update
sudo apt-get install --reinstall ca-certificates
sudo update-ca-certificates

# En Fedora / RHEL
sudo dnf reinstall ca-certificates
sudo update-ca-trust
```

### Paso 2: Configurar explícitamente la ruta del bundle de certificados en Git
Si Git fue instalado mediante Snap, Flatpak o compilado manualmente, es posible que no sepa dónde buscar el archivo de certificados del sistema. Indica la ruta exacta:
```bash
# En Ubuntu / Debian
git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt

# En RHEL / CentOS / Fedora
git config --global http.sslCAInfo /etc/pki/tls/certs/ca-bundle.crt

# En Windows (usando el bundle integrado de Git for Windows)
git config --global http.sslCAInfo "C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt"
```

### Paso 3: Resolver la intercepción de proxies corporativos o VPNs
Si trabajas en una red de empresa con inspección SSL (Zscaler, Fortinet, Palo Alto), el proxy reemplaza el certificado de GitHub por el suyo propio.
**Nunca uses `git config --global http.sslVerify false`** en producción porque te expone a ataques Man-in-the-Middle.
En su lugar, exporta el certificado de tu empresa en formato PEM (.crt) y agrégalo:
```bash
git config --global http.sslCAInfo /ruta/al/certificado-empresa.crt
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

* Evita deshabilitar la verificación SSL (`http.sslVerify false`) de forma permanente en tu máquina.
* Utiliza autenticación mediante claves SSH (`git@github.com:...`) en lugar de HTTPS si te encuentras en redes con proxies conflictivos.

## Preguntas Frecuentes

### ¿Por qué no se recomienda usar http.sslVerify false?
Desactivar sslVerify permite que cualquier intermediario en la red Wi-Fi o proveedor de internet intercepte tu código fuente, tokens de acceso y credenciales en texto plano sin ninguna alerta.

### ¿Cómo puedo clonar usando SSH para evitar problemas con certificados SSL?
Genera una clave con `ssh-keygen -t ed25519`, agrégala a tu cuenta de GitHub y clona utilizando la URL SSH: `git clone git@github.com:usuario/repositorio.git`.
