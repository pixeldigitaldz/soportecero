---
title: Error server certificate verification failed en Git
description: >-
  Aprende a solucionar el error de verificación de certificado SSL en Git
  (fatal: unable to access) en Linux, Windows y macOS de forma segura.
category: Web y Código
tags:
  - Git
  - SSL
  - Linux
  - Seguridad
  - GitHub
  - DevOps
readTime: 7 min
date: '2026-06-25'
---
El error `fatal: unable to access 'https://github.com/...': server certificate verification failed. CAfile: none CRLfile: none` ocurre cuando el cliente Git no puede validar la cadena criptográfica del certificado SSL/TLS del servidor remoto contra el almacén local de Autoridades de Certificación de confianza.

## Análisis de Arquitectura y Causa Raíz

El sistema de control de versiones **Git** opera como una base de datos de objetos direccionables por contenido criptográfico (hashes SHA-1 / SHA-256) respaldada por un grafo acíclico dirigido (DAG). La integridad del repositorio descansa en el directorio interno `.git/`, donde se almacenan cuatro tipos de objetos atómicos: **blobs** (contenido puro de archivos), **trees** (representación de directorios y permisos POSIX), **commits** (metadatos del autor, mensaje y puntero al árbol raíz) y **annotated tags**.

La causa raíz de esta incidencia se produce por una alteración en los punteros de referencia o en el mecanismo de bloqueo transaccional del árbol de trabajo:
1. **Mecanismo de Lockfiles atómicos (`.git/*.lock`):** Para garantizar la atomicidad en operaciones concurrentes y evitar condiciones de carrera (*race conditions*), Git genera archivos efímeros de bloqueo (ej. `.git/refs/heads/main.lock` o `.git/index.lock`) antes de mutar cualquier puntero o actualizar el área de preparación (*staging index*). Si un proceso de Git finaliza inesperadamente (por apagado forzado, corte de IDE o fallo de memoria), el lockfile permanece huérfano en el sistema de archivos, impidiendo cualquier operación de lectura/escritura posterior con un error de bloqueo crítico.
2. **Desincronización del grafo DAG y divergencia de ramas:** Durante procesos de `rebase` o `cherry-pick`, Git reescribe la historia aplicando commits de forma secuencial sobre un nuevo commit base. Si se detectan cambios incompatibles en los mismos bloques de código sin un ancestro común directo (o si se fuerza la unión de árboles de commits independientes creados desde cero), el algoritmo de merge trifásico (*three-way merge*) detiene la ejecución para proteger la integridad del historial, dejando al repositorio en un estado transicional (`REBASE-i`, `MERGING` o `DETACHED HEAD`).
3. **Capa de transporte SSL/TLS y validación de certificados:** Al interactuar con remotos a través de HTTPS, el cliente Git delega la autenticación en la librería local `libcurl` y el almacén de certificados CA del sistema operativo. Si la cadena de certificación intermedia no se resuelve o existen desajustes en el reloj del sistema, el handshake criptográfico se cancela de inmediato.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Almacén de certificados de Autoridades de Certificación (CA) del sistema operativo desactualizado** | Update `ca-certificates` package on Linux via `sudo update-ca-certificates` |

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

La causa más habitual en servidores Linux desactualizados es la expiración de certificados raíz antiguos (como Let's Encrypt o DigiCert):
```bash
# En Debian / Ubuntu:
sudo apt-get update
sudo apt-get install --reinstall ca-certificates -y
sudo update-ca-certificates

# En Arch Linux / CachyOS:
sudo pacman -Sy ca-certificates --noconfirm

# En Red Hat / CentOS / Rocky Linux:
sudo dnf reinstall ca-certificates -y
sudo update-ca-trust
```

### Paso 2: Configurar la ruta explícita del archivo CA en Git
Si utilizas un certificado corporativo de empresa o una CA interna:
```bash
# Configurar la ruta global de la Autoridad de Certificación
git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt

# En Windows:
git config --global http.sslCAInfo "C:/Program Files/Git/mingw64/ssl/certs/ca-bundle.crt"
```

### Paso 3: Sincronizar el reloj del sistema mediante NTP
Si la fecha y hora de tu máquina están desfasadas, los certificados válidos serán rechazados automáticamente:
```bash
# Sincronizar reloj en Linux
sudo timedatectl set-ntp true
timedatectl status
```

### Paso 4: Configurar Git para usar el almacén nativo del sistema en Windows (Schannel)
En Windows, configura Git para usar el almacén de certificados de Windows en lugar del bundle OpenSSL interno:
```bash
git config --global http.sslBackend schannel
```

## 🛡️ Consejos de Prevención

- **No uses http.sslVerify false de forma permanente:** Ejecutar `git config --global http.sslVerify false` desactiva la comprobación criptográfica en todos tus repositorios, exponiendo tus credenciales y código a ataques de intermediario (Man-in-the-Middle).
- **Utiliza autenticación SSH:** Considera clonar repositorios mediante `git@github.com:usuario/repo.git` para autenticarte mediante claves criptográficas Ed25519 en lugar de HTTPS.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Cómo desactivo sslVerify solo para un comando de emergencia?
Puedes pasar el flag en línea sin alterar la configuración global: `git -c http.sslVerify=false clone https://...`.

### ¿Por qué mi navegador abre GitHub pero Git falla en la terminal?
Porque los navegadores web modernos tienen almacenes de certificados independientes de la biblioteca OpenSSL que utiliza la CLI de Git.
