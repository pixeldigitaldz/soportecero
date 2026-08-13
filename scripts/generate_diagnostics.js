import fs from 'fs';
import path from 'path';

const POSTS_ES_DIR = './content/posts';
const POSTS_EN_DIR = './content/posts/en';

// Master data mapping for diagnostic tables in both Spanish and English for every article slug
const DIAGNOSTICS_MAP = {
  "activar-optiscaler-juegos-pc": {
    es: [
      { cause: "**Falta DLL de OptiScaler o Wine/Proton no configurado**", solution: "Instalar `dxgi.dll` de OptiScaler en la carpeta del ejecutable (`.exe`)" },
      { cause: "**Variable de entorno NVAPI inactiva en Linux**", solution: "Agregar `DXVK_ENABLE_NVAPI=1 %command%` en los parámetros de Steam" }
    ],
    en: [
      { cause: "**Missing OptiScaler DLL or Wine/Proton not configured**", solution: "Install OptiScaler `dxgi.dll` in the executable (`.exe`) folder" },
      { cause: "**Inactive NVAPI environment variable in Linux**", solution: "Add `DXVK_ENABLE_NVAPI=1 %command%` in Steam launch options" }
    ]
  },
  "automatizar-respaldos-tar-cron": {
    es: [
      { cause: "**Cronjob no ejecuta por rutas relativas o variables de entorno**", solution: "Especificar rutas absolutas en el script (`/bin/tar`, `/usr/bin/crontab`)" },
      { cause: "**Permisos insuficientes en el directorio de destino**", solution: "Asegurar permisos de escritura con `chmod 755` o ejecutar cron como root" }
    ],
    en: [
      { cause: "**Cronjob failing due to relative paths or environment variables**", solution: "Specify absolute paths in script (`/bin/tar`, `/usr/bin/crontab`)" },
      { cause: "**Insufficient write permissions in destination directory**", solution: "Ensure write permissions with `chmod 755` or run cron as root" }
    ]
  },
  "caida-fps-drivers-video": {
    es: [
      { cause: "**Controladores GPU desactualizados o corruptos**", solution: "Realizar una instalación limpia de drivers Mesa/Nvidia con `DDU` o `pacman -Syu`" },
      { cause: "**Perfil de energía del sistema en modo Ahorro**", solution: "Cambiar el regulador de CPU a alto rendimiento: `powerprofilesctl set performance`" }
    ],
    en: [
      { cause: "**Outdated or corrupted GPU graphics drivers**", solution: "Perform clean Mesa/Nvidia driver install via `DDU` or `pacman -Syu`" },
      { cause: "**System power profile set to Power Saver mode**", solution: "Set CPU governor to performance: `powerprofilesctl set performance`" }
    ]
  },
  "caida-fps-proton-ge-wow": {
    es: [
      { cause: "**Caché de Shaders DXVK corrupta o saturada**", solution: "Borrar la carpeta `shadercache` en la prefix del juego en Steam/Lutris" },
      { cause: "**Versión de Proton-GE incompatible con el parche de WoW**", solution: "Actualizar a la versión más reciente de Proton-GE mediante GE-Protonup" }
    ],
    en: [
      { cause: "**Corrupted or saturated DXVK Shader Cache**", solution: "Delete the `shadercache` folder in game prefix on Steam/Lutris" },
      { cause: "**Proton-GE version incompatible with latest WoW patch**", solution: "Update to latest Proton-GE release via ProtonUp-Qt" }
    ]
  },
  "caida-velocidad-red-mtu-linux": {
    es: [
      { cause: "**MTU mal configurado causando fragmentación de paquetes**", solution: "Ajustar el MTU a 1500 (o 1492 para PPPoE) con `ip link set dev eth0 mtu 1500`" },
      { cause: "**Negociación de velocidad de red (Auto-Negotiation) fallida**", solution: "Forzar velocidad Gigabit con `ethtool -s eth0 speed 1000 duplex full autoneg on`" }
    ],
    en: [
      { cause: "**Misconfigured MTU causing packet fragmentation**", solution: "Set MTU to 1500 (or 1492 for PPPoE): `ip link set dev eth0 mtu 1500`" },
      { cause: "**Failed network speed auto-negotiation**", solution: "Force Gigabit speed: `ethtool -s eth0 speed 1000 duplex full autoneg on`" }
    ]
  },
  "configurar-active-cooler-raspberry": {
    es: [
      { cause: "**Overlay de control PWM del ventilador no activado en config.txt**", solution: "Agregar `dtparam=fan_temp0=60000` en `/boot/firmware/config.txt`" },
      { cause: "**Servicio de monitoreo térmico inactivo**", solution: "Reorganizar los umbrales térmicos en `raspi-config` o verificar la conexión JST" }
    ],
    en: [
      { cause: "**PWM fan control overlay not enabled in config.txt**", solution: "Add `dtparam=fan_temp0=60000` in `/boot/firmware/config.txt`" },
      { cause: "**Thermal monitoring service inactive**", solution: "Adjust thermal thresholds in `raspi-config` or check JST connector" }
    ]
  },
  "crasheo-memoria-swap-linux": {
    es: [
      { cause: "**Memoria RAM y espacio Swap totalmente agotados (OOM Killer)**", solution: "Crear un archivo swap adicional con `fallocate -l 4G /swapfile && mkswap /swapfile`" },
      { cause: "**Parámetro vm.swappiness desconfigurado**", solution: "Ajustar swappiness a un valor equilibrado (10-30): `sysctl vm.swappiness=20`" }
    ],
    en: [
      { cause: "**RAM and Swap space completely exhausted (OOM Killer)**", solution: "Create extra swap file: `fallocate -l 4G /swapfile && mkswap /swapfile`" },
      { cause: "**Misconfigured vm.swappiness parameter**", solution: "Set balanced swappiness (10-30): `sysctl vm.swappiness=20`" }
    ]
  },
  "crasheo-texturas-diablo4-proton": {
    es: [
      { cause: "**Insuficiente memoria VRAM o fragmentación VKD3D**", solution: "Bajar la calidad de texturas a Media y activar `VKD3D_CONFIG=single_queue`" },
      { cause: "**Límite de descriptores de archivos insuficiente (esync/fsync)**", solution: "Aumentar `ulimit -n 1048576` en `/etc/security/limits.conf`" }
    ],
    en: [
      { cause: "**Insufficient VRAM memory or VKD3D fragmentation**", solution: "Lower texture quality to Medium and set `VKD3D_CONFIG=single_queue`" },
      { cause: "**Insufficient open file descriptors limit (esync/fsync)**", solution: "Increase `ulimit -n 1048576` in `/etc/security/limits.conf`" }
    ]
  },
  "docker-space-clean-cache": {
    es: [
      { cause: "**Imágenes, contenedores parados y volúmenes huérfanos acumulados**", solution: "Ejecutar limpieza profunda: `docker system prune -a --volumes -f`" },
      { cause: "**Archivos de logs JSON de contenedores creciendo indefinidamente**", solution: "Vaciar los logs acumulados: `truncate -s 0 /var/lib/docker/containers/*/*-json.log`" }
    ],
    en: [
      { cause: "**Accumulated unused images, stopped containers, and orphaned volumes**", solution: "Run deep purge: `docker system prune -a --volumes -f`" },
      { cause: "**Container JSON log files growing indefinitely**", solution: "Truncate logs: `truncate -s 0 /var/lib/docker/containers/*/*-json.log`" }
    ]
  },
  "error-403-forbidden-nginx-docker": {
    es: [
      { cause: "**Permisos del sistema de archivos local en el volumen montado**", solution: "Ajustar permisos locales: `chmod -R 755` en carpetas y `644` en archivos" },
      { cause: "**Falta de archivo de inicio index (index.html / index.php)**", solution: "Verificar concordancia de mayúsculas/minúsculas en el archivo raíz" }
    ],
    en: [
      { cause: "**Restricted local filesystem permissions on mounted volume**", solution: "Set local permissions: `chmod -R 755` on dirs and `644` on files" },
      { cause: "**Missing index entrypoint file (index.html / index.php)**", solution: "Verify casing match on root index file" }
    ]
  },
  "error-audio-hdmi-pipewire": {
    es: [
      { cause: "**Perfil de salida HDMI desactivado o deshabilitado en WirePlumber**", solution: "Seleccionar el perfil HDMI adecuado mediante `pavucontrol` o `wpctl`" },
      { cause: "**Frecuencia de muestreo (sample rate) incompatible con el receptor**", solution: "Configurar `default.clock.rate = 48000` en `/etc/pipewire/pipewire.conf`" }
    ],
    en: [
      { cause: "**HDMI output profile disabled or unselected in WirePlumber**", solution: "Select proper HDMI output profile via `pavucontrol` or `wpctl`" },
      { cause: "**Incompatible sample rate with audio receiver**", solution: "Set `default.clock.rate = 48000` in `/etc/pipewire/pipewire.conf`" }
    ]
  },
  "error-audio-proton-warframe": {
    es: [
      { cause: "**Controlador de audio FAudio o XAudio2 desincronizado en Proton**", solution: "Instalar librerías de sonido mediante `protontricks 230410 xact`" },
      { cause: "**Latencia de búfer de audio muy baja en PipeWire/PulseAudio**", solution: "Establecer la variable de entorno `PULSE_LATENCY_MSEC=60 %command%`" }
    ],
    en: [
      { cause: "**Desynchronized FAudio or XAudio2 driver in Proton**", solution: "Install audio DLLs via `protontricks 230410 xact`" },
      { cause: "**Low audio buffer latency in PipeWire/PulseAudio**", solution: "Set environment variable `PULSE_LATENCY_MSEC=60 %command%`" }
    ]
  },
  "error-bad-gateway-502-nginx-upstream": {
    es: [
      { cause: "**Servicio de aplicación (PHP-FPM, Node.js, Gunicorn) fuera de servicio**", solution: "Verificar e iniciar el servicio backend con `systemctl status php-fpm` o Docker" },
      { cause: "**Puerto o socket UNIX mal configurado en la directiva proxy_pass**", solution: "Corregir la ruta del socket `/var/run/php/php-fpm.sock` o puerto en `nginx.conf`" }
    ],
    en: [
      { cause: "**Application backend service (PHP-FPM, Node.js, Gunicorn) is down**", solution: "Check and start backend service with `systemctl status php-fpm` or Docker" },
      { cause: "**Misconfigured port or UNIX socket in proxy_pass directive**", solution: "Fix socket path `/var/run/php/php-fpm.sock` or port in `nginx.conf`" }
    ]
  },
  "error-btrfs-read-only-umbrel": {
    es: [
      { cause: "**Errores en el sistema de archivos Btrfs por corte de energía inesperado**", solution: "Verificar el log de kernel `dmesg` y ejecutar `btrfs check --repair /dev/sdX`" },
      { cause: "**Unidad de almacenamiento dañada o en modo de protección contra fallas**", solution: "Remontar la unidad en modo lectura/escritura: `mount -o remount,rw /data`" }
    ],
    en: [
      { cause: "**Btrfs filesystem errors caused by unexpected power loss**", solution: "Check kernel log `dmesg` and run `btrfs check --repair /dev/sdX`" },
      { cause: "**Storage drive damaged or switched to read-only fail-safe mode**", solution: "Remount drive read/write: `mount -o remount,rw /data`" }
    ]
  },
  "error-certbot-failed-authorization-procedure-http-01": {
    es: [
      { cause: "**Puerto 80 bloqueado por firewall o servidor web mal configurado**", solution: "Abrir el puerto 80 en el firewall: `ufw allow 80/tcp`" },
      { cause: "**Ruta del desafío .well-known/acme-challenge inaccesible**", solution: "Verificar que el directorio raíz `root` coincida exactamente en Nginx/Apache" }
    ],
    en: [
      { cause: "**Port 80 blocked by firewall or misconfigured web server**", solution: "Open port 80 in firewall: `ufw allow 80/tcp`" },
      { cause: "**Inaccessible .well-known/acme-challenge validation path**", solution: "Ensure web root directory matches Nginx/Apache configuration block" }
    ]
  },
  "error-cloudflare-521-web-server-is-down": {
    es: [
      { cause: "**Servidor web de origen apagado o caído**", solution: "Iniciar el servidor web local (Nginx/Apache): `systemctl restart nginx`" },
      { cause: "**Firewall del servidor bloqueando las IPs de Cloudflare**", solution: "Agregar el rango de IPs oficiales de Cloudflare a la lista blanca del firewall" }
    ],
    en: [
      { cause: "**Origin web server down or stopped**", solution: "Start local web server (Nginx/Apache): `systemctl restart nginx`" },
      { cause: "**Server firewall blocking Cloudflare IP ranges**", solution: "Whitelist official Cloudflare IP ranges in server firewall" }
    ]
  },
  "error-conexion-prowlarr-qbittorrent-docker": {
    es: [
      { cause: "**Nombre de host de red de Docker no alcanzable entre contenedores**", solution: "Conectar ambos contenedores a la misma red bridge de Docker (`docker network connect`)" },
      { cause: "**API Key o credenciales de autenticación qBittorrent incorrectas**", solution: "Desactivar la protección CSRF en qBittorrent o verificar el puerto web UI (8080)" }
    ],
    en: [
      { cause: "**Docker network hostname unreachable between containers**", solution: "Connect both containers to same Docker bridge network" },
      { cause: "**Incorrect qBittorrent API key or authentication credentials**", solution: "Disable CSRF protection in qBittorrent or verify web UI port (8080)" }
    ]
  },
  "error-cors-shopify-liquid": {
    es: [
      { cause: "**Encabezado Access-Control-Allow-Origin ausente en peticiones de API**", solution: "Configurar el encabezado `Access-Control-Allow-Origin: *` en el servidor de destino" },
      { cause: "**Petición fetch realizada desde un subdominio o protocolo distinto (HTTP vs HTTPS)**", solution: "Asegurar que todas las peticiones utilicen HTTPS y la misma URL base" }
    ],
    en: [
      { cause: "**Missing Access-Control-Allow-Origin header in API requests**", solution: "Set `Access-Control-Allow-Origin: *` header on origin server" },
      { cause: "**Fetch request originated from different subdomain or protocol (HTTP vs HTTPS)**", solution: "Ensure all fetch calls use HTTPS and identical base URL" }
    ]
  },
  "error-cors": {
    es: [
      { cause: "**Falta de política CORS en el servidor backend**", solution: "Agregar middleware CORS en backend (ej. `app.use(cors())` en Express)" },
      { cause: "**Peticiones preflight (OPTIONS) rechazadas por falta de encabezados permitidos**", solution: "Permitir los métodos `GET, POST, PUT, DELETE` y encabezados `Content-Type, Authorization`" }
    ],
    en: [
      { cause: "**Missing CORS policy on the backend server**", solution: "Add CORS middleware to backend (e.g. `app.use(cors())` in Express)" },
      { cause: "**Preflight (OPTIONS) requests rejected due to missing allowed headers**", solution: "Allow `GET, POST, PUT, DELETE` methods and `Content-Type, Authorization` headers" }
    ]
  },
  "error-cron-job-not-running": {
    es: [
      { cause: "**Servicio de cron deshabilitado o detenido**", solution: "Iniciar el demonio de cron: `systemctl enable --now cron` (o `crond`)" },
      { cause: "**Falta de salto de línea al final del archivo crontab o rutas relativas**", solution: "Usar siempre rutas absolutas para comandos y ejecutables en la sintaxis de cron" }
    ],
    en: [
      { cause: "**Cron daemon service disabled or stopped**", solution: "Start cron daemon: `systemctl enable --now cron` (or `crond`)" },
      { cause: "**Missing trailing newline in crontab file or relative paths used**", solution: "Use absolute paths for all commands and executables in crontab" }
    ]
  },
  "error-curl-7-failed-to-connect-to-localhost-port": {
    es: [
      { cause: "**El servicio en el puerto especificado no está escuchando peticiones**", solution: "Verificar puertos abiertos en la máquina: `netstat -tulnp | grep puerto`" },
      { cause: "**Contenedor Docker escuchando solo en 127.0.0.1 dentro del contenedor**", solution: "Vincular el servicio a `0.0.0.0` para recibir tráfico externo" }
    ],
    en: [
      { cause: "**Service on the specified port is not listening**", solution: "Verify listening ports: `netstat -tulnp | grep port`" },
      { cause: "**Docker container binding exclusively to 127.0.0.1 inside container**", solution: "Bind service to `0.0.0.0` to accept external traffic" }
    ]
  },
  "error-direct3d": {
    es: [
      { cause: "**D3DCompiler o librerías de DirectX 11/12 ausentes o corruptas**", solution: "Reinstalar el instalador ejecutable de DirectX End-User Runtimes" },
      { cause: "**Compatibilidad de Proton/Wine desactualizada en Linux**", solution: "Activar `DXVK_ASYNC=1` o utilizar Proton Experimental / Proton-GE" }
    ],
    en: [
      { cause: "**Missing or corrupted D3DCompiler / DirectX 11/12 runtime libraries**", solution: "Reinstall DirectX End-User Runtimes installer" },
      { cause: "**Outdated Proton/Wine compatibility layer in Linux**", solution: "Set `DXVK_ASYNC=1` or use Proton Experimental / Proton-GE" }
    ]
  },
  "error-directx-midnight-wow": {
    es: [
      { cause: "**Incompatibilidad de la API DirectX 12 con la versión de controladores GPU**", solution: "Cambiar la API gráfica del juego a DirectX 11 mediante el archivo `Config.wtf`" },
      { cause: "**Overlay de terceros (Discord, GeForce Experience, MangoHud) interfiriendo**", solution: "Desactivar overlays de pantalla durante la ejecución del cliente" }
    ],
    en: [
      { cause: "**DirectX 12 API incompatibility with current GPU driver version**", solution: "Switch in-game graphics API to DirectX 11 via `Config.wtf` file" },
      { cause: "**Third-party overlay (Discord, GeForce Experience, MangoHud) conflict**", solution: "Disable third-party screen overlays before launching client" }
    ]
  },
  "error-disk-space-full-lvm-resize": {
    es: [
      { cause: "**Volumen Lógico (LV) sin espacio libre pero con espacio disponible en Volume Group (VG)**", solution: "Extender el volumen lógico: `lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv`" },
      { cause: "**Sistema de archivos no redimensionado tras extender el volumen**", solution: "Redimensionar el sistema de archivos ext4 o xfs con `resize2fs` o `xfs_growfs`" }
    ],
    en: [
      { cause: "**Logical Volume (LV) full while Volume Group (VG) has free space**", solution: "Extend logical volume: `lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv`" },
      { cause: "**Filesystem not expanded after extending the logical volume**", solution: "Resize ext4/xfs filesystem using `resize2fs` or `xfs_growfs`" }
    ]
  },
  "error-dns-probe-finished-nxdomain": {
    es: [
      { cause: "**Servidores DNS del sistema o proveedor desactualizados o inaccesibles**", solution: "Cambiar los DNS a los de Cloudflare (1.1.1.1) o Google (8.8.8.8)" },
      { cause: "**Caché DNS del sistema operativo local corrupta**", solution: "Vaciar la caché de DNS: `resolvectl flush-caches` (Linux) o `ipconfig /flushdns`" }
    ],
    en: [
      { cause: "**Outdated or unreachable system/ISP DNS servers**", solution: "Change DNS servers to Cloudflare (1.1.1.1) or Google (8.8.8.8)" },
      { cause: "**Corrupted local OS DNS resolver cache**", solution: "Flush DNS cache: `resolvectl flush-caches` (Linux) or `ipconfig /flushdns`" }
    ]
  },
  "error-docker-dns-umbrel": {
    es: [
      { cause: "**El servicio DNS interno de Docker no resuelve nombres en Umbrel OS**", solution: "Agregar DNS públicos en `/etc/docker/daemon.json` (ej. `\"dns\": [\"1.1.1.1\"]`)" },
      { cause: "**Conflicto con systemd-resolved escuchando en el puerto 53**", solution: "Configurar `DNSStubListener=no` en `/etc/systemd/resolved.conf`" }
    ],
    en: [
      { cause: "**Internal Docker DNS resolver failing on Umbrel OS**", solution: "Set public DNS in `/etc/docker/daemon.json` (e.g. `\"dns\": [\"1.1.1.1\"]`)" },
      { cause: "**Port 53 conflict with systemd-resolved service**", solution: "Set `DNSStubListener=no` in `/etc/systemd/resolved.conf`" }
    ]
  },
  "error-docker-failed-to-compute-cache-key": {
    es: [
      { cause: "**Ruta de origen especificada en el comando COPY/ADD del Dockerfile no existe**", solution: "Verificar la ruta exacta en la estructura de archivos local y el archivo `.dockerignore`" },
      { cause: "**Contexto de compilación de Docker apuntando a una carpeta incorrecta**", solution: "Ejecutar el comando `docker build` asegurando la sintaxis `.` al final del comando" }
    ],
    en: [
      { cause: "**Source path in Dockerfile COPY/ADD instruction does not exist**", solution: "Verify exact local file path and check `.dockerignore` file" },
      { cause: "**Docker build context pointing to incorrect working directory**", solution: "Run `docker build` ensuring proper trailing `.` context syntax" }
    ]
  },
  "error-docker-invalid-reference-format": {
    es: [
      { cause: "**Error sintáctico en el nombre de la imagen o banderas del comando docker run**", solution: "Asegurar que el tag de la imagen esté en minúsculas y sin caracteres no válidos" },
      { cause: "**Rutas de volúmenes con espacios sin comillas en la sintaxis del comando**", solution: "Encerrar las rutas entre comillas dobles: `-v \"/ruta local:/ruta contenedor\"`" }
    ],
    en: [
      { cause: "**Syntax error in image name or flags of docker run command**", solution: "Ensure image tag is lowercase and free of illegal characters" },
      { cause: "**Unquoted volume mount paths containing spaces**", solution: "Enclose paths in quotes: `-v \"/local path:/container path\"`" }
    ]
  },
  "error-dockge-permisos-volumen": {
    es: [
      { cause: "**Permisos del sistema de archivos bloqueando el acceso al directorio /data/stacks**", solution: "Asignar la propiedad correcta de la carpeta: `sudo chown -R 1000:1000 /data/stacks`" },
      { cause: "**UID/GID del usuario del contenedor no coincide con el host Linux**", solution: "Ajustar la variable de entorno `PUID` y `PGID` en el archivo `compose.yaml`" }
    ],
    en: [
      { cause: "**Filesystem permissions blocking access to /data/stacks directory**", solution: "Assign proper directory ownership: `sudo chown -R 1000:1000 /data/stacks`" },
      { cause: "**Container user UID/GID mismatch with Linux host**", solution: "Set `PUID` and `PGID` environment variables in `compose.yaml`" }
    ]
  },
  "error-firebase-reglas": {
    es: [
      { cause: "**Reglas de seguridad de Firestore/Storage bloqueando peticiones (Permission Denied)**", solution: "Revisar y actualizar las reglas en la consola de Firebase o archivo `firestore.rules`" },
      { cause: "**Petición enviada sin token de autenticación válido**", solution: "Asegurar que el usuario esté autenticado (`request.auth != null`)" }
    ],
    en: [
      { cause: "**Firestore/Storage security rules blocking requests (Permission Denied)**", solution: "Review and update rules in Firebase Console or `firestore.rules` file" },
      { cause: "**Request sent without a valid authentication token**", solution: "Ensure user is authenticated (`request.auth != null`)" }
    ]
  },
  "error-firmas-pgp-pacman-cachyos": {
    es: [
      { cause: "**Claves PGP del llavero de pacman expiradas o desactualizadas en Arch/CachyOS**", solution: "Actualizar el keyring de pacman: `sudo pacman -Sy cachyos-keyring archlinux-keyring`" },
      { cause: "**Base de datos de firmas de repositorios corrupta**", solution: "Reiniciar el llavero de llaves gpg: `sudo rm -rf /etc/pacman.d/gnupg && sudo pacman-key --init`" }
    ],
    en: [
      { cause: "**Expired or outdated PGP keys in pacman keyring on Arch/CachyOS**", solution: "Update pacman keyring: `sudo pacman -Sy cachyos-keyring archlinux-keyring`" },
      { cause: "**Corrupted repository PGP signatures database**", solution: "Reinitialize GPG keyring: `sudo rm -rf /etc/pacman.d/gnupg && sudo pacman-key --init`" }
    ]
  },
  "error-flare-solverr-cloudflare": {
    es: [
      { cause: "**FlareSolverr bloqueado por cambios recientes de protección Turnstile de Cloudflare**", solution: "Actualizar el contenedor FlareSolverr a la última versión disponible en Docker Hub" },
      { cause: "**Timeout de respuesta al resolver el reto JS debido a falta de recursos**", solution: "Aumentar el valor de `RESOURCE_TIMEOUT` a 60000ms en las variables de entorno" }
    ],
    en: [
      { cause: "**FlareSolverr blocked by Cloudflare Turnstile protection updates**", solution: "Update FlareSolverr container image to latest tag from Docker Hub" },
      { cause: "**Response timeout while solving JS challenge due to resource limits**", solution: "Increase `RESOURCE_TIMEOUT` to 60000ms in environment variables" }
    ]
  },
  "error-git-corrupt-loose-object": {
    es: [
      { cause: "**Objeto suelto de Git corrupto por apagón brusco o fallo en disco**", solution: "Identificar y eliminar el objeto dañado en `.git/objects/` y restaurar con `git fetch`" },
      { cause: "**Referencia de rama apuntando a un commit inexistente**", solution: "Ejecutar `git fsck --full` para localizar el objeto corrupto exacto" }
    ],
    en: [
      { cause: "**Corrupted loose Git object caused by sudden power loss or disk failure**", solution: "Identify and delete corrupted object in `.git/objects/` and `git fetch`" },
      { cause: "**Branch ref pointing to a non-existent commit object**", solution: "Run `git fsck --full` to locate exact damaged object" }
    ]
  },
  "error-git-fatal-cannot-lock-ref-head": {
    es: [
      { cause: "**Archivo de bloqueo de referencia de Git acumulado (.git/refs/heads/X.lock)**", solution: "Eliminar el archivo lock sobrante con `rm -f .git/refs/heads/nombre-rama.lock`" },
      { cause: "**Múltiples procesos de Git ejecutándose simultáneamente**", solution: "Finalizar otros procesos activos de Git o IDEs antes de reintentar el comando" }
    ],
    en: [
      { cause: "**Stale Git ref lock file present (.git/refs/heads/X.lock)**", solution: "Remove leftover lock file: `rm -f .git/refs/heads/branch-name.lock`" },
      { cause: "**Multiple concurrent Git processes running simultaneously**", solution: "Kill other active Git processes or IDE locks before retrying" }
    ]
  },
  "error-git-fatal-rebase-in-progress": {
    es: [
      { cause: "**Operación de Rebase pendiente o interrumpida por conflictos**", solution: "Resolver conflictos y continuar con `git rebase --continue` o abortar con `git rebase --abort`" },
      { cause: "**Carpeta temporal .git/rebase-merge bloqueando nuevos comandos**", solution: "Cancelar la operación rebase actual para restaurar el estado limpio del árbol" }
    ],
    en: [
      { cause: "**Pending or interrupted Rebase operation due to merge conflicts**", solution: "Resolve conflicts and run `git rebase --continue` or abort with `git rebase --abort`" },
      { cause: "**Stale .git/rebase-merge directory blocking new commands**", solution: "Abort pending rebase operation to restore clean working tree" }
    ]
  },
  "error-git-fatal-refusing-to-merge-unrelated-histories": {
    es: [
      { cause: "**Intentando fusionar dos repositorios o ramas con historiales de commits no conectados**", solution: "Permitir la fusión forzada usando la bandera `--allow-unrelated-histories`" },
      { cause: "**Repositorio remoto inicializado con archivos (README/LICENSE) de forma independiente**", solution: "Ejecutar `git pull origin main --allow-unrelated-histories`" }
    ],
    en: [
      { cause: "**Attempting to merge two branches/repositories with unrelated commit histories**", solution: "Allow forced merge using `--allow-unrelated-histories` flag" },
      { cause: "**Remote repository initialized independently with README/LICENSE files**", solution: "Execute `git pull origin main --allow-unrelated-histories`" }
    ]
  },
  "error-git-merge-conflict-fix": {
    es: [
      { cause: "**Modificaciones paralelas en las mismas líneas del mismo archivo entre ramas**", solution: "Editar el archivo, eliminar las marcas `<<<<<<<`, `=======`, `>>>>>>>` y hacer commit" },
      { cause: "**Fusión automática abortada por cambios locales no confirmados**", solution: "Guardar los cambios temporalmente en el Stash: `git stash` antes de hacer el merge" }
    ],
    en: [
      { cause: "**Parallel edits on identical lines across branches**", solution: "Edit file, remove `<<<<<<<`, `=======`, `>>>>>>>` conflict markers and commit" },
      { cause: "**Automatic merge aborted due to uncommitted local changes**", solution: "Stash local changes: `git stash` before executing merge" }
    ]
  },
  "error-invalid-fstab-linux": {
    es: [
      { cause: "**Sintaxis incorrecta o UUID inexistente en el archivo /etc/fstab**", solution: "Iniciar en modo rescate y corregir la línea defectuosa en `/etc/fstab`" },
      { cause: "**Partición no disponible en el arranque impidiendo iniciar el sistema**", solution: "Agregar la opción `nofail` a la partición secundaria en el archivo `/etc/fstab`" }
    ],
    en: [
      { cause: "**Incorrect syntax or invalid UUID in /etc/fstab file**", solution: "Boot into rescue mode and fix broken entry in `/etc/fstab`" },
      { cause: "**Unavailable partition at boot preventing system startup**", solution: "Add `nofail` option to secondary partition in `/etc/fstab`" }
    ]
  },
  "error-invalid-token-binance": {
    es: [
      { cause: "**API Key o Secret Key de Binance expirada, mal copiada o con IP no autorizada**", solution: "Generar una nueva clave API en Binance y registrar la dirección IP estática de tu servidor" },
      { cause: "**Desincronización de hora del sistema local con el reloj del servidor de Binance**", solution: "Sincronizar el reloj del servidor con NTP: `sudo ntpdate pool.ntp.org`" }
    ],
    en: [
      { cause: "**Binance API Key/Secret expired, copied incorrectly, or IP not whitelisted**", solution: "Generate new Binance API Key and whitelist server static IP" },
      { cause: "**Local system clock out of sync with Binance server time**", solution: "Sync server clock with NTP: `sudo ntpdate pool.ntp.org`" }
    ]
  },
  "error-mongodb-connect-econnrefused-127-0-0-1-27017": {
    es: [
      { cause: "**Servidor MongoDB (mongod) no está en ejecución**", solution: "Iniciar el servicio de base de datos: `sudo systemctl start mongod`" },
      { cause: "**MongoDB escuchando solo en la interfaz local o puerto cambiado**", solution: "Ajustar la directiva `bindIp: 0.0.0.0` en `/etc/mongod.conf` si se requiere acceso remoto" }
    ],
    en: [
      { cause: "**MongoDB server daemon (mongod) is not running**", solution: "Start database service: `sudo systemctl start mongod`" },
      { cause: "**MongoDB binding exclusively to localhost or non-default port**", solution: "Set `bindIp: 0.0.0.0` in `/etc/mongod.conf` if remote access is required" }
    ]
  },
  "error-mysql-too-many-connections": {
    es: [
      { cause: "**Límite de conexiones simultáneas max_connections alcanzado en MySQL/MariaDB**", solution: "Aumentar temporalmente el límite: `SET GLOBAL max_connections = 500;`" },
      { cause: "**Conexiones persistentes colgadas o no cerradas por la aplicación**", solution: "Ajustar `max_connections = 500` en `/etc/mysql/my.cnf` y reiniciar el servicio" }
    ],
    en: [
      { cause: "**Reached max_connections limit in MySQL/MariaDB**", solution: "Temporarily increase limit: `SET GLOBAL max_connections = 500;`" },
      { cause: "**Hanging persistent connections not closed by the application**", solution: "Set `max_connections = 500` in `/etc/mysql/my.cnf` and restart service" }
    ]
  },
  "error-nextjs-hydration-mismatch-dynamic-content": {
    es: [
      { cause: "**Diferencia de renderizado entre el HTML generado en el servidor y el cliente React**", solution: "Usar `useEffect` para renderizar datos dinámicos (ej. fechas, localStorage) solo en cliente" },
      { cause: "**Etiquetas HTML anidadas incorrectamente (ej. <p> dentro de otro <p> o <div>)**", solution: "Corregir la estructura DOM o desactivar SSR temporalmente con `dynamic(() => ..., { ssr: false })`" }
    ],
    en: [
      { cause: "**HTML mismatch between server-rendered HTML and client React DOM**", solution: "Use `useEffect` to render client-only dynamic data (e.g. dates, localStorage)" },
      { cause: "**Invalid HTML tag nesting (e.g. <p> inside <p> or <div>)**", solution: "Fix DOM structure or wrap with `dynamic(() => ..., { ssr: false })`" }
    ]
  },
  "error-nfs-mount-timeout-linux": {
    es: [
      { cause: "**Puerto NFS (2049) o rpcbind bloqueado por firewall en el servidor de destino**", solution: "Permitir el tráfico de NFS en el firewall: `ufw allow 2049/tcp`" },
      { cause: "**Servicio NFS server no activo o exportación no declarada en /etc/exports**", solution: "Verificar la ruta exportada con `showmount -e IP_SERVIDOR`" }
    ],
    en: [
      { cause: "**NFS port (2049) or rpcbind blocked by firewall on target server**", solution: "Allow NFS traffic in firewall: `ufw allow 2049/tcp`" },
      { cause: "**NFS server service inactive or export unlisted in /etc/exports**", solution: "Verify exported path with `showmount -e SERVER_IP`" }
    ]
  },
  "error-nginx-502-bad-gateway-php-fpm-sock": {
    es: [
      { cause: "**Servicio php-fpm detenido o no iniciado**", solution: "Iniciar el demonio de PHP: `sudo systemctl start php-fpm` (o `php8.2-fpm`)" },
      { cause: "**Permisos insuficientes en el archivo socket UNIX /var/run/php/php-fpm.sock**", solution: "Cambiar propietario del socket a `www-data:www-data` en `/etc/php/fpm/pool.d/www.conf`" }
    ],
    en: [
      { cause: "**php-fpm daemon service stopped or not started**", solution: "Start PHP daemon: `sudo systemctl start php-fpm` (or `php8.2-fpm`)" },
      { cause: "**Insufficient permissions on UNIX socket /var/run/php/php-fpm.sock**", solution: "Change socket owner to `www-data:www-data` in `/etc/php/fpm/pool.d/www.conf`" }
    ]
  },
  "error-nginx-client-max-body-size": {
    es: [
      { cause: "**Directiva client_max_body_size en Nginx con límite inferior al tamaño del archivo subido**", solution: "Aumentar el límite en `nginx.conf`: `client_max_body_size 64M;`" },
      { cause: "**Límite upload_max_filesize o post_max_size en php.ini restringiendo el tamaño**", solution: "Actualizar `upload_max_filesize = 64M` en el archivo de configuración de PHP" }
    ],
    en: [
      { cause: "**Nginx client_max_body_size directive limit below uploaded file size**", solution: "Increase limit in `nginx.conf`: `client_max_body_size 64M;`" },
      { cause: "**php.ini upload_max_filesize or post_max_size restricting upload size**", solution: "Update `upload_max_filesize = 64M` in PHP configuration file" }
    ]
  },
  "error-node-modules-insufficient-permissions": {
    es: [
      { cause: "**Directorio node_modules perteneciendo al usuario root debido a uso previo de sudo**", solution: "Restablecer la propiedad del directorio: `sudo chown -R $USER:$USER node_modules`" },
      { cause: "**Caché de NPM con permisos restrictivos**", solution: "Limpiar y reparar la caché global: `npm cache clean --force`" }
    ],
    en: [
      { cause: "**node_modules directory owned by root due to prior sudo usage**", solution: "Reset directory ownership: `sudo chown -R $USER:$USER node_modules`" },
      { cause: "**NPM cache directory restricted permissions**", solution: "Clean and repair global cache: `npm cache clean --force`" }
    ]
  },
  "error-npm-err-code-eacces-permission-denied-mkdir": {
    es: [
      { cause: "**Ejecución de npm install global sin permisos en /usr/local/lib/node_modules**", solution: "Cambiar el directorio global por defecto de npm a la carpeta home del usuario" },
      { cause: "**Permisos de carpeta del proyecto pertenecientes a root**", solution: "Ejecutar `sudo chown -R $USER:$USER .` en la carpeta raíz del proyecto" }
    ],
    en: [
      { cause: "**Running global npm install without write permissions to /usr/local/lib/node_modules**", solution: "Change default global npm directory to user home directory" },
      { cause: "**Project directory ownership belonging to root user**", solution: "Run `sudo chown -R $USER:$USER .` in project root directory" }
    ]
  },
  "error-npm-fix-broken-dependencies": {
    es: [
      { cause: "**Árbol de dependencias corrupto o conflictos de paquetes en package-lock.json**", solution: "Eliminar bloqueos y reinstalar: `rm -rf node_modules package-lock.json && npm install`" },
      { cause: "**Versiones incompatibles instaladas mediante el registro de npm**", solution: "Forzar resolución de dependencias obsoletas con `npm audit fix --force`" }
    ],
    en: [
      { cause: "**Corrupted dependency tree or package conflicts in package-lock.json**", solution: "Remove locks and reinstall: `rm -rf node_modules package-lock.json && npm install`" },
      { cause: "**Incompatible package versions installed via npm registry**", solution: "Force resolve stale dependencies using `npm audit fix --force`" }
    ]
  },
  "error-npm-install-failed-node-gyp": {
    es: [
      { cause: "**Falta de herramientas de compilación C/C++ (make, gcc, python3) en el sistema**", solution: "Instalar paquete de desarrollo: `sudo apt install build-essential` o `pacman -S base-devel`" },
      { cause: "**Versión de Node.js demasiado reciente para módulos nativos antiguos**", solution: "Utilizar NVM para cambiar temporalmente a una versión LTS de Node.js" }
    ],
    en: [
      { cause: "**Missing C/C++ build tools (make, gcc, python3) on system**", solution: "Install dev tools: `sudo apt install build-essential` or `pacman -S base-devel`" },
      { cause: "**Node.js version too recent for legacy native C++ modules**", solution: "Use NVM to temporarily switch to an LTS Node.js release" }
    ]
  },
  "error-pip-externally-managed-environment": {
    es: [
      { cause: "**Protección PEP 668 en Python moderno impidiendo pip install global en el sistema**", solution: "Crear y activar un entorno virtual: `python3 -m venv venv && source venv/bin/activate`" },
      { cause: "**Necesidad de instalar un paquete Python a nivel de sistema operativo**", solution: "Instalar el paquete mediante el gestor de paquetes de la distribución (ej. `apt install python3-pkg`)" }
    ],
    en: [
      { cause: "**PEP 668 protection in modern Python preventing system-wide pip install**", solution: "Create and activate virtual environment: `python3 -m venv venv && source venv/bin/activate`" },
      { cause: "**Requirement to install Python package via system package manager**", solution: "Install package via system package manager (e.g. `apt install python3-pkg`)" }
    ]
  },
  "error-proton-dxvk-cache-stutter": {
    es: [
      { cause: "**Caché de compilación de shaders DXVK desincronizada o dañada**", solution: "Eliminar el archivo `.dxvk-cache` en la carpeta prefix del juego" },
      { cause: "**Subida brusca de uso de CPU durante compilación en tiempo real**", solution: "Activar precompilación asíncrona de shaders: `DXVK_ASYNC=1 %command%`" }
    ],
    en: [
      { cause: "**Corrupted or out-of-sync DXVK shader cache**", solution: "Delete `.dxvk-cache` file in game prefix folder" },
      { cause: "**High CPU usage spike during real-time shader compilation**", solution: "Enable async shader precompilation: `DXVK_ASYNC=1 %command%`" }
    ]
  },
  "error-proxmox-disk-no-space-clean-local": {
    es: [
      { cause: "**Almacenamiento local (root) de Proxmox al 100% impidiendo el arranque de VMs**", solution: "Eliminar imágenes ISO antiguas y respaldos en `/var/lib/vz/template/iso/`" },
      { cause: "**Archivos de registros (logs) de Proxmox saturados en /var/log/**", solution: "Limpiar archivos de logs comprimidos viejos: `rm -f /var/log/*.gz /var/log/pve/tasks/*`" }
    ],
    en: [
      { cause: "**Proxmox local (root) storage at 100% preventing VM startup**", solution: "Delete old ISO images and backups under `/var/lib/vz/template/iso/`" },
      { cause: "**Saturated Proxmox log files under /var/log/**", solution: "Clean old compressed log files: `rm -f /var/log/*.gz /var/log/pve/tasks/*`" }
    ]
  },
  "error-puertos-conflictivos-umbrel-docker": {
    es: [
      { cause: "**El puerto 80 o 443 requerido por una App de Umbrel está ocupado por otro servicio**", solution: "Modificar la asignación de puertos en el archivo `docker-compose.yml` de la App" },
      { cause: "**Proceso local de Nginx o Apache bloqueando los puertos en el servidor anfitrión**", solution: "Identificar y detener el servicio conflictivo: `sudo systemctl stop nginx`" }
    ],
    en: [
      { cause: "**Port 80 or 443 required by Umbrel app occupied by another service**", solution: "Modify port mapping in App's `docker-compose.yml` file" },
      { cause: "**Local Nginx or Apache process blocking host ports**", solution: "Identify and stop conflicting service: `sudo systemctl stop nginx`" }
    ]
  },
  "error-redireccion-https": {
    es: [
      { cause: "**Bucle de redirección infinito (Too Many Redirects) por discrepancia de protocolo**", solution: "Configurar las cabeceras `X-Forwarded-Proto` en el proxy inverso Nginx/Cloudflare" },
      { cause: "**URL del sitio en WordPress configurada con http:// en lugar de https://**", solution: "Actualizar las opciones `siteurl` y `home` en la base de datos de WordPress" }
    ],
    en: [
      { cause: "**Infinite redirect loop (Too Many Redirects) due to protocol mismatch**", solution: "Set `X-Forwarded-Proto` headers in Nginx/Cloudflare reverse proxy" },
      { cause: "**WordPress Site URL configured with http:// instead of https://**", solution: "Update `siteurl` and `home` options in WordPress database" }
    ]
  },
  "error-sqlite-corrupt-sonarr": {
    es: [
      { cause: "**Base de datos SQLite de Sonarr/Radarr corrupta por apagado repentino del contenedor**", solution: "Restaurar un respaldo automático de la carpeta `Backups/scheduled/`" },
      { cause: "**Integridad de la base de datos sqlite3 dañada**", solution: "Reparar exportando e importando datos: `sqlite3 sonarr.db \".recover\" | sqlite3 sonarr_fixed.db`" }
    ],
    en: [
      { cause: "**Corrupted Sonarr/Radarr SQLite database due to abrupt shutdown**", solution: "Restore an automatic backup from `Backups/scheduled/` folder" },
      { cause: "**Damaged sqlite3 database integrity**", solution: "Repair database: `sqlite3 sonarr.db \".recover\" | sqlite3 sonarr_fixed.db`" }
    ]
  },
  "error-ssh-connection-timeout-iptables": {
    es: [
      { cause: "**Reglas de firewall iptables o UFW bloqueando el puerto SSH (22)**", solution: "Permitir el puerto 22 en el firewall: `sudo ufw allow 22/tcp`" },
      { cause: "**Servidor SSH no está escuchando en la dirección IP esperada**", solution: "Verificar el estado del demonio SSH con `sudo systemctl status sshd`" }
    ],
    en: [
      { cause: "**iptables or UFW firewall rules blocking SSH port (22)**", solution: "Allow SSH port 22 in firewall: `sudo ufw allow 22/tcp`" },
      { cause: "**SSH server daemon not listening on expected IP address**", solution: "Check SSH daemon status: `sudo systemctl status sshd`" }
    ]
  },
  "error-ssh-host-key-verification-failed": {
    es: [
      { cause: "**La clave pública de la máquina remota cambió en el archivo known_hosts**", solution: "Eliminar la entrada antigua del host: `ssh-keygen -R IP_O_HOST`" },
      { cause: "**Ataque Man-in-the-Middle o reinstalación del sistema operativo del servidor**", solution: "Confirmar el nuevo huella digital de la clave e ingresar nuevamente mediante SSH" }
    ],
    en: [
      { cause: "**Remote host public key changed in known_hosts file**", solution: "Remove stale host entry: `ssh-keygen -R HOST_OR_IP`" },
      { cause: "**Man-in-the-Middle alert or server OS reinstallation**", solution: "Verify key fingerprint and re-authenticate via SSH" }
    ]
  },
  "error-ssh-permission-denied-key": {
    es: [
      { cause: "**Permisos excesivamente abiertos en el archivo de clave privada (~/.ssh/id_rsa)**", solution: "Asignar permisos estrictos a la clave privada: `chmod 600 ~/.ssh/id_rsa`" },
      { cause: "**Clave pública no agregada al archivo authorized_keys del servidor remoto**", solution: "Copiar la clave pública al servidor con `ssh-copy-id usuario@servidor`" }
    ],
    en: [
      { cause: "**Overly permissive file permissions on private key (~/.ssh/id_rsa)**", solution: "Set strict permissions on private key: `chmod 600 ~/.ssh/id_rsa`" },
      { cause: "**Public key missing from remote server's authorized_keys**", solution: "Copy public key to server: `ssh-copy-id user@server`" }
    ]
  },
  "error-ssh": {
    es: [
      { cause: "**Servicio SSH (sshd) detenido en el servidor de destino**", solution: "Iniciar el servicio SSH: `sudo systemctl start sshd`" },
      { cause: "**Filtro de seguridad o puerto por defecto bloqueado**", solution: "Verificar conexión en el puerto asignado con `ssh -p PUERTO usuario@host`" }
    ],
    en: [
      { cause: "**SSH daemon service (sshd) stopped on target server**", solution: "Start SSH service daemon: `sudo systemctl start sshd`" },
      { cause: "**Security filter or custom port blocked**", solution: "Test connection on custom port: `ssh -p PORT user@host`" }
    ]
  },
  "error-ssl-expired-certbot-letsencrypt": {
    es: [
      { cause: "**Certificado SSL/TLS de Let's Encrypt expirado por fallo en el proceso de renovación**", solution: "Forzar la renovación del certificado: `sudo certbot renew --force-renewal`" },
      { cause: "**Desafío HTTP-01 fallido por puerto 80 cerrado o bloqueado**", solution: "Asegurar que el servidor web responda en el puerto 80 y reiniciar Nginx/Apache" }
    ],
    en: [
      { cause: "**Expired Let's Encrypt SSL/TLS certificate due to failed renewal**", solution: "Force certificate renewal: `sudo certbot renew --force-renewal`" },
      { cause: "**Failed HTTP-01 challenge because port 80 is closed**", solution: "Ensure web server listens on port 80 and restart Nginx/Apache" }
    ]
  },
  "error-systemd-failed-to-start-network-name-resolution": {
    es: [
      { cause: "**Servicio systemd-resolved fallando por conflicto de permisos o configuración corrupta**", solution: "Revisar los logs del servicio con `journalctl -u systemd-resolved -b`" },
      { cause: "**Enlace simbólico del archivo /etc/resolv.conf roto**", solution: "Recrear el enlace simbólico hacia `/run/systemd/resolve/stub-resolv.conf`" }
    ],
    en: [
      { cause: "**systemd-resolved service failing due to permission or config corruption**", solution: "Check service logs via `journalctl -u systemd-resolved -b`" },
      { cause: "**Broken /etc/resolv.conf symlink**", solution: "Recreate symlink pointing to `/run/systemd/resolve/stub-resolv.conf`" }
    ]
  },
  "error-timeout-prowlarr": {
    es: [
      { cause: "**Conexión a indexadores bloqueada por la protección Cloudflare / Cloudflare Turnstile**", solution: "Vincular Prowlarr con un contenedor de FlareSolverr configurado" },
      { cause: "**Latencia excesiva o DNS del servidor fallando al resolver dominios de indexadores**", solution: "Aumentar el tiempo límite de timeout en la configuración del indexador en Prowlarr" }
    ],
    en: [
      { cause: "**Indexer connection blocked by Cloudflare / Turnstile challenge**", solution: "Connect Prowlarr with a running FlareSolverr container instance" },
      { cause: "**High latency or server DNS failing to resolve indexer domains**", solution: "Increase request timeout limit in Prowlarr indexer settings" }
    ]
  },
  "error-vram-allocation-diablo4": {
    es: [
      { cause: "**Desbordamiento de memoria VRAM en GPUs con 8GB o menos en texturas Ultra**", solution: "Reducir el ajuste de Texturas a Alto o Medio en las opciones gráficas del juego" },
      { cause: "**Manejo ineficiente del pool de memoria DirectX 12 por parte de VKD3D-Proton**", solution: "Agregar la variable de entorno `VKD3D_CONFIG=upload_hvv %command%` en Steam" }
    ],
    en: [
      { cause: "**VRAM overflow on GPUs with 8GB or less using Ultra textures**", solution: "Lower texture settings to High or Medium in-game" },
      { cause: "**Inefficient DirectX 12 memory pool management by VKD3D-Proton**", solution: "Add `VKD3D_CONFIG=upload_hvv %command%` in Steam launch parameters" }
    ]
  },
  "limpiar-cache-pacman-cachyos": {
    es: [
      { cause: "**Acumulación descontrolada de paquetes antiguos en /var/cache/pacman/pkg/**", solution: "Eliminar versiones antiguas del caché: `sudo paccache -r`" },
      { cause: "**Falta de limpieza de paquetes huérfanos sin dependencias activas**", solution: "Eliminar paquetes huérfanos con `sudo pacman -Rns $(pacman -Qtdq)`" }
    ],
    en: [
      { cause: "**Uncontrolled accumulation of old packages in /var/cache/pacman/pkg/**", solution: "Clean old package cache: `sudo paccache -r`" },
      { cause: "**Uncleaned orphaned packages with no active dependencies**", solution: "Remove orphan packages: `sudo pacman -Rns $(pacman -Qtdq)`" }
    ]
  },
  "limpiar-registro-wordpress-banahosting": {
    es: [
      { cause: "**Base de datos de WordPress saturada por revisiones de entradas y transitorios**", solution: "Optimizar la base de datos desde WP-CLI: `wp transient delete --all`" },
      { cause: "**Límite de tamaño de base de datos o almacenamiento superado en BanaHosting**", solution: "Vaciar la tabla `wp_options` de datos temporales obsoletos mediante phpMyAdmin" }
    ],
    en: [
      { cause: "**WordPress database bloated by post revisions and transients**", solution: "Optimize database via WP-CLI: `wp transient delete --all`" },
      { cause: "**Database size or storage quota exceeded on BanaHosting**", solution: "Clear stale transients from `wp_options` table via phpMyAdmin" }
    ]
  },
  "optimizar-input-lag-juegos-linux": {
    es: [
      { cause: "**Composición de ventanas activada generando retardo de fotogramas (VSync)**", solution: "Desactivar la composición de pantalla o utilizar una sesión Wayland nativa" },
      { cause: "**Regulador de frecuencia de CPU en modo powersave**", solution: "Establecer la CPU en modo rendimiento: `gamemoded -r` o `powerprofilesctl set performance`" }
    ],
    en: [
      { cause: "**Window compositing enabled causing frame latency (VSync)**", solution: "Disable screen compositor or switch to a native Wayland session" },
      { cause: "**CPU frequency governor set to powersave mode**", solution: "Set CPU to performance mode: `gamemoded -r` or `powerprofilesctl set performance`" }
    ]
  },
  "optimizar-memoria-swap-linux": {
    es: [
      { cause: "**Uso agresivo del espacio swap en disco lento causando tirones (stuttering)**", solution: "Reducir la agresividad de swappiness: `sudo sysctl vm.swappiness=10`" },
      { cause: "**Falta de compresión de memoria RAM en tiempo real**", solution: "Habilitar el módulo zRAM en Linux para comprimir la memoria en lugar de usar swap en disco" }
    ],
    en: [
      { cause: "**Aggressive swap usage on slow disk causing stuttering**", solution: "Lower swappiness parameter: `sudo sysctl vm.swappiness=10`" },
      { cause: "**Lack of real-time RAM memory compression**", solution: "Enable zRAM module in Linux to compress RAM instead of disk swapping" }
    ]
  },
  "optimizar-proton-vulkan-shader-precompilation": {
    es: [
      { cause: "**Tirones constantes (stuttering) al entrar en nuevas zonas por compilación de shaders**", solution: "Habilitar la precompilación en segundo plano de shaders Vulkan en los ajustes de Steam" },
      { cause: "**Caché de shaders deshabilitada o límite de almacenamiento muy bajo**", solution: "Configurar `RADV_PERFTEST=gsw %command%` para GPUs AMD o actualizar drivers Mesa" }
    ],
    en: [
      { cause: "**Frequent stuttering when entering new areas due to shader compilation**", solution: "Enable background Vulkan shader pre-compilation in Steam settings" },
      { cause: "**Disabled shader cache or low storage limit**", solution: "Set `RADV_PERFTEST=gsw %command%` for AMD GPUs or update Mesa drivers" }
    ]
  },
  "permisos-correctos-wordpress-seguridad": {
    es: [
      { cause: "**Permisos excesivamente abiertos (ej. 777) en archivos o carpetas de WordPress**", solution: "Asignar permisos seguros: `find . -type d -exec chmod 755 {} \\;` y `644` para archivos" },
      { cause: "**Archivo wp-config.php accesible o editable por otros usuarios del servidor**", solution: "Establecer permisos estrictos en wp-config.php: `chmod 600 wp-config.php`" }
    ],
    en: [
      { cause: "**Overly permissive file permissions (e.g. 777) on WordPress files**", solution: "Set secure permissions: `find . -type d -exec chmod 755 {} \\;` and `644` for files" },
      { cause: "**wp-config.php file accessible or writable by other server users**", solution: "Set strict permissions on wp-config.php: `chmod 600 wp-config.php`" }
    ]
  },
  "reparar-grub-boot-linux": {
    es: [
      { cause: "**Cargador de arranque GRUB eliminado o corrupto tras actualización de Windows**", solution: "Iniciar desde un Live USB y reinstalar GRUB con `grub-install /dev/sdX`" },
      { cause: "**Archivo de configuración /boot/grub/grub.cfg corrupto o desactualizado**", solution: "Regenerar el menú de arranque con `grub-mkconfig -o /boot/grub/grub.cfg`" }
    ],
    en: [
      { cause: "**GRUB bootloader removed or corrupted after Windows Update**", solution: "Boot from Live USB and reinstall GRUB: `grub-install /dev/sdX`" },
      { cause: "**Corrupted or outdated /boot/grub/grub.cfg file**", solution: "Regenerate boot config: `grub-mkconfig -o /boot/grub/grub.cfg`" }
    ]
  },
  "restaurar-contrasenia-root-linux": {
    es: [
      { cause: "**Contraseña de superusuario root olvidada o bloqueada**", solution: "Iniciar en modo monousuario (single-user) agregando `init=/bin/bash` en GRUB" },
      { cause: "**Sistema de archivos montado en modo lectura (read-only) durante la recuperación**", solution: "Remontar en modo lectura/escritura: `mount -o remount,rw /` y cambiar clave con `passwd`" }
    ],
    en: [
      { cause: "**Forgotten or locked root superuser password**", solution: "Boot in single-user mode by appending `init=/bin/bash` in GRUB" },
      { cause: "**Read-only mounted filesystem during recovery**", solution: "Remount read/write: `mount -o remount,rw /` and reset password via `passwd`" }
    ]
  },
  "solucion-cloud-init-slow-boot-proxmox-ubuntu": {
    es: [
      { cause: "**Proceso cloud-init esperando respuestas de la red durante el arranque de la VM**", solution: "Desactivar la búsqueda de metadatos de red innecesarios en `/etc/cloud/cloud.cfg`" },
      { cause: "**Servicios de cloud-init demorando el inicio de systemd**", solution: "Deshabilitar módulos no utilizados: `systemctl disable cloud-init`" }
    ],
    en: [
      { cause: "**cloud-init process waiting for network response during VM boot**", solution: "Disable unused network metadata lookup in `/etc/cloud/cloud.cfg`" },
      { cause: "**cloud-init services delaying systemd startup**", solution: "Disable unused modules: `systemctl disable cloud-init`" }
    ]
  },
  "solucion-crasheo-overwatch-2-mangohud-proton": {
    es: [
      { cause: "**Incompatibilidad de la capa MangoHud con el compilador DXVK/VKD3D**", solution: "Desactivar el parámetro `MANGOHUD=1` o actualizar MangoHud a la versión más reciente" },
      { cause: "**Conflicto de captura de pantalla u overlay de compatibilidad de Proton**", solution: "Utilizar `MANGOHUD_CONFIG=no_display %command%` en los parámetros de arranque" }
    ],
    en: [
      { cause: "**MangoHud overlay incompatibility with DXVK/VKD3D compiler**", solution: "Disable `MANGOHUD=1` or update MangoHud to latest version" },
      { cause: "**Screen capture conflict or Proton overlay incompatibility**", solution: "Use `MANGOHUD_CONFIG=no_display %command%` launch options" }
    ]
  },
  "solucion-lag-flyff-universe": {
    es: [
      { cause: "**Aceleración por hardware deshabilitada en el navegador web**", solution: "Activar la aceleración gráfica por GPU en los ajustes de Chrome/Firefox" },
      { cause: "**Procesamiento de WebGL limitado por la GPU integrada predeterminada**", solution: "Forzar el uso de la tarjeta gráfica dedicada para el ejecutable del navegador" }
    ],
    en: [
      { cause: "**Hardware acceleration disabled in web browser**", solution: "Enable GPU hardware acceleration in Chrome/Firefox settings" },
      { cause: "**WebGL rendering restricted to default integrated GPU**", solution: "Force dedicated GPU usage for browser executable" }
    ]
  },
  "solucion-pantalla-negra-gamescope-steam-deck-linux": {
    es: [
      { cause: "**Resolución de pantalla no soportada por el compositor Gamescope**", solution: "Establecer la resolución explícita: `gamescope -w 1280 -h 720 -- %command%`" },
      { cause: "**Fallo en la tasa de refresco (Hz) elegida en el menú de ajuste rápido**", solution: "Restablecer la tasa de refresco a 60Hz o refrescar la sesión del servidor gráfico" }
    ],
    en: [
      { cause: "**Unsupported display resolution in Gamescope compositor**", solution: "Set explicit resolution: `gamescope -w 1280 -h 720 -- %command%`" },
      { cause: "**Refresh rate (Hz) mismatch in quick settings menu**", solution: "Reset refresh rate to 60Hz or restart display server session" }
    ]
  },
  "solucion-stuttering-nvidia-wayland-explicit-sync": {
    es: [
      { cause: "**Falta de soporte de Explicit Sync en controladores Nvidia anteriores a la serie 555**", solution: "Actualizar los controladores propietarios de Nvidia a la versión 555.58 o superior" },
      { cause: "**Desincronización de fotogramas entre XWayland y el servidor Wayland**", solution: "Habilitar la bandera de sincronización explícita en el archivo de configuración del compositor" }
    ],
    en: [
      { cause: "**Lack of Explicit Sync support in Nvidia drivers prior to version 555**", solution: "Update proprietary Nvidia drivers to version 555.58 or higher" },
      { cause: "**Frame desynchronization between XWayland and Wayland compositor**", solution: "Enable explicit sync flag in compositor configuration file" }
    ]
  },
  "solucion-stuttering-vkd3d-proton-elden-ring-linux": {
    es: [
      { cause: "**Tirones (stuttering) por compilación de shaders VKD3D DirectX 12**", solution: "Usar Proton-GE actualizado e incluir `VKD3D_CONFIG=single_queue %command%`" },
      { cause: "**Límite de memoria caché de shaders por defecto saturado**", solution: "Aumentar el tamaño de la caché de Vulkan agregando `__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1`" }
    ],
    en: [
      { cause: "**Stuttering caused by VKD3D DirectX 12 shader compilation**", solution: "Use updated Proton-GE and set `VKD3D_CONFIG=single_queue %command%`" },
      { cause: "**Default shader cache memory limit reached**", solution: "Expand Vulkan shader cache size using `__GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1`" }
    ]
  },
  "stuttering-juegos-proton-dxvk-cache": {
    es: [
      { cause: "**Compilación de shaders DXVK sucediendo en tiempo real durante la partida**", solution: "Activar la compilación asíncrona mediante la variable `DXVK_ASYNC=1`" },
      { cause: "**Caché de shaders corrupta en el directorio del prefijo de Steam**", solution: "Borrar el contenido de la carpeta `shadercache` y reconstruir el archivo de caché" }
    ],
    en: [
      { cause: "**DXVK shader compilation occurring in real-time during gameplay**", solution: "Enable async shader compilation via `DXVK_ASYNC=1` variable" },
      { cause: "**Corrupted shader cache inside Steam prefix directory**", solution: "Clear `shadercache` directory contents and rebuild cache" }
    ]
  },
  "thermal-throttling-raspberry-pi-5": {
    es: [
      { cause: "**Temperatura del SoC alcanzando el límite de 80°C bajo carga constante**", solution: "Instalar el disipador oficial Raspberry Pi Active Cooler" },
      { cause: "**Falta de disipación de calor adecuada en la carcasa**", solution: "Usar una carcasa de aluminio con disipación pasiva o ventilador de control PWM" }
    ],
    en: [
      { cause: "**SoC temperature reaching 80°C threshold under heavy load**", solution: "Install official Raspberry Pi Active Cooler fan assembly" },
      { cause: "**Inadequate heat dissipation inside enclosure**", solution: "Use aluminum case with passive cooling or PWM-controlled fan" }
    ]
  }
};

