---
title: "Cómo forzar la renovación de un certificado SSL de Let's Encrypt expirado con Certbot"
description: "Aprende a solucionar los fallos de autenticación de Certbot y renueva tus certificados SSL expirados liberando los puertos necesarios."
category: "Sistemas y Servidores"
tags: ["SSL", "Let's Encrypt", "Certbot", "Nginx"]
readTime: "4 min"
date: "2026-06-27"
---

El error de certificado SSL expirado al acceder a tu sitio web, a pesar de usar Certbot de Let's Encrypt, ocurre habitualmente porque el servicio automático de renovación falló silenciosamente debido al bloqueo del puerto 80 por parte de tu servidor web en conflicto, o por cambios en tus registros DNS.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Identificar y liberar puertos bloqueados
Let's Encrypt utiliza el desafío HTTP-01 para verificar que eres dueño del dominio, lo que requiere acceso libre en el puerto `80`. Detén temporalmente el servidor web en conflicto:
```bash
# Si utilizas Nginx
sudo systemctl stop nginx

# Si utilizas Apache
sudo systemctl stop apache2
```

### Paso 2: Ejecutar la renovación forzada de Certbot
Inicia la renovación manual forzada para ignorar las políticas de caché de expiración previas:
```bash
# Forzar la renovación en consola
sudo certbot renew --force-renewal
```
*(Verifica que la consola te devuelva un mensaje de éxito: `Congratulations, all renewals succeeded`).*

### Paso 3: Volver a iniciar los servidores web y verificar
Reinicia tus servicios de producción para aplicar las nuevas llaves criptográficas:
```bash
sudo systemctl start nginx
sudo systemctl start apache2
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- No dependas exclusivamente de renovaciones manuales periódicas para la seguridad de tus sitios. Asegúrate de verificar que el temporizador interno de renovación automática de Certbot esté activo en el sistema, lo que validará el estado del certificado dos veces al día:
  ```bash
  # Verificar el estado del temporizador systemd
  systemctl list-timers | grep certbot
  ```
  Si los desafíos HTTP en el puerto 80 fallan de forma regular debido a cortafuegos de seguridad corporativos, migra tu proceso de validación al desafío DNS-01 utilizando las API correspondientes de tu proveedor de nombres (Cloudflare, Route53, etc.).
