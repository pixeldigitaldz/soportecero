---
title: "Solución: Error de arranque en Linux por configuración incorrecta en /etc/fstab"
description: "Aprende a reparar tu sistema Linux si no inicia y se queda congelado en la consola de emergencia (Emergency Mode) debido a un error en el archivo fstab."
category: "Sistemas y Servidores"
tags: ["Linux", "Sysadmin", "Terminal"]
readTime: "5 min"
date: "2026-06-26"
---

Modificar el archivo `/etc/fstab` para montar discos duros secundarios o memorias de intercambio (SWAP) es común, pero un solo carácter mal escrito, un espacio de más o un UUID de disco inexistente hará que tu distribución Linux falle al arrancar, enviándote directamente a una pantalla negra con el mensaje de error `Welcome to emergency mode!`.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Acceder con permisos de escritura
En el modo de emergencia, el sistema de archivos suele estar bloqueado en modo "Solo Lectura", por lo que no podrás guardar ninguna corrección. Ejecuta este comando para desbloquearlo:
```bash
mount -o remount,rw /
```

### Paso 2: Editar el archivo con precaución
Abre el configurador utilizando el editor de texto integrado de la consola:
```bash
nano /etc/fstab
```

### Paso 3: Comentar o reparar la línea corrupta
Busca la última línea que agregaste (la del disco nuevo o la SWAP). Si no estás seguro de cuál es el error en la sintaxis, coloca un símbolo de almohadilla # al principio de esa línea entera. Esto le dice a Linux que ignore esa instrucción durante el arranque:
```plaintext
# /swapfile none swap sw 0 0
```
Guarda los cambios presionando Ctrl + O, da Enter y sal con Ctrl + X.

### Paso 4: Probar y reiniciar
Antes de reiniciar a ciegas, dile al sistema que compruebe si la sintaxis del archivo fstab es correcta:
```bash
findmnt --verify
```
Si la terminal no arroja líneas rojas de error, puedes reiniciar de forma limpia para volver a tu entorno de escritorio:
```bash
reboot
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
* Al añadir discos secundarios en /etc/fstab, utiliza siempre la propiedad nofail en los parámetros (ej. defaults,nofail). De esta manera, si el disco externo se desconecta o falla, Linux omitirá el montaje y arrancará normalmente en lugar de colapsar en el modo de emergencia.