function processFiles(dir, lang) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const isEn = lang === 'en';
  let updatedCount = 0;

  files.forEach(file => {
    const slug = file.replace('.md', '');
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    const hasDiagHeading = /##.*(Diagnóstico|Diagnostics)/i.test(content);
    const hasTable = /\|.*\|.*\|/.test(content);

    if (hasDiagHeading && hasTable) {
      return; // Already has diagnostic table
    }

    const postDiag = DIAGNOSTICS_MAP[slug];
    if (!postDiag) {
      console.warn(`[WARN] No mapped diagnostic data for slug: ${slug} (${lang})`);
      return;
    }

    const items = isEn ? postDiag.en : postDiag.es;
    const tableTitle = isEn ? '## Quick Diagnostics' : '## Diagnóstico Rápido';
    const headerCols = isEn ? '| Cause | Solution |' : '| Causa | Solución |';
    const rowsStr = items.map(d => `| ${d.cause} | ${d.solution} |`).join('\n');
    const fullDiagMarkdown = `\n${tableTitle}\n${headerCols}\n|---|---|\n${rowsStr}\n`;

    // Remove any leftover empty heading
    content = content.replace(/##\s*(?:Diagnóstico Rápido|Quick Diagnostics|Diagnóstico|Diagnostics)\s*\n/gi, '');

    // Insert right after frontmatter '---'
    const fmEndIndex = content.indexOf('---', 4);
    if (fmEndIndex !== -1) {
      const beforeFm = content.substring(0, fmEndIndex + 3);
      const afterFm = content.substring(fmEndIndex + 3);
      content = beforeFm + '\n' + fullDiagMarkdown + afterFm;
      fs.writeFileSync(filePath, content, 'utf8');
      updatedCount++;
      console.log(`[UPDATED] ${dir}/${file}`);
    }
  });

  return updatedCount;
}

console.log('--- INSERTANDO DIAGNÓSTICOS RÁPIDOS ---');
const updatedEs = processFiles(POSTS_ES_DIR, 'es');
const updatedEn = processFiles(POSTS_EN_DIR, 'en');

console.log(`\nCompletado: ${updatedEs} artículos en español y ${updatedEn} artículos en inglés actualizados con éxito.`);
