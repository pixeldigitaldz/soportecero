---
title: "How to Force Renewal of an Expired Let's Encrypt SSL Certificate with Certbot"
description: "Learn how to resolve Certbot authentication failures and renew your expired SSL certificates by freeing up the necessary ports."
category: "Systems & Servers"
tags: ["SSL", "Let's Encrypt", "Certbot", "Nginx"]
readTime: "4 min"
date: "2026-08-04"
---

The expired SSL certificate error when accessing your website, despite using Let's Encrypt's Certbot, typically occurs because the automatic renewal service failed silently due to port 80 being blocked by your conflicting web server, or due to changes in your DNS records.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Identificar y liberar puertos bloqueados
Let's Encrypt uses the HTTP-01 challenge to verify that you own the domain, which requires free access on port `80`. Temporarily stop the conflicting web server:
```bash
# Si utilizas Nginx
sudo systemctl stop nginx

# Si utilizas Apache
sudo systemctl stop apache2
```

### Paso 2: Ejecutar la renovación forzada de Certbot
Start the forced manual renewal to ignore previous expiration cache policies:
```bash
# Forzar la renovación en consola
sudo certbot renew --force-renewal
```
*(Verify that the console returns a success message: `Congratulations, all renewals succeeded`).*

### Paso 3: Volver a iniciar los servidores web y verificar
Restart your production services to apply the new cryptographic keys:
```bash
sudo systemctl start nginx
sudo systemctl start apache2
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- Do not rely solely on periodic manual renewals for the security of your sites. Make sure to verify that Certbot's internal automatic renewal timer is active in the system, which will validate the certificate status twice a day:
  ```bash
  # Verificar el estado del temporizador systemd
  systemctl list-timers | grep certbot
  ```
  If HTTP challenges on port 80 regularly fail due to corporate security firewalls, migrate your validation process to the DNS-01 challenge using the corresponding APIs of your DNS provider (Cloudflare, Route53, etc.).
