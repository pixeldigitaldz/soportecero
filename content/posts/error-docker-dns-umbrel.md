---
title: "Solución: Pérdida de conexión a internet por fallo de DNS en Docker (Umbrel OS)"
description: "Aprende a resolver el bloqueo de red donde tus contenedores en Umbrel pierden el acceso al exterior debido a conflictos con el resolvedor DNS interno."
category: "Sistemas y Servidores"
tags: ["Umbrel", "Docker", "DNS"]
readTime: "4 min"
date: "2026-06-27"
---

Un fallo crítico muy común en servidores domésticos basados en el ecosistema **Umbrel OS** ocurre cuando los contenedores de Docker (como Sonarr o tus nodos) dejan de descargar actualizaciones o pierden la conexión con los servidores exteriores de repente, arrojando errores de tipo `Temporary failure in name resolution`. Esto sucede porque el demonio de Docker pierde la ruta hacia el resolvedor DNS local del sistema operativo anfitrión.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprobar el bloqueo de red interno
Entra a tu servidor Umbrel por SSH e ingresa al contenedor afectado para comprobar si responde a un ping numérico directo pero falla al resolver nombres de texto:
```bash
# Probar IP directa de Google (Si responde, hay internet pero no DNS)
docker exec -it nombre_contenedor ping -c 3 8.8.8.8
```

### Paso 2: Forzar DNS públicos globales en la configuración de Docker

Para saltarte los bloqueos del enrutamiento de Umbrel, podemos definir DNS estáticos e inmutables para todo el motor de Docker. Edita el archivo de configuración global:
```bash
sudo nano /etc/docker/daemon.json
```

Añade o fusiona las siguientes líneas con las DNS estables de Cloudflare y Google dentro del objeto JSON:
```json
{
  "dns": ["1.1.1.1", "8.8.8.8"]
}
```

Guarda el archivo (`Ctrl + O`, `Enter`) y cierra el editor (`Ctrl + X`).

### Paso 3: Reiniciar el servicio de Docker

Aplica un reinicio forzado al servicio del sistema para que vuelva a levantar todas las interfaces de red con las nuevas DNS inyectadas:
```bash
sudo systemctl restart docker
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita modificar directamente el archivo `/etc/resolv.conf` en Umbrel OS de forma manual, ya que este archivo es administrado de manera dinámica por el sistema y se sobrescribirá por completo en cada reinicio físico de tu Mini PC o Raspberry Pi, borrando tus correcciones.
