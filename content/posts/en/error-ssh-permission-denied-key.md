---
title: "How to Fix Permission Denied (publickey) Error in SSH Connections"
description: "Learn how to repair public key authentication failures in SSH by adjusting directory permissions and the authorized_keys file."
category: "Systems & Servers"
tags: ["SSH", "Linux", "Security"]
readTime: "4 min"
date: "2026-08-03"
---

The `Permission denied (publickey)` error when trying to connect to a remote server via SSH occurs because the SSH daemon (`sshd`) on the remote server rejects the private key presented by your client. This is usually due to file permissions being too permissive, which invalidates the security of the connection and forces the server to discard the attempt for protection.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Corregir los permisos de tu clave privada en el cliente
The private key must never be readable by other users of the local machine. Adjust the permissions of the `.pem` or `id_rsa` file:
```bash
# Cambiar permisos para que solo el propietario pueda leer el archivo
chmod 600 ~/.ssh/id_rsa
```

### Paso 2: Ajustar los permisos del directorio .ssh y autorizaciones en el servidor
Access the server console (through TTY or the hosting provider's console) and run the following fixes on your home directory:
```bash
# Asegurar el directorio de configuración de SSH
chmod 700 ~/.ssh

# Asegurar el archivo que almacena las claves autorizadas
chmod 600 ~/.ssh/authorized_keys

# Restablecer la propiedad de los archivos a tu usuario actual
chown -R $USER:$USER ~/.ssh
```

### Paso 3: Comprobar la directiva de autenticación en el servidor
If the error persists, edit the SSH service configuration file on the server `/etc/ssh/sshd_config` and verify that public key authentication is enabled:
```plaintext
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```
Restart the service to apply the changes:
```bash
sudo systemctl restart sshd
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- Avoid sharing your private key through insecure means or using lax permissions on the local host. Always maintain the principle of least privilege in your SSH configuration. Setting the `StrictModes yes` directive on the server forces SSHD to proactively reject connections if the home directory or authorized file permissions are insecure, preventing accidental intrusions due to filesystem oversights.
