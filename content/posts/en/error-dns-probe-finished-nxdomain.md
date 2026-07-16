---
title: "How to Fix DNS_PROBE_FINISHED_NXDOMAIN Error on Your Local Network"
description: "Learn how to resolve the DNS NXDOMAIN resolution failure by clearing your system cache and configuring stable name servers."
category: "Systems & Servers"
tags: ["DNS", "Network", "Sysadmin"]
readTime: "4 min"
date: "2026-07-26"
---

The name resolution error `DNS_PROBE_FINISHED_NXDOMAIN` occurs when the DNS server assigned by your local network or internet service provider cannot find the IP address associated with the domain you are trying to open, responding that the requested domain does not exist.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Vaciar la caché local del resolvedor DNS en tu terminal
Your operating system temporarily stores previous queries to save bandwidth. If a query failed in the past, your machine will continue to report the error unless you clear the local cache:
```bash
# En Linux (utilizando systemd-resolved)
sudo resolvectl flush-caches

# Verificar el estado de la caché DNS activa
resolvectl statistics
```

### Paso 2: Forzar servidores de nombres públicos estables (Google / Cloudflare)
If your local network provider's resolver is unstable, edit the resolvers on your machine. On Linux systems with static networking, modify `/etc/resolv.conf`:
```bash
sudo nano /etc/resolv.conf
```
Ensure that it only contains fast, trusted resolvers:
```plaintext
nameserver 1.1.1.1
nameserver 8.8.8.8
```

## 🛡️ Consejo de Prevención

Recommended safety practices:
- Do not use unstable or unencrypted DNS resolvers to manage internal communication on production servers. In hybrid local networks, maintain a policy of short time-to-live values (low TTL of 300 or 600 seconds) for your NS records. This ensures that if you perform IP changes or domain migrations, client routers automatically clear outdated information and do not keep broken routing that triggers the NXDOMAIN error for your users.
