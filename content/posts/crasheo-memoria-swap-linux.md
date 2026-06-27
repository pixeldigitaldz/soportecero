---
title: "Solución al crasheo por falta de memoria virtual (SWAP) en Linux (CachyOS / Bazzite)"
description: "Evita que tus juegos pesados e instancias de Docker se cierren solos configurando o expandiendo el espacio de memoria SWAP en distribuciones modernas de Linux."
category: "Gaming Tech"
tags: ["Linux", "Optimización", "Gaming"]
readTime: "4 min"
date: "2026-06-26"
---

Al ejecutar títulos demandantes en hardware moderno bajo distribuciones Linux de alto rendimiento como **CachyOS** o **Bazzite**, el sistema puede cerrar repentinamente tus juegos o contenedores pesados sin previo aviso. Al revisar los logs, el culpable suele ser el proceso `Out Of Memory (OOM) Killer`.

Esto pasa porque el sistema se queda sin memoria RAM física y, al no encontrar suficiente memoria virtual (**espacio SWAP**) configurada en el almacenamiento local, congela o mata la aplicación para proteger el sistema operativo.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar tu estado actual de SWAP
Abre tu terminal y ejecuta el siguiente comando para ver si tienes memoria virtual activa:
```bash
swapon --show
```
Si no sale ninguna línea de respuesta, tu sistema carece por completo de memoria de intercambio.

### Paso 2: Crear un archivo SWAP seguro de 8 Gigabytes
Para juegos y edición, un archivo de 8GB asignado en tu SSD es ideal para dar soporte en picos de consumo de RAM. Ejecuta los siguientes comandos en orden:
```bash
# 1. Crear el archivo asignando el espacio
sudo fallocate -l 8G /swapfile

# 2. Darle permisos de seguridad correctos
sudo chmod 600 /swapfile

# 3. Formatear el archivo como espacio de intercambio
sudo mkswap /swapfile

# 4. Activar la nueva memoria SWAP
sudo swapon /swapfile
```

### Paso 3: Hacer el cambio permanente para cada reinicio
Para evitar que la configuración se borre al apagar la PC, añade el archivo a la tabla de particiones del sistema:
1. Abre el archivo de configuración:
```bash
sudo nano /etc/fstab
```
2. Añade la siguiente línea al final del todo:
```plaintext
/swapfile none swap sw 0 0
```
Guardar (Ctrl + O, Enter) y salir (Ctrl + X).

## 🛡️ Consejo de Prevención
Prácticas de seguridad recomendadas:
- Si usas sistemas modernos, investiga el uso de zRAM en lugar de un archivo SWAP tradicional. zRAM comprime los datos directamente en tu memoria RAM física, siendo hasta 10 veces más rápido que leer y escribir en un disco de estado sólido (SSD).
