---
title: "[SOLUCIONADO] Error 521 Web Server Is Down en Cloudflare"
description: "¿Tus usuarios ven el Error 521 de Cloudflare al entrar a tu sitio web? Solución paso a paso para Nginx, Apache y reglas de Firewall de origen."
category: "Sistemas y Servidores"
tags: ["Cloudflare", "Nginx", "Apache", "Sysadmin"]
readTime: "4 min"
date: "2026-08-24"
---

El **`Error 521: Web server is down`** devuelto por la pantalla de protección de Cloudflare ocurre cuando los servidores proxy de Cloudflare intentaron conectarse a la dirección IP de tu servidor de origen (en los puertos 80 o 443), pero el servidor web (Nginx / Apache) rechazó la conexión o la rechazó un cortafuegos.

> **Solución Rápida (1 Minuto):**
> 1. Inicia tu servidor web de origen:
>    `sudo systemctl restart nginx` o `sudo systemctl restart apache2`
> 2. Permite las IPs de Cloudflare en tu firewall (UFW/iptables):
>    `sudo ufw allow from 103.21.244.0/22 to any port 80,443 proto tcp`

## 🚀 Cómo solucionar el Error 521 de Cloudflare paso a paso

### Paso 1: Verificar que el servidor de origen esté respondiendo
Conéctate por SSH a tu VPS y comprueba si Nginx o Apache están activos:

```bash
# Para Nginx
sudo systemctl status nginx

# Para Apache
sudo systemctl status apache2
```
Si el servidor web está caído por falta de memoria RAM o un fallo de configuración, reinícialo:
```bash
sudo systemctl restart nginx
```

### Paso 2: Permitir los rangos de IP de Cloudflare en tu Firewall
Si tu firewall local (UFW o iptables) o el grupo de seguridad de tu proveedor de nube (AWS, DigitalOcean, Hetzner) bloquea peticiones de proxies, Cloudflare arrojara el error 521.

Asegúrate de no estar bloqueando las subredes oficiales de Cloudflare. En UFW puedes permitir el tráfico de Cloudflare:

```bash
# Permitir tráfico HTTP/HTTPS desde Cloudflare
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### Paso 3: Configurar SSL/TLS Mode en Cloudflare (Full / Full Strict)
Si configuraste la seguridad SSL de Cloudflare en modo **Strict**, Cloudflare requerirá que tu servidor web de origen responda obligatoriamente en el puerto 443 con un certificado SSL válido.

1. Entra al panel de control de **Cloudflare** -> pestaña **SSL/TLS**.
2. Cambia temporalmente de *Strict* a **Full** o **Flexible** para verificar si la causa es la falta de un certificado activo en Nginx/Apache.
3. Emite un certificado gratuito de Let's Encrypt o instala el certificado de origen de Cloudflare (*Cloudflare Origin Certificate*) en Nginx.

## 🛡️ Consejo de Prevención
* Instala el módulo de registros reales de cliente (`mod_remoteip` en Apache o `set_real_ip_from` en Nginx) para que tu servidor registre la IP real del visitante y no la de Cloudflare.
