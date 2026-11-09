---
title: "Cómo diagnosticar y reparar el error 502 Bad Gateway en Nginx reverse proxy"
description: "Guía técnica completa para diagnosticar y solucionar el error 502 Bad Gateway en Nginx proxy inverso analizando sockets UNIX, puertos TCP, permisos de upstream y registros en tiempo real."
category: "Sistemas y Servidores"
tags:
  - Nginx
  - Docker
  - Sysadmin
  - Linux
  - PHP-FPM
readTime: "7 min"
date: "2026-06-27"
---

El error **502 Bad Gateway** es una respuesta estándar del protocolo HTTP (definida formalmente en RFC 7231 y RFC 9110) emitida por un servidor web intermedio que opera como puerta de enlace o proxy inverso. En una arquitectura moderna basada en **Nginx**, este código indica de forma inequívoca que Nginx actuó como intermediario para transferir la petición entrante del cliente hacia un servicio de aplicación en el backend (como PHP-FPM, un proceso Node.js, un servidor ASGI/WSGI como Uvicorn o Gunicorn, o un contenedor Docker), pero recibió una respuesta inválida, un paquete TCP RST (Reset), o ninguna respuesta antes de que se cerrara la conexión en la capa de transporte.

A diferencia de un error 504 Gateway Timeout (donde el backend acepta la conexión pero tarda más de lo permitido en generar los bytes de respuesta), el error 502 suele ser síntoma de una interrupción prematura en la negociación del canal de comunicación: el proceso de destino está caído, el socket UNIX no existe o tiene permisos de lectura/escritura denegados, la cola de conexiones (`backlog`) se ha saturado por picos de tráfico, o el buffer de cabeceras de Nginx es insuficiente para almacenar la respuesta enviada por el upstream.

## Contexto de Arquitectura y Causa Raíz del Fallo

Para comprender la causa raíz de un código 502, es necesario examinar el flujo de datos entre la capa de red del sistema operativo y los procesos en espacio de usuario (*user space*):

1. **Ciclo de vida del socket y paquetes TCP:** Cuando Nginx recibe una solicitud HTTP en el puerto 80 o 443, consulta su bloque de configuración (`server` y `location`). Si la directiva `proxy_pass` o `fastcgi_pass` apunta a una dirección IP y puerto local (por ejemplo `http://127.0.0.1:3000`), el kernel ejecuta la llamada al sistema `connect()`. Si en ese puerto no hay ningún proceso escuchando con un socket en estado `LISTEN`, el kernel emite de inmediato un paquete TCP con el flag `RST` activado. Nginx intercepta este rechazo de conexión (`ECONNREFUSED`) e interrumpe la transacción generando el error 502 hacia el navegador.
2. **Sockets de Dominio UNIX (AF_UNIX) y Permisos POSIX:** En entornos PHP-FPM o Gunicorn donde la comunicación se optimiza prescindiendo del stack de red TCP/IP para usar sockets en disco (ej. `/run/php/php8.2-fpm.sock`), la comunicación depende de los permisos del sistema de archivos POSIX. Si el archivo de socket es propiedad del usuario `www-data` pero el proceso de Nginx corre bajo un usuario distinto (o carece de permisos de escritura `w` en el archivo o de ejecución `x` en los directorios superiores), la llamada al sistema devuelve `EACCES (Permission denied)`, culminando en un 502 inmediato.
3. **Colapso del worker por Out-Of-Memory (OOM Killer):** Si el proceso backend (como un worker de Node.js o un proceso hijo de PHP-FPM) agota la memoria RAM disponible o supera los límites de cgroups en Docker, el subsistema OOM Killer del kernel de Linux envía una señal `SIGKILL (kill -9)` fulminante al proceso. En ese instante exacto, la conexión TCP o el socket UNIX se cierra abruptamente mientras Nginx esperaba los encabezados HTTP, lo que genera en los logs de Nginx la alerta `upstream prematurely closed connection while reading response header from upstream`.
4. **Desbordamiento de cabeceras HTTP de respuesta:** Cuando el backend genera cookies de sesión de gran tamaño, tokens JWT extensos o cabeceras personalizadas que superan el tamaño por defecto de `proxy_buffer_size` (normalmente 4k u 8k según la arquitectura del sistema operativo), Nginx no puede almacenar la cabecera en memoria y aborta la transferencia marcándola como respuesta corrupta.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de modificar directivas de configuración o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Síntoma en Logs de Nginx | Capa Afectada | Causa Raíz Identificada | Acción Correctiva Inmediata |
|---|---|---|---|
| `connect() failed (111: Connection refused)` | Red / Proceso | El servicio backend (Node.js/Gunicorn/Docker) está detenido o escucha en otra interfaz | Iniciar el servicio o ajustar la directiva `proxy_pass` al puerto correcto |
| `connect() to ... failed (13: Permission denied)` | Sistema de Archivos POSIX | El proceso Nginx no tiene permisos para escribir en el socket UNIX `/run/php/...sock` | Ajustar `listen.owner`, `listen.group` y `listen.mode = 0660` en el pool del backend |
| `upstream prematurely closed connection` | Memoria / Proceso | El proceso backend colapsó por excepción no controlada o fue terminado por el OOM Killer | Auditar memoria con `dmesg -T` y revisar excepciones del framework backend |
| `upstream sent too big header while reading response header` | Buffers de Nginx | Las cabeceras HTTP del backend exceden el tamaño de buffer asignado en Nginx | Incrementar `proxy_buffer_size` y `proxy_buffers` en el bloque `location` |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar si el socket TCP del backend está realmente escuchando
sudo ss -tulpn | grep -E ':(3000|8000|8080|9000)'

