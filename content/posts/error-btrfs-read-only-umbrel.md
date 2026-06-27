---
title: "Cómo reparar un sistema de archivos BTRFS bloqueado en Solo Lectura (Read-Only) en tu servidor"
description: "Guía paso a paso para recuperar el acceso de escritura en discos duros de servidores domésticos que se bloquean para proteger tus datos de corrupción."
category: "Sistemas y Servidores"
tags: ["BTRFS", "Linux", "Storage"]
readTime: "4 min"
date: "2026-06-27"
---

Cuando un disco duro secundario configurado con el sistema de archivos moderno BTRFS (muy común en arreglos de almacenamiento y servidores caseros como Umbrel o ZimaOS) detecta un error de escritura, un corte de energía o sectores corruptos, el núcleo de Linux cambia su estado automáticamente a `Read-Only` (Solo lectura) para evitar que la información existente se destruya. Esto congela de inmediato todas tus aplicaciones de automatización y descargas.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Desmontar la unidad afectada
No intentes forzar la escritura de datos sobre un disco bloqueado. Primero, detén los servicios de Docker que lo estén usando y desmonta la ruta:
```bash
sudo systemctl stop docker
sudo umount /dev/sdb1
```
*(Reemplaza `/dev/sdb1` por la nomenclatura exacta de tu disco detectado).*

### Paso 2: Ejecutar una verificación de errores limpia (Check Scratch)

Usaremos las herramientas internas de BTRFS para escanear el árbol de metadatos del almacenamiento sin modificar los bloques:
```bash
sudo btrfs check --readonly /dev/sdb1
```

Lee las últimas líneas de la terminal. Si el sistema te reporta errores menores en el mapa de espacio libre (*free space cache*), podemos ordenar una reparación segura de los descriptores de archivos ejecutando:
```bash
sudo btrfs check --repair /dev/sdb1
```
*(Nota: Ejecuta la reparación únicamente si el check previo te lo sugiere explícitamente).*

### Paso 3: Remontar el disco en modo de rescate limpio

Si el volumen sigue dando problemas, fuérzalo a arrancar limpiando los registros de transiciones corruptas antiguas:
```bash
sudo mount -o remount,clear_cache,rw /dev/sdb1 /mnt/storage
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Las caídas de tensión eléctrica son el enemigo número uno de los servidores basados en Linux. Si tienes tu servidor conectado directamente al tomacorriente de la pared sin un sistema de alimentación ininterrumpida (UPS/No-Break), corres el riesgo latente de perder particiones enteras por culpa de un apagón. Configurar tus discos duros con parámetros de montaje seguros como `noatime` reduce los ciclos de escritura constantes y protege la vida del hardware.
