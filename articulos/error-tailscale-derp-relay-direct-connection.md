---
title: >-
  Cómo solucionar la alta latencia y forzar conexión directa en Tailscale
  (evitar DERP)
description: >-
  ¿Tus conexiones en Tailscale son lentas o tienen pings de más de 200 ms?
  Aprende a solucionar el bloqueo de DERP relay y restablecer conexiones
  directas P2P con WireGuard.
category: Sistemas y Servidores
tags:
  - Tailscale
  - WireGuard
  - VPN
  - Linux
  - Sysadmin
readTime: 9 min
date: '2026-09-24'
---
Cuando conectas tus servidores, estaciones de trabajo o dispositivos móviles a una red de malla segura mediante **Tailscale**, la arquitectura está diseñada para establecer conexiones directas punto a punto (P2P) cifradas con **WireGuard**. Sin embargo, en entornos con routers restrictivos, CGNAT de proveedores de internet o cortafuegos corporativos, Tailscale no logra completar la negociación NAT y recurre automáticamente a sus servidores de retransmisión conocidos como **DERP (Designated Encrypted Relay for Packets)**.

Aunque los repetidores DERP garantizan que tus equipos nunca pierdan conectividad, provocan un impacto severo en el rendimiento: la latencia de red se dispara con pings superiores a 150-300 ms y el ancho de banda cae drásticamente, ralentizando transferencias SSH, túneles RDP y copias de seguridad remotas.

## Análisis de Arquitectura y Causa Raíz

En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema `ulimit` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error `ENOSPC (No space left on device)` o `EMFILE (Too many open files)`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como `open()`, `unlink()` o `chmod()` evalúan los bits de permiso estándar (Lectura `r`, Escritura `w`, Ejecución `x`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante `chattr +i`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado `root`, retornando el error `EPERM (Operation not permitted)`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (`vm.swappiness`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Firewall local o de hosting bloqueando tráfico UDP entrante** | Allow UDP port `41641` in UFW/iptables and update cloud network security group rules |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l tailscaled

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u tailscaled -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Antes de modificar reglas de red, verifica el canal de comunicación exacto entre tu máquina y el nodo destino. Ejecuta:

```bash
# Comprobar la ruta y latencia directa hacia el nodo
tailscale ping 100.x.y.z
```

Si en la salida del comando observas mensajes como `via DERP(mad) in 184ms`, la conexión está siendo canalizada por el relay de Madrid (u otra región) en lugar de una conexión directa.

Para auditar el estado global de todos tus pares conectados, ejecuta:

```bash
tailscale status
```
Los nodos conectados mediante relay mostrarán la etiqueta `; relay "..."` junto a la dirección IP del peer.

### Paso 2: Habilitar y abrir el puerto de escucha estático UDP 41641

Por defecto, Tailscale utiliza el puerto UDP `41641` como puerto preferente para la negociación de paquetes WireGuard. Si el firewall del sistema operativo o el security group de tu VPS bloquea conexiones UDP entrantes en este rango, Tailscale nunca podrá establecer el túnel P2P.

En servidores Linux con **UFW**, permite el tráfico entrante:

```bash
# Permitir puerto estándar de WireGuard/Tailscale
sudo ufw allow 41641/udp
sudo ufw reload
```

Si utilizas **iptables** directamente o firewalld:

```bash
# Para iptables
sudo iptables -A INPUT -p udp --dport 41641 -j ACCEPT

# Para firewalld (RHEL/Rocky/Fedora)
sudo firewall-cmd --permanent --add-port=41641/udp
sudo firewall-cmd --reload
```

### Paso 3: Configurar Port Forwarding o UPnP en tu router local

Si el servidor o máquina se encuentra detrás de una conexión doméstica o de oficina con NAT estricto (doble NAT o routers comerciales), el protocolo de NAT traversal de Tailscale (basado en STUN) puede verse bloqueado:

1. Accede al panel de administración de tu router (habitualmente `192.168.1.1` o `192.168.0.1`).
2. Ve a la sección **Advanced / Forwarding / Virtual Servers**.
3. Añade una regla de reenvío de puertos:
   - **Protocolo:** UDP
   - **Puerto externo:** `41641`
   - **Puerto interno:** `41641`
   - **IP interna:** La dirección IP local privada de tu máquina (ej. `192.168.1.50`).
4. Si tu router cuenta con soporte para **UPnP** o **NAT-PMP**, asegúrate de que esté habilitado para que el demonio `tailscaled` pueda mapear puertos dinámicamente.

### Paso 4: Reiniciar el demonio de Tailscale y verificar la conexión directa

Una vez abiertos los puertos de red, reinicia el servicio de Tailscale para forzar un nuevo intento de negociación STUN:

```bash
# Reiniciar el demonio tailscaled
sudo systemctl restart tailscaled

# Forzar ping al nodo remoto
tailscale ping 100.x.y.z
```

Ahora deberías ver en la terminal una respuesta inmediata similar a:
```text
pong from mi-servidor (100.x.y.z) via 198.51.100.24:41641 in 14ms (direct)
```
La presencia de **`(direct)`** certifica que los paquetes viajan a la máxima velocidad posible sin intermediarios.

## 🛡️ Consejos de Prevención

Prácticas de seguridad recomendadas:
- Mantén siempre actualizado el cliente de Tailscale (`sudo apt update && sudo apt install tailscale`) para beneficiarte de mejoras en las técnicas de NAT Traversal.
- En entornos cloud (AWS EC2, Hetzner Cloud, DigitalOcean Droplets), asegúrate de que el firewall perimetral permita todo el tráfico UDP bidireccional en el puerto `41641`.
- Si utilizas Docker en el mismo host, verifica que las reglas automáticas de iptables de Docker no interfieran con la interfaz `tailscale0`.

## Preguntas Frecuentes

### ¿El uso de repetidores DERP compromete la seguridad o cifrado de mis datos?
No. Los servidores DERP son relays ciegos que solo reenvían paquetes cifrados de WireGuard. Tailscale y los servidores de retransmisión no poseen las claves privadas de tus nodos, por lo que nunca pueden descifrar ni inspeccionar el contenido del tráfico.

### ¿Por qué mi conexión pasa a DERP si ambos nodos están en la misma red local?
Esto ocurre habitualmente cuando el router tiene activado el aislamiento de clientes (*Client Isolation*) o AP Isolation en redes Wi-Fi, impidiendo que dos dispositivos se comuniquen entre sí directamente a través de sus direcciones IP privadas.
