---
title: "Solución al retraso en el arranque de Linux por error de timeout en montajes de red NFS"
description: "Evita que tu sistema operativo se quede congelado por 90 segundos al encenderse cuando tu servidor de almacenamiento NAS o local está apagado."
category: "Sistemas y Servidores"
tags: ["NFS", "Network", "Sysadmin"]
readTime: "3 min"
date: "2026-06-27"
---

Cuando configuras carpetas compartidas por red mediante el protocolo NFS (Network File System) para mover películas o respaldos entre tu computadora principal y tu servidor casero, el archivo `/etc/fstab` intenta conectarse al servidor externo durante el arranque del sistema. Si el servidor de almacenamiento está apagado o no hay señal de red local, Linux congela la pantalla de carga por un tiempo límite estricto de **90 segundos** antes de permitirte iniciar sesión.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Modificar los parámetros de montaje de red
Vamos a indicarle al sistema que la red es un elemento secundario no crítico y que no debe bloquear el inicio de la máquina si no responde de inmediato.
1. Abre tu terminal y edita la tabla de configuraciones:
```bash
sudo nano /etc/fstab
```
2. Localiza la línea que apunta a la dirección IP de tu red NFS. Se verá similar a esto: `192.168.1.50:/share /mnt/nfs nfs defaults 0 0`.
3. Modifica la sección de parámetros cambiando `defaults` por las siguientes opciones de protección:
```plaintext
192.168.1.50:/share /mnt/nfs nfs defaults,noauto,x-systemd.automount,x-systemd.device-timeout=5,timeo=14 0 0
```

### Paso 2: Entender las nuevas variables añadidas
- `noauto`: Evita que el sistema intente levantar la conexión pesada al instante de encender los circuitos.
- `x-systemd.automount`: Monta la carpeta compartida de forma transparente en el milisegundo exacto en que tu usuario haga doble clic sobre la carpeta usando el gestor de archivos.
- `x-systemd.device-timeout=5`: Si el servidor no responde en 5 segundos, desiste de inmediato y te permite usar tu computadora sin retrasos.

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Si trabajas con redes locales inalámbricas (Wi-Fi), nunca uses montajes NFS rígidos en el arranque de equipos móviles o laptops. Dado que las conexiones inalámbricas tardan unos segundos extras en autenticarse con el router tras iniciar el entorno de escritorio, las peticiones automáticas del fstab fallarán sistemáticamente, dejando tus accesos directos rotos hasta que fuerces un refresco manual por comandos.
