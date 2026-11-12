---
title: Error 521 Web Server Is Down en Cloudflare
description: >-
  ¿Tus usuarios ven el Error 521 de Cloudflare al entrar a tu sitio web?
  Solución paso a paso para Nginx, Apache y reglas de Firewall de origen.
category: Sistemas y Servidores
tags:
  - Cloudflare
  - Nginx
  - Apache
  - Sysadmin
readTime: 7 min
date: '2026-08-24'
---
El **`Error 521: Web server is down`** devuelto por la pantalla de protección de Cloudflare ocurre cuando los servidores proxy de Cloudflare intentaron conectarse a la dirección IP de tu servidor de origen (en los puertos 80 o 443), pero el servidor web (Nginx / Apache) rechazó la conexión o la rechazó un cortafuegos.

## Análisis de Arquitectura y Causa Raíz

En servidores web de alto rendimiento como **Nginx** y **Apache HTTP Server**, la arquitectura de despacho de solicitudes se basa en modelos de concurrencia optimizados: bucles de eventos asíncronos no bloqueantes gobernados por multiplexación de E/S (`epoll` en Linux) en el caso de Nginx, y modelos híbridos prefork/worker basados en hilos y procesos en Apache.

El fallo técnico reportado se origina por una discrepancia en la negociación de capas entre el servidor web y los procesos upstream o el sistema de archivos subyacente:
1. **Resolución de sockets y ciclo de vida HTTP:** Cuando Nginx actúa como reverse proxy hacia un servidor de aplicaciones (PHP-FPM, Node.js, Python WSGI o contenedores), delega el tráfico a través de sockets TCP (`127.0.0.1:puerto`) o sockets de dominio UNIX (`AF_UNIX`). Si el backend colapsa por una excepción no controlada, agota su cola de backlog de conexiones entrantes (`somaxconn`), o excede el umbral de tiempo establecido por `proxy_read_timeout`, el kernel emite una señal de cierre de canal que Nginx traduce en un error HTTP 502 Bad Gateway o 504 Gateway Timeout hacia el cliente web.
2. **Evaluación de directivas `.htaccess` y memoria en Apache:** En Apache, cada solicitud hacia un directorio provoca que el servidor escanee y parsee el archivo `.htaccess` en tiempo de ejecución. Si se declara una directiva correspondiente a un módulo no cargado en el kernel de Apache (como reglas de reescritura `RewriteRule` sin el módulo `mod_rewrite`, o manipulación de encabezados sin `mod_headers`), el compilador de configuración interno aborta inmediatamente la petición con un error HTTP 500 Internal Server Error, registrando la alerta en el log del servidor.
3. **Permisos POSIX y herencia de grupos de ejecución:** El servidor web corre bajo una identidad de privilegios mínimos en el sistema operativo (comúnmente `www-data`, `nginx` o `apache`). Si los archivos web carecen de permisos de lectura (`r`, máscara 644) o los directorios carecen de permisos de ejecución y paso (`x`, máscara 755), el kernel deniega la llamada `open()` con el error `EACCES`, transformándose en un error HTTP 403 Forbidden.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Servidor web de origen apagado o caído** | Iniciar el servidor web local (Nginx/Apache): `systemctl restart nginx` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Verificar la sintaxis de los archivos de configuración
sudo nginx -t

# 2. Consultar las últimas 50 líneas del registro de errores en tiempo real
sudo tail -n 50 /var/log/nginx/error.log

# 3. Comprobar qué procesos están escuchando en los puertos HTTP/HTTPS
sudo ss -tulpn | grep -E ':(80|443|3000|8080|9000)'
```

- El comando `nginx -t` valida la sintaxis de todos los bloques `server` y `location` incluidos, confirmando si los certificados SSL y las rutas de sockets existen en el disco sin interrumpir el servicio activo.
- El comando `ss` con los flags `-t` (TCP), `-u` (UDP), `-l` (listening), `-p` (procesos y PIDs asociados) y `-n` (numérico sin resolución DNS inversa) identifica con precisión milimétrica si otro servicio está ocupando el puerto o si el backend está inactivo.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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

## 🛡️ Consejos de Prevención

* Instala el módulo de registros reales de cliente (`mod_remoteip` en Apache o `set_real_ip_from` en Nginx) para que tu servidor registre la IP real del visitante y no la de Cloudflare.
