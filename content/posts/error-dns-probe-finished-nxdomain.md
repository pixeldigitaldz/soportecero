---
title: "Cómo solucionar el error DNS_PROBE_FINISHED_NXDOMAIN en tu red local"
description: "Aprende a corregir el error DNS_PROBE_FINISHED_NXDOMAIN en Windows, Linux y macOS vaciando la caché DNS y cambiando los servidores DNS."
category: "Web y Código"
tags: ["DNS", "Redes", "Windows", "Linux", "Chrome", "SysAdmin"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Caché DNS del sistema operativo o del navegador corrupta o desactualizada** | Vaciar la caché DNS con `ipconfig /flushdns` en Windows o `resolvectl flush-caches` en Linux |
| **Servidores DNS del proveedor de internet (ISP) caídos o bloqueando el dominio** | Cambiar los servidores DNS primarios a Cloudflare (`1.1.1.1`) o Google (`8.8.8.8`) |

El error `DNS_PROBE_FINISHED_NXDOMAIN` (Non-Existent Domain) significa que el Resolvedor de Nombres de Dominio no pudo traducir el nombre de host solicitado (ej. `misitio.com`) a una dirección IP numérica válida. Esto sucede comúnmente por registros obsoletos en la caché DNS local, desconfiguración del archivo `hosts` o caídas temporales en los servidores DNS asignados por tu router.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Vaciar la caché DNS del sistema operativo
Elimina cualquier registro IP erróneo o corrupto almacenado en la memoria del equipo:
```bash
# En Windows (Símbolo del sistema como Administrador):
ipconfig /flushdns

# En Linux (con systemd-resolved):
sudo resolvectl flush-caches

# En macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### Paso 2: Limpiar la caché interna del navegador Google Chrome / Brave
Los navegadores basados en Chromium mantienen su propio almacén DNS independiente:
1. Abre tu navegador y escribe en la barra de direcciones: `chrome://net-internals/#dns`
2. Haz clic en el botón **Clear host cache**.
3. Abre también `chrome://net-internals/#sockets` y pulsa **Flush socket pools**.

### Paso 3: Configurar servidores DNS públicos rápidos y seguros (Cloudflare / Google)
Sustituye los DNS automáticos de tu proveedor de telefonía por servidores públicos de baja latencia:
- **Cloudflare DNS**: Primario `1.1.1.1` | Secundario `1.0.0.1`
- **Google Public DNS**: Primario `8.8.8.8` | Secundario `8.8.4.4`

En Linux, configúralos editando `/etc/resolv.conf` o `/etc/systemd/resolved.conf`:
```ini
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=1.0.0.1 8.8.4.4
```
Reinicia el servicio con: `sudo systemctl restart systemd-resolved`.

### Paso 4: Comprobar el archivo hosts del sistema
Asegúrate de que no haya entradas estáticas erróneas apuntando a IPs locales inválidas:
- En Windows: `C:\Windows\System32\drivers\etc\hosts`
- En Linux / macOS: `/etc/hosts`

## 🛡️ Consejos de Prevención
- **Usa DNS sobre HTTPS (DoH):** Activa DNS sobre HTTPS en tu navegador para proteger tus consultas DNS contra secuestro de tráfico (DNS Spoofing).
- **Verifica la propagación DNS global:** Si eres el dueño del dominio, comprueba en herramientas como *whatsmydns.net* si los registros `A` o `CNAME` se han propagado correctamente tras un cambio de DNS.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Qué significa exactamente NXDOMAIN?
Es un código de estado oficial del protocolo DNS que significa "Non-Existent Domain" (Dominio no existente). El servidor raíz confirmó que el dominio no posee ningún registro IP asignado.

### ¿Reiniciar el router puede solucionar este error?
Sí. Muchos routers domésticos almacenan en caché las respuestas DNS de tu red local. Reiniciarlo fuerza la descarga de tablas de enrutamiento limpias desde tu ISP.