# 2. Verificar permisos y existencia física del socket UNIX
ls -la /run/php/*.sock

# 3. Comprobar si el proceso de Nginx puede comunicarse directamente con el backend mediante HTTP
curl -Iv http://127.0.0.1:3000/
```

- El comando `ss` con los parámetros `-t` (sockets TCP), `-u` (UDP), `-l` (estado listening), `-p` (mostrar PID y nombre del programa) y `-n` (resolver numéricamente sin consultar DNS) te permite verificar si el puerto está efectivamente en escucha y cuál es el PID del proceso propietario.
- El comando `curl` con el flag `-I` (solicitar únicamente los encabezados HTTP mediante el método HEAD) y `-v` (modo verbose exhaustivo) permite aislar a Nginx y confirmar si el servidor backend responde directamente en la interfaz loopback.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería para aislar y resolver definitivamente la causa raíz del fallo 502:

### Paso 1: Comprobar y restablecer el ciclo de vida del servicio backend

Verifica el estado del demonio responsable de procesar el código de la aplicación. Utiliza el comando correspondiente a tu entorno tecnológico:

```bash
# Para aplicaciones basadas en PHP-FPM
sudo systemctl status php8.2-fpm -l --no-pager

# Para aplicaciones Node.js gestionadas mediante PM2
pm2 status

# Para servicios desplegados en contenedores Docker
docker ps --filter "status=running"
```

El parámetro `-l` (`--full`) en `systemctl` evita truncar las líneas de salida del log en la terminal, mientras que `--no-pager` vuelca la salida directamente al flujo de texto estándar (`stdout`), permitiendo leer los últimos mensajes de fallo del servicio sin bloquear la pantalla interactiva.

Si el servicio aparece con estado `inactive (dead)` o `failed`, arráncalo e inspecciona que no falle al iniciar:

```bash
sudo systemctl restart php8.2-fpm
```

### Paso 2: Corregir la definición de Upstream y permisos en la configuración de Nginx

Accede al bloque de configuración del sitio web (generalmente ubicado en `/etc/nginx/sites-available/` o `/etc/nginx/conf.d/`):

```bash
sudo nano /etc/nginx/sites-available/misitio.conf
```

Asegúrate de que la directiva de enrutamiento apunte exactamente al medio de transporte activo:

```nginx
# Opción A: Comunicación mediante Socket UNIX (Recomendado para PHP-FPM en el mismo host)
location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
    
    # Prevenir timeouts en scripts de larga duración
    fastcgi_connect_timeout 60s;
    fastcgi_send_timeout 180s;
    fastcgi_read_timeout 180s;
    fastcgi_buffer_size 128k;
    fastcgi_buffers 4 256k;
}

# Opción B: Comunicación mediante Proxy Inverso TCP (Node.js, Python, Go, Docker)
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    
    # Preservar encabezados del cliente para el backend
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Dimensionamiento de buffers para evitar errores 502 por cabeceras grandes
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
}
```

- `proxy_http_version 1.1`: Habilita HTTP/1.1 para permitir conexiones persistentes (*keep-alive*) entre Nginx y el backend, reduciendo la latencia y la saturación de sockets en el kernel.
- `proxy_set_header Host $host`: Garantiza que el backend conozca el nombre de dominio real solicitado por el cliente y no la dirección local `127.0.0.1`.
- `proxy_buffer_size 128k`: Asigna un bloque de memoria suficiente para almacenar las cabeceras de respuesta que envía el backend, erradicando el fallo por desbordamiento de headers.

### Paso 3: Alinear permisos de usuario entre Nginx y el pool del backend

Si utilizas sockets UNIX y el registro de Nginx reporta `13: Permission denied`, edita el archivo de configuración del pool del backend (por ejemplo `/etc/php/8.2/fpm/pool.d/www.conf`):

```ini
; Configurar el propietario del socket para coincidir con el usuario de Nginx
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
```

Tras modificar la directiva, reinicia el demonio del pool:

```bash
sudo systemctl restart php8.2-fpm
```

### Paso 4: Validar la sintaxis y recargar Nginx con cero tiempo de inactividad

Antes de aplicar los cambios en un servidor en producción, valida siempre la integridad semántica de la configuración con el flag `-t`:

```bash
sudo nginx -t
```

El parámetro `-t` comprueba la sintaxis de todos los archivos incluidos y verifica la accesibilidad de los directorios referenciados sin interrumpir el tráfico activo. Si la consola confirma `syntax is ok` y `test is successful`, envía una señal `SIGHUP` al proceso maestro mediante un reload grácil:

```bash
sudo systemctl reload nginx
```

El comando `reload` no detiene los procesos worker existentes que atienden solicitudes en curso; en su lugar, levanta nuevos workers con la nueva configuración y retira de forma ordenada a los anteriores una vez completadas las transacciones pendientes.

## Casos Borde (Troubleshooting) y Prácticas en Producción

### Caso Borde 1: Bloqueo silencioso por políticas de SELinux (RHEL, AlmaLinux, Rocky Linux, CentOS)

En distribuciones con SELinux en modo `Enforcing`, Nginx tiene restringida por defecto la capacidad de iniciar conexiones de red salientes hacia puertos TCP no estándar o hacia la interfaz loopback. Esto provoca un error 502 aunque el servicio backend esté corriendo perfectamente en el puerto 3000.

Para verificar si SELinux está bloqueando la comunicación:

```bash
# Inspeccionar denegaciones de SELinux en el log de auditoría
sudo ausearch -m avc -ts recent | grep nginx

# Consultar el estado del booleano de conexión de red para servidores web
getsebool httpd_can_network_connect
```

Si el booleano está desactivado (`off`), actívalo de forma permanente con el flag `-P` (persistent):

```bash
sudo setsebool -P httpd_can_network_connect 1
```

### Caso Borde 2: Asignación de nombres de servicio en redes Docker (DNS interno no resuelto)

Cuando Nginx corre en un contenedor Docker y el backend corre en otro, configurar `proxy_pass http://localhost:3000;` provocará un error 502 inmediato, ya que `localhost` dentro de un contenedor hace referencia a la interfaz de red del propio contenedor de Nginx. 

La solución requiere crear una red puente definida por el usuario (*user-defined bridge network*) y referenciar el backend por el nombre de su servicio en Docker:

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    networks:
      - app-network
  api:
    image: node:20-alpine
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

En la configuración de Nginx, la directiva debe ser `proxy_pass http://api:3000;`. Si la IP del contenedor backend puede cambiar dinámicamente, añade la directiva `resolver 127.0.0.11 valid=10s;` (la IP del DNS interno de Docker) para evitar que Nginx conserve una IP obsoleta en caché.

### Verificación de Logs en Tiempo Real y Cierre de Incidencia

Una vez aplicadas las correcciones, audita los registros en tiempo real ejecutando:

```bash
# Monitorear logs de error de Nginx filtrando códigos de retorno del upstream
sudo tail -n 100 -f /var/log/nginx/error.log | grep -E "(upstream|connect\(\)|recv\(\))"

# Realizar una prueba de estrés ligera para confirmar estabilidad del backend
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://midominio.com/; done
```

El bucle de prueba envía 20 peticiones consecutivas e imprime únicamente el código HTTP devuelto (`%{http_code}`). Si todas las peticiones retornan `200` y el archivo `error.log` permanece en silencio sin trazas de `connect() failed`, la arquitectura de proxy inverso queda validada y blindada para tráfico en producción.
