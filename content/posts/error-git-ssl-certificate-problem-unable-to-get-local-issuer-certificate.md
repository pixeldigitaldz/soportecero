---
title: "[SOLUCIONADO] fatal: unable to access: SSL certificate problem: unable to get local issuer certificate en Git"
description: "Aprende a solucionar el error de certificado SSL en Git al clonar o hacer push a repositorios de GitHub, GitLab o Bitbucket."
category: "Web y Código"
tags: ["Git","SSL","DevOps","Seguridad"]
readTime: "4 min"
date: "2026-10-07"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El almacén de certificados CA de Git no incluye el certificado raíz o está desactualizado** | Actualizar el paquete ca-certificates o vincular la ruta del certificado con git config |
| **Intercepción de tráfico por proxies corporativos, VPNs empresariales o antivirus con escaneo SSL** | Importar el certificado intermedio de la empresa al bundle de Git mediante http.sslCAInfo |

Al ejecutar `git clone`, `git pull` o `git push` hacia servidores remotos (GitHub, GitLab, servidores corporativos privados), Git aborta inmediatamente la conexión con: `fatal: unable to access "https://github.com/...": SSL certificate problem: unable to get local issuer certificate`. Este fallo de seguridad significa que la biblioteca libcurl utilizada por Git no pudo validar la cadena de confianza del certificado SSL del servidor.

> **Solución Rápida (1 Minuto):**
> 1. En Linux, actualiza el almacén de autoridades certificadoras:
>    `sudo apt update && sudo apt install --reinstall ca-certificates`
> 2. Configura la ruta oficial del certificado en Git:
>    `git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Actualizar el almacén de certificados raíz del sistema
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

## 🛡️ Consejo de Prevención
* Evita deshabilitar la verificación SSL (`http.sslVerify false`) de forma permanente en tu máquina.
* Utiliza autenticación mediante claves SSH (`git@github.com:...`) en lugar de HTTPS si te encuentras en redes con proxies conflictivos.

## Preguntas Frecuentes

### ¿Por qué no se recomienda usar http.sslVerify false?
Desactivar sslVerify permite que cualquier intermediario en la red Wi-Fi o proveedor de internet intercepte tu código fuente, tokens de acceso y credenciales en texto plano sin ninguna alerta.

### ¿Cómo puedo clonar usando SSH para evitar problemas con certificados SSL?
Genera una clave con `ssh-keygen -t ed25519`, agrégala a tu cuenta de GitHub y clona utilizando la URL SSH: `git clone git@github.com:usuario/repositorio.git`.
