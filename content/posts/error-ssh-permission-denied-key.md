---
title: "Cómo solucionar el error Permission Denied (publickey) en conexiones SSH"
description: "Aprende a reparar los fallos de autenticación por clave pública en SSH ajustando los permisos de directorios y del archivo authorized_keys."
category: "Sistemas y Servidores"
tags: ["SSH", "Linux", "Seguridad"]
readTime: "4 min"
date: "2026-06-27"
---

El error `Permission denied (publickey)` al intentar conectarte a un servidor remoto mediante SSH ocurre porque el demonio SSH (`sshd`) en el servidor remoto rechaza la clave privada presentada por tu cliente. Esto se debe habitualmente a permisos de archivos demasiado permisivos, lo cual invalida la seguridad de la conexión y obliga al servidor a descartar el intento por protección.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Corregir los permisos de tu clave privada en el cliente
La clave privada nunca debe ser legible por otros usuarios de la máquina local. Ajusta los permisos del archivo `.pem` o `id_rsa`:
```bash
# Cambiar permisos para que solo el propietario pueda leer el archivo
chmod 600 ~/.ssh/id_rsa
```

### Paso 2: Ajustar los permisos del directorio .ssh y autorizaciones en el servidor
Accede a la consola del servidor (a través de TTY o consola del proveedor de hosting) y ejecuta las siguientes correcciones sobre tu directorio de inicio:
```bash
# Asegurar el directorio de configuración de SSH
chmod 700 ~/.ssh

# Asegurar el archivo que almacena las claves autorizadas
chmod 600 ~/.ssh/authorized_keys

# Restablecer la propiedad de los archivos a tu usuario actual
chown -R $USER:$USER ~/.ssh
```

### Paso 3: Comprobar la directiva de autenticación en el servidor
Si el error persiste, edita el archivo de configuración del servicio SSH en el servidor `/etc/ssh/sshd_config` y verifica que la autenticación por clave pública esté habilitada:
```plaintext
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```
Reinicia el servicio para aplicar los cambios:
```bash
sudo systemctl restart sshd
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita compartir tu clave privada a través de medios inseguros o utilizar permisos laxos en el host local. Mantén siempre el principio de mínimos privilegios en tu configuración SSH. Configurar la directiva `StrictModes yes` en el servidor obliga a SSHD a rechazar conexiones de forma proactiva si los permisos de la carpeta personal o archivos autorizados son inseguros, previniendo intrusiones accidentales por descuidos en el sistema de archivos.
