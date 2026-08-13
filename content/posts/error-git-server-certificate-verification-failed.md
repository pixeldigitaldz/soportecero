---
title: 'Resuelto: server certificate verification failed en Git'
description: 'Cómo solucionar el error de certificado SSL en Git al intentar hacer un clone, pull o push desde un repositorio remoto.'
category: 'Web y Código'
date: '2026-08-15'
readTime: '3 min'
tags: ['Git', 'Seguridad', 'DevOps']
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Certificados del sistema desactualizados** | Actualizar `ca-certificates` |
| **Proxy o Antivirus bloqueando el SSL** | Usar SSH en lugar de HTTPS |
| **Servidor con certificado autofirmado** | Desactivar verificación global (Temporal) con `http.sslVerify false` |

## La Solución Paso a Paso

**Actualiza los certificados raíz de tu sistema (Recomendado)**
La mayoría de las veces, el error ocurre porque el sistema operativo de tu servidor (o PC) tiene certificados de autoridades (CA) expirados. 
En Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install --reinstall ca-certificates
```
En CentOS/RHEL:
```bash
sudo yum update ca-certificates
```

**Usa SSH en lugar de HTTPS**
Si Github/Gitlab está bloqueando tu tráfico por problemas con tu proxy corporativo o tu CA local, cambiar la URL del remoto a SSH suele saltarse la validación SSL de HTTPS:
```bash
git remote set-url origin git@github.com:usuario/repositorio.git
```
Asegúrate de tener tus claves SSH configuradas (`ssh-keygen`).

**Desactiva la verificación SSL global (Riesgoso, solo para test)**
Si estás conectándote a un servidor interno (Gitea/Gitlab local) con un certificado autofirmado, puedes decirle a Git que ignore la seguridad SSL para ese repositorio:
```bash
git config http.sslVerify false
```
*Si quieres aplicarlo a todos los proyectos de tu máquina:*
```bash
git config --global http.sslVerify false
```

## Prevención
- **Gestión de CAs:** Si tu empresa usa certificados firmados internamente, asegúrate de añadirlos a la ruta `/etc/ssl/certs/` y correr `update-ca-certificates`.
- **Preferir SSH:** Acostúmbrate a usar claves SSH para operaciones con Git; son más rápidas y no sufren de problemas de caducidad de certificados SSL de la misma manera que HTTPS.
