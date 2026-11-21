---
title: Error Out of Memory OOM Killer en Linux y Systemd Cómo Diagnosticar y Evitar Caídas
description: >-
  Aprende a diagnosticar procesos terminados por el OOM Killer (Exit 137 / Out of memory) en Linux usando dmesg, journalctl, systemd-oomd y límites cgroups v2.
category: Sistemas y Servidores
tags:
  - Linux
  - Systemd
  - Memoria
  - Sysadmin
readTime: 7 min
date: '2026-11-21'
---

Cuando un servidor Linux agota por completo su memoria RAM física y su espacio de intercambio (*swap*), el kernel activa el mecanismo de emergencia **OOM Killer (*Out-of-Memory Killer*)** para evitar un bloqueo total del sistema (*kernel panic*). El síntoma clásico en aplicaciones web, bases de datos o contenedores es un cierre instantáneo sin previo aviso (`Killed`, `Exit Code 137` o `oom-kill` en los registros del sistema).

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **Fuga de memoria (*memory leak*) en Node.js, Java, Python o PHP-FPM** | Limitar la memoria máxima del proceso con `MemoryMax=` en la unidad `systemd` |
| **Ausencia de swap o umbral `vm.swappiness` desajustado en VPS** | Crear un archivo `swapfile` o configurar `zram` como colchón ante picos puntuales |
| **Protección insuficiente para servicios críticos (PostgreSQL, SSHD)** | Ajustar `OOMScoreAdjust=-500` en las unidades críticas de `systemd` |
| **Activación agresiva de `systemd-oomd` en distribuciones modernas** | Revisar alertas PSI (*Pressure Stall Information*) con `oomctl` y ajustar umbrales |

---

## Cómo Decide el Kernel Qué Proceso Matar (OOM Score)

El kernel de Linux asigna dinámicamente a cada proceso una puntuación llamada **`oom_score`** (entre `0` y `1000+`), visible en `/proc/<PID>/oom_score`. Cuanto mayor sea el porcentaje de memoria RAM y swap que consume un proceso respecto al total del sistema, mayor es su puntuación.

Cuando el asignador de páginas del kernel (`page allocator`) no logra liberar memoria tras recorrer las listas LRU (*Least Recently Used*) y vaciar cachés de disco (*page cache*), invoca a `out_of_memory()`. Este selecciona el proceso con el `oom_score` más alto, le envía la señal no capturable **`SIGKILL` (`kill -9`)** y registra la traza completa en el ring buffer del kernel.

En sistemas con **cgroups v2** y **systemd-oomd** (Ubuntu 22.04+, Fedora, Arch/CachyOS), las muertes por memoria también pueden ocurrir antes de agotar la RAM global si un *cgroup* supera su cuota o sufre presión sostenida de memoria (*Memory Pressure Stall Information - PSI*).

---

## Solución Paso a Paso: Diagnosticar y Contener el OOM Killer

### Paso 1: Confirmar que el OOM Killer terminó el proceso

Consulta los registros del kernel y de `systemd` buscando el evento exacto con la hora, el PID y la memoria consumida en páginas:

```bash
sudo dmesg -T | grep -iE "oom|killed process|out of memory"
```

Si utilizas `systemd` / `systemd-oomd`, inspecciona también `journalctl`:

```bash
sudo journalctl -k --since "24 hours ago" | grep -iE "oom-kill|killed process"
sudo journalctl -u systemd-oomd --since "24 hours ago"
```

Verás una línea similar a `Out of memory: Killed process 4812 (node) total-vm:4192840kB, anon-rss:1984212kB`, lo que confirma qué binario consumió la RAM residente (`anon-rss`).

### Paso 2: Proteger servicios críticos con `OOMScoreAdjust`

Para evitar que el kernel sacrifique tu base de datos o el demonio SSH en lugar de una aplicación secundaria con fuga de memoria, crea un *drop-in* en `systemd`:

```bash
sudo systemctl edit postgresql
```

Añade la siguiente configuración para reducir su probabilidad de ser elegido por el OOM Killer y limitar el impacto de otros servicios:

```ini
[Service]
OOMScoreAdjust=-500
```

### Paso 3: Aislar el servicio problemático con límites de `cgroups v2` (`MemoryHigh` y `MemoryMax`)

En lugar de dejar que un proceso descontrolado tumbe todo el servidor, establece un límite blando y un límite duro en su unidad `.service`:

```bash
sudo systemctl edit mi-app.service
```

```ini
[Service]
MemoryAccounting=yes
MemoryHigh=1200M
MemoryMax=1536M
Restart=on-failure
RestartSec=5s
```

* **`MemoryHigh`**: Cuando el servicio supera `1200M`, el kernel estrangula sus asignaciones y fuerza la recuperación agresiva de memoria sin matarlo de inmediato.
* **`MemoryMax`**: Si alcanza `1536M`, el OOM Killer actúa **únicamente dentro de ese cgroup**, protegiendo al resto del sistema operativo.

Recarga el demonio y aplica los cambios:

```bash
sudo systemctl daemon-reload
sudo systemctl restart mi-app.service
```

### Paso 4: Verificar límites activos y presión de memoria en tiempo real

Comprueba que `systemd` está aplicando los límites y revisa las métricas de presión de memoria:

```bash
systemctl show mi-app.service -p MemoryCurrent,MemoryHigh,MemoryMax,OOMScoreAdjust
cat /proc/pressure/memory
```

---

## Preguntas Frecuentes

### ¿Por qué el proceso muere aunque `free -h` mostraba memoria "disponible" minutos antes?
El OOM Killer suele dispararse por picos instantáneos de asignación (por ejemplo, una consulta SQL sin paginar, un *build* de Webpack/Vite o un `fork()` temporal que duplica páginas de memoria) que ocurren en milisegundos entre los intervalos de muestreo de tu monitor.

### ¿Aumentar el archivo Swap evita por completo el OOM Killer?
No resuelve una fuga de memoria (*memory leak*), pero proporciona un margen de seguridad vital ante picos legítimos de carga y permite que el kernel mueva páginas anónimas inactivas fuera de la RAM física antes de llegar a una situación crítica.

---

## Consejo de Prevención

* Configura `MemoryHigh` y `MemoryMax` en todos tus servicios de aplicación (`Node.js`, `Python`, `Java`, contenedores) para contener cualquier fuga de memoria dentro de su propio *cgroup*.
* Captura *heap snapshots* o perfiles de memoria antes de reiniciar un servicio que crece de forma lineal cada hora.
* Mantén un espacio de intercambio (`zram` o `swapfile` de al menos 2 GB en VPS pequeños) y configura alertas de monitorización cuando la memoria disponible baje del 15 %.
