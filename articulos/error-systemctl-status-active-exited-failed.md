---
title: 'Cómo entender y reparar el estado active (exited) o failed en Systemd'
description: 'Guía paso a paso para diagnosticar por qué un servicio de Linux finaliza en active (exited) o failed al iniciarse con systemctl.'
category: 'Sistemas y Servidores'
date: '2026-08-20'
readTime: '3 min'
tags: ['Linux', 'Systemd', 'DevOps']
---

El estado `active (exited)` en Systemd indica que el comando configurado en la directiva `ExecStart` se ejecutó con éxito y terminó su proceso de inicialización, mientras que `failed` o `activating (auto-restart)` indica que el binario abortó por fallos de configuración, rutas inexistentes o permisos insuficientes.

Comprender la diferencia entre el tipo de servicio `Type=oneshot` y `Type=simple` es la clave para saber si tu servicio realmente está funcionando o si se ha detenido inesperadamente.

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Servicio configurado como `Type=oneshot`** | Es un comportamiento normal para scripts que solo se ejecutan una vez y terminan |
| **Error en variable de entorno o archivo de configuración** | Inspeccionar los logs con `journalctl -u nombre-servicio -e --no-pager` |
| **Permisos denegados en el binario o usuario de ejecución** | Verificar que el usuario definido en `User=` tenga acceso a `WorkingDirectory=` |

## La Solución Paso a Paso

**Inspecciona los logs detallados del servicio**
Cuando un servicio falla o no se comporta como esperas, el comando `systemctl status` solo muestra las últimas líneas. Usa `journalctl` para ver el volcado completo de salida estándar y error:
```bash
sudo journalctl -u mi-servicio.service -n 50 --no-pager
```

**Verifica el tipo de servicio en el archivo .service**
Abre la unidad de Systemd en `/etc/systemd/system/mi-servicio.service`. Si tu aplicación es un demonio continuo (como un servidor Node, Python o Go) pero tiene `Type=oneshot`, Systemd no mantendrá el proceso en segundo plano:
```ini
[Unit]
Description=Mi Aplicacion en Segundo Plano
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/mi-app
ExecStart=/usr/bin/node /var/www/mi-app/server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**Recarga el daemon de Systemd y reinicia el servicio**
Cada vez que modifiques el archivo de configuración `.service`, debes notificar al gestor de inicialización de Linux antes de reiniciar el proceso:
```bash
sudo systemctl daemon-reload
sudo systemctl restart mi-servicio.service
sudo systemctl status mi-servicio.service
```

**Comprueba las rutas absolutas y ejecutables**
Systemd no hereda la variable `$PATH` de tu usuario. Si tu script usa `node`, `python3` o scripts de bash, asegúrate de colocar la ruta absoluta completa (ejemplo: `/usr/bin/python3` en vez de solo `python3`). Puedes obtener la ruta con:
```bash
which node
which python3
```

## Prevención
- **Validación de sintaxis:** Ejecuta `systemd-analyze verify /etc/systemd/system/mi-servicio.service` para detectar errores de configuración antes de reiniciar el servidor.
- **Límites de reinicio:** Siempre configura `RestartSec=5s` y `StartLimitBurst=5` para evitar que un servicio roto entre en un bucle infinito que sature la CPU.
