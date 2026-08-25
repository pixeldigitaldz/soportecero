---
title: "Resuelto: server certificate verification failed en Git"
description: "Aprende a solucionar el error de verificación de certificado SSL en Git (fatal: unable to access) en Linux, Windows y macOS de forma segura."
category: "Web y Código"
tags: ["Git", "SSL", "Linux", "Seguridad", "GitHub", "DevOps"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Almacén de certificados de Autoridades de Certificación (CA) del sistema operativo desactualizado** | Actualizar `ca-certificates` en Linux con `sudo apt update && sudo apt install --reinstall ca-certificates` |
| **Proxy corporativo interceptando el tráfico SSL o certificado autofirmado no registrado en Git** | Configurar la ruta del certificado CA con `git config --global http.sslCAInfo /ruta/ca.crt` |

El error `fatal: unable to access 'https://github.com/...': server certificate verification failed. CAfile: none CRLfile: none` ocurre cuando el cliente Git no puede validar la cadena criptográfica del certificado SSL/TLS del servidor remoto contra el almacén local de Autoridades de Certificación de confianza.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Actualizar los certificados raíz del sistema operativo
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
