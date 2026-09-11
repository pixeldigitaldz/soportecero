---
title: "[SOLUCIONADO] Error: sudo: unable to resolve host en Ubuntu y Debian"
description: "Elimina el molesto mensaje sudo: unable to resolve host al ejecutar comandos en Linux. Guía rápida para corregir /etc/hostname y /etc/hosts."
category: "Sistemas y Servidores"
tags: ["Linux","Ubuntu","Sysadmin","Bash"]
readTime: "3 min"
date: "2026-09-16"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **El nombre de equipo configurado en /etc/hostname no está registrado en /etc/hosts** | Añadir la correspondencia 127.0.1.1 con el hostname exacto en /etc/hosts |
| **Cambio de nombre de servidor VPS o instancia cloud (AWS, Hetzner, DigitalOcean) sin actualizar el mapeo local** | Sincronizar el comando hostnamectl con el archivo /etc/hosts |

Cada vez que ejecutas un comando con `sudo`, la terminal pausa brevemente y devuelve la advertencia `sudo: unable to resolve host <nombre-servidor>: Name or service not known`. Aunque el comando termine ejecutándose, esta advertencia retrasa la ejecución y puede provocar fallos en scripts automáticos, despliegues CI/CD y servicios que dependen de la resolución local de nombres.

> **Solución Rápida (1 Minuto):**
> 1. Consulta tu nombre de host actual:
>    `hostname`
> 2. Añade la IP de loopback local en /etc/hosts:
>    `echo "127.0.1.1 $(hostname)" | sudo tee -a /etc/hosts`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el hostname actual del sistema
Ejecuta el comando para verificar exactamente qué nombre tiene asignado tu máquina en el kernel:
```bash
hostname
# O mediante hostnamectl
hostnamectl --static
```
Imaginemos que tu servidor devuelve `vps-servidor01`.

### Paso 2: Editar el archivo /etc/hosts y añadir la resolución local
Abre el archivo de mapeo estático de hosts con permisos de superusuario:
```bash
sudo nano /etc/hosts
```
Verifica que exista la línea que vincula la dirección IP de bucle invertido `127.0.1.1` con tu nombre de host exacto:
```plaintext
127.0.0.1 localhost
127.0.1.1 vps-servidor01
```
Guarda los cambios con `Ctrl + O` y sal con `Ctrl + X`.

### Paso 3: Verificar la desaparición del error
Ejecuta cualquier comando con `sudo` para confirmar que la advertencia ha desaparecido por completo:
```bash
sudo true
```
Si no aparece ningún mensaje de error, la resolución local de nombres ha quedado reparada definitivamente.

## 🛡️ Consejo de Prevención
* Al cambiar el nombre de un servidor con `hostnamectl set-hostname nuevo-nombre`, actualiza simultáneamente `/etc/hosts`.
* En proveedores en la nube que regeneran configuraciones de red (cloud-init), edita la plantilla `/etc/cloud/cloud.cfg` para preservar los cambios locales.

## Preguntas Frecuentes

### ¿Por qué sudo necesita resolver el nombre de host del sistema?
sudo consulta la base de datos NSS (Name Service Switch) para verificar en el archivo sudoers si el usuario actual tiene privilegios para ejecutar comandos en el host específico.

### ¿Cuál es la diferencia entre 127.0.0.1 y 127.0.1.1 en Debian y Ubuntu?
127.0.0.1 está reservado para el nombre genérico "localhost". Debian y Ubuntu utilizan 127.0.1.1 para asociar el nombre de host FQDN de la máquina sin depender de una IP estática externa.
