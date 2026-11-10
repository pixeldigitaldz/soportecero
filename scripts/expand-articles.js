import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_DIR = path.join(__dirname, '..', 'content', 'posts');

// Helper to count words (excluding frontmatter)
function countWords(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

// Deep technical domain knowledge generators based on tags, title and category
function getArchitectureContext(fm, content) {
  const title = fm.title || '';
  const desc = fm.description || '';
  const tags = (fm.tags || []).map(t => t.toLowerCase());
  const tLower = (title + ' ' + desc + ' ' + tags.join(' ')).toLowerCase();

  if (tags.includes('docker') || tLower.includes('docker') || tLower.includes('dockge') || tLower.includes('contenedor')) {
    return `En entornos contenerizados, el motor de **Docker** se apoya en primitivas fundamentales del kernel de Linux: **Namespaces** (PID, NET, MNT, IPC, UTS) para el aislamiento lógico de procesos y **Control Groups (cgroups v1/v2)** para el límite estricto de recursos de hardware (memoria RAM, ciclos de CPU y cuotas de I/O de disco).

Cuando se produce este fallo, la anomalía suele situarse en la frontera entre el demonio \`dockerd\`, el runtime OCI (\`containerd\` / \`runc\`) y el subsistema de red del host:
1. **Comunicación con el socket IPC (\`/var/run/docker.sock\`):** El cliente de Docker interactúa con la API REST local mediante llamadas al sistema sobre un socket de dominio UNIX. Si los permisos de usuario en el socket no pertenecen al grupo \`docker\` o si el demonio ha quedado bloqueado por un hilo zombie, la llamada al sistema devuelve inmediatamente un descriptor de error \`EACCES\` o \`ECONNREFUSED\`.
2. **Ciclo de vida del contenedor y estados OCI:** Durante la creación del contenedor (\`container create / start\`), \`runc\` solicita al kernel la creación de los namespaces y el montaje del sistema de archivos en capas mediante el driver de almacenamiento **Overlay2** (\`lowerdir\`, \`upperdir\` y \`merged\`). Si existe corrupción en las capas de imagen, agotamiento de inodos en \`/var/lib/docker\`, o incompatibilidad con la arquitectura del binario, el runtime aborta con códigos de salida específicos (ej. Exit Code 137 por OOM Killer o Exit Code 126/127 por permisos o dependencias ausentes).
3. **Pila de red virtual y cadenas de iptables:** Para exponer puertos (\`-p\`), Docker manipula directamente las tablas \`nat\` y \`filter\` del subsistema Netfilter mediante cadenas personalizadas (\`DOCKER\`, \`DOCKER-USER\`). Reinicios no sincronizados del firewall (\`ufw\` o \`firewalld\`) eliminan estas cadenas en memoria del kernel, provocando que los paquetes TCP entrantes sean descartados silenciosamente con paquetes TCP RST.`;
  }

  if (tags.includes('git') || tLower.includes('git') || tLower.includes('rebase') || tLower.includes('merge') || tLower.includes('commit')) {
    return `El sistema de control de versiones **Git** opera como una base de datos de objetos direccionables por contenido criptográfico (hashes SHA-1 / SHA-256) respaldada por un grafo acíclico dirigido (DAG). La integridad del repositorio descansa en el directorio interno \`.git/\`, donde se almacenan cuatro tipos de objetos atómicos: **blobs** (contenido puro de archivos), **trees** (representación de directorios y permisos POSIX), **commits** (metadatos del autor, mensaje y puntero al árbol raíz) y **annotated tags**.

La causa raíz de esta incidencia se produce por una alteración en los punteros de referencia o en el mecanismo de bloqueo transaccional del árbol de trabajo:
1. **Mecanismo de Lockfiles atómicos (\`.git/*.lock\`):** Para garantizar la atomicidad en operaciones concurrentes y evitar condiciones de carrera (*race conditions*), Git genera archivos efímeros de bloqueo (ej. \`.git/refs/heads/main.lock\` o \`.git/index.lock\`) antes de mutar cualquier puntero o actualizar el área de preparación (*staging index*). Si un proceso de Git finaliza inesperadamente (por apagado forzado, corte de IDE o fallo de memoria), el lockfile permanece huérfano en el sistema de archivos, impidiendo cualquier operación de lectura/escritura posterior con un error de bloqueo crítico.
2. **Desincronización del grafo DAG y divergencia de ramas:** Durante procesos de \`rebase\` o \`cherry-pick\`, Git reescribe la historia aplicando commits de forma secuencial sobre un nuevo commit base. Si se detectan cambios incompatibles en los mismos bloques de código sin un ancestro común directo (o si se fuerza la unión de árboles de commits independientes creados desde cero), el algoritmo de merge trifásico (*three-way merge*) detiene la ejecución para proteger la integridad del historial, dejando al repositorio en un estado transicional (\`REBASE-i\`, \`MERGING\` o \`DETACHED HEAD\`).
3. **Capa de transporte SSL/TLS y validación de certificados:** Al interactuar con remotos a través de HTTPS, el cliente Git delega la autenticación en la librería local \`libcurl\` y el almacén de certificados CA del sistema operativo. Si la cadena de certificación intermedia no se resuelve o existen desajustes en el reloj del sistema, el handshake criptográfico se cancela de inmediato.`;
  }

  if (tags.includes('nginx') || tags.includes('apache') || tLower.includes('nginx') || tLower.includes('apache') || tLower.includes('htaccess') || tLower.includes('proxy') || tLower.includes('500 internal') || tLower.includes('504 gateway')) {
    return `En servidores web de alto rendimiento como **Nginx** y **Apache HTTP Server**, la arquitectura de despacho de solicitudes se basa en modelos de concurrencia optimizados: bucles de eventos asíncronos no bloqueantes gobernados por multiplexación de E/S (\`epoll\` en Linux) en el caso de Nginx, y modelos híbridos prefork/worker basados en hilos y procesos en Apache.

El fallo técnico reportado se origina por una discrepancia en la negociación de capas entre el servidor web y los procesos upstream o el sistema de archivos subyacente:
1. **Resolución de sockets y ciclo de vida HTTP:** Cuando Nginx actúa como reverse proxy hacia un servidor de aplicaciones (PHP-FPM, Node.js, Python WSGI o contenedores), delega el tráfico a través de sockets TCP (\`127.0.0.1:puerto\`) o sockets de dominio UNIX (\`AF_UNIX\`). Si el backend colapsa por una excepción no controlada, agota su cola de backlog de conexiones entrantes (\`somaxconn\`), o excede el umbral de tiempo establecido por \`proxy_read_timeout\`, el kernel emite una señal de cierre de canal que Nginx traduce en un error HTTP 502 Bad Gateway o 504 Gateway Timeout hacia el cliente web.
2. **Evaluación de directivas \`.htaccess\` y memoria en Apache:** En Apache, cada solicitud hacia un directorio provoca que el servidor escanee y parsee el archivo \`.htaccess\` en tiempo de ejecución. Si se declara una directiva correspondiente a un módulo no cargado en el kernel de Apache (como reglas de reescritura \`RewriteRule\` sin el módulo \`mod_rewrite\`, o manipulación de encabezados sin \`mod_headers\`), el compilador de configuración interno aborta inmediatamente la petición con un error HTTP 500 Internal Server Error, registrando la alerta en el log del servidor.
3. **Permisos POSIX y herencia de grupos de ejecución:** El servidor web corre bajo una identidad de privilegios mínimos en el sistema operativo (comúnmente \`www-data\`, \`nginx\` o \`apache\`). Si los archivos web carecen de permisos de lectura (\`r\`, máscara 644) o los directorios carecen de permisos de ejecución y paso (\`x\`, máscara 755), el kernel deniega la llamada \`open()\` con el error \`EACCES\`, transformándose en un error HTTP 403 Forbidden.`;
  }

  if (tags.includes('npm') || tags.includes('node.js') || tags.includes('javascript') || tags.includes('typescript') || tags.includes('react') || tags.includes('next.js') || tags.includes('vite') || tLower.includes('npm') || tLower.includes('node') || tLower.includes('typescript') || tLower.includes('next.js') || tLower.includes('vite')) {
    return `En el ecosistema de **Node.js** y compiladores modernos de **JavaScript / TypeScript** (como \`tsc\`, \`esbuild\` o \`swc\`), la ejecución del código transcurre sobre el motor **V8** de Google acoplado a la librería de abstracción de E/S **libuv**, la cual gestiona el bucle de eventos (*Event Loop*) y el pool de hilos para operaciones asíncronas de red y sistema de archivos.

La causa raíz de esta incidencia proviene de desalineaciones en la resolución de módulos, el árbol de tipado AST o la frontera de renderizado:
1. **Árbol de resolución de dependencias y conflictos de pares (\`peerDependencies\`):** El gestor de paquetes (\`npm\` v7+) implementa un algoritmo determinista para construir el árbol de módulos en \`node_modules\`. Cuando dos paquetes requieren versiones mayores distintas de una misma librería compartida como dependencia de pares, el algoritmo de resolución rechaza forzar la instalación para prevenir colisiones en tiempo de ejecución, lanzando el error de conflicto de pares (\`ERESOLVE\`).
2. **Fase de hidratación y renderizado isomórfico (SSR vs Client):** En frameworks como Next.js o Remix, el código se ejecuta inicialmente en el servidor (entorno Node.js sin interfaz gráfica) antes de compilarse y enviarse al navegador. Si el código fuente intenta acceder a objetos globales del DOM como \`window\`, \`document\` o \`localStorage\` antes del montaje del componente en el cliente (\`useEffect\`), el motor lanza de inmediato una excepción crítica \`ReferenceError: document is not defined\` durante el Server-Side Rendering.
3. **Mapeo del Sistema de Tipos AST en TypeScript:** El compilador de TypeScript (\`tsc\`) genera un árbol de sintaxis abstracta (*Abstract Syntax Tree*) y valida la correspondencia de tipos en tiempo de transpilación. Si una interfaz carece de una definición de propiedad explícita o se utiliza una librería de JavaScript que no expone declaraciones de tipos (\`@types/*\`), el verificador de tipos emite el error TS2339 para salvaguardar la seguridad de tipos (*type safety*), bloqueando la compilación del proyecto.`;
  }

  if (tags.includes('gaming') || tags.includes('vulkan') || tags.includes('proton') || tags.includes('linux') && (tLower.includes('proton') || tLower.includes('dxvk') || tLower.includes('fps') || tLower.includes('stutter') || tLower.includes('shader') || tLower.includes('crasheo'))) {
    return `En la arquitectura de ejecución de videojuegos de Windows sobre sistemas operativos **Linux**, la capa de compatibilidad se fundamenta en **Wine** y **Proton**, complementados por traductores de llamadas gráficas en tiempo real como **DXVK** (que traduce Direct3D 9, 10 y 11 hacia la API moderna de **Vulkan**) y **VKD3D-Proton** (que traduce llamadas de Direct3D 12 hacia Vulkan).

El fallo de rendimiento, congelamiento (*freeze*) o cierre abrupto (*crash*) responde a cuellos de botella en la canalización de renderizado (*graphics pipeline*):
1. **Compilación asíncrona de shaders y tartamudeo (Shader Stuttering):** Los juegos diseñados para DirectX asumen que los shaders compilados en formato HLSL pueden instanciarse en la GPU de inmediato. Sin embargo, Vulkan requiere compilar los shaders hacia código binario intermedio **SPIR-V** y luego hacia el formato nativo del hardware del controlador gráfico (Mesa RADV para AMD, o el controlador privativo de NVIDIA). Si esta compilación ocurre en el mismo hilo de renderizado que dibuja los cuadros por segundo, la GPU se bloquea esperando instrucciones, provocando microparones abruptos en el frametime.
2. **Sincronización explícita y compositores Wayland:** Con la transición de X11 hacia el protocolo de servidor gráfico **Wayland**, la gestión de los buffers de intercambio (*swapchains*) dependía históricamente de la sincronización implícita del kernel. Cuando los controladores gráficos envían fotogramas desfasados antes de que la GPU complete la renderización del buffer anterior, se genera desgarro visual (*screen tearing*), fotogramas fuera de orden o bloqueos completos en compositores como KWin o Mutter.
3. **Agotamiento de VRAM y límites de memoria del subsistema DRM:** Cuando un título exige más memoria de video de la físicamente integrada en la tarjeta gráfica, el subsistema de administración de memoria de video del kernel (\`amdgpu\` o \`nvidia-modeset\`) se ve forzado a realizar swapping de texturas hacia la memoria RAM del sistema a través del bus PCIe. Esta transferencia a velocidades muy inferiores satura el ancho de banda del bus, culminando en caídas masivas de FPS o en un error fatal \`VK_ERROR_DEVICE_LOST\` emitido por el driver.`;
  }

  if (tags.includes('ssh') || tags.includes('seguridad') || tLower.includes('ssh') || tLower.includes('firewall') || tLower.includes('iptables') || tLower.includes('fail2ban')) {
    return `El protocolo **SSH (Secure Shell)**, estandarizado en RFC 4251-4254, provee un canal de comunicación criptográficamente seguro sobre redes no confiables, operando en la capa de aplicación sobre el protocolo de transporte TCP (puerto estándar 22). Su arquitectura comprende tres componentes desacoplados: la capa de transporte (autenticación del servidor, cifrado simétrico y verificación de integridad), el protocolo de autenticación de usuario, y el protocolo de conexión para multiplexar múltiples canales lógicos.

La causa raíz de esta incidencia radica en fallos de negociación criptográfica o restricciones en la capa de filtrado de paquetes del kernel:
1. **Algoritmos de Intercambio de Claves (KEX) y obsolescencia criptográfica:** Durante el saludo inicial (*handshake*), el cliente y el demonio \`sshd\` negocian un algoritmo de intercambio de claves seguro (ej. \`curve25519-sha256\` o \`diffie-hellman-group14-sha256\`). Si el cliente o el servidor tienen deshabilitados algoritmos heredados (por ejemplo tras una actualización de OpenSSH que desactiva claves SHA-1 o algoritmos RSA débiles), la negociación aborta de inmediato con el error \`kex_exchange_identification: read: Connection reset by peer\`.
2. **Verificación de huella digital y archivos \`known_hosts\`:** El cliente SSH protege al usuario contra ataques de intermediario (*Man-in-the-Middle*) cotejando la clave pública del servidor con el registro histórico almacenado en \`~/.ssh/known_hosts\`. Si el servidor remoto ha sido reinstalado, ha cambiado su par de claves o se ha reasignado la dirección IP en un entorno dinámico de nube, la huella digital criptográfica no coincidirá, activando un bloqueo de seguridad estricto por advertencia de ataque de spoofing.
3. **Bloqueo a nivel de Netfilter y saturación de conexiones:** Si se producen múltiples intentos de conexión fallidos o peticiones de autenticación concurrentes, módulos de seguridad como \`fail2ban\` o reglas en \`iptables\` / \`nftables\` descartan los paquetes entrantes (\`DROP\`), provocando que el cliente permanezca a la espera hasta agotar el tiempo límite (\`Connection timed out\`).`;
  }

  // Generic Sysadmin & Linux internals fallback
  return `En la arquitectura del sistema operativo **Linux**, las aplicaciones de usuario operan en espacio no privilegiado (*User Space*) y dependen de llamadas al sistema (*syscalls*) para interactuar con los recursos físicos de hardware a través del **Kernel de Linux**. El subsistema del kernel arbitra el acceso a la memoria virtual, los descriptores de archivos, la pila de protocolos de red TCP/IP y los dispositivos de almacenamiento en bloque a través de la capa de abstracción **VFS (Virtual File System)**.

La anomalía técnica identificada en esta incidencia proviene de una restricción o condición de fallo en los mecanismos de control del sistema:
1. **Límites de descriptores de archivos y cuotas de inodos:** Cada archivo, socket de red o tubería (*pipe*) abierto por un proceso consume un descriptor de archivo en la tabla del kernel. Si el proceso alcanza el límite de descriptores asignado por el subsistema \`ulimit\` o si el sistema de archivos agota su tabla de inodos libres (incluso cuando resta espacio en gigabytes en disco), el kernel rechaza cualquier operación de escritura con el código de error \`ENOSPC (No space left on device)\` o \`EMFILE (Too many open files)\`.
2. **Jerarquía de permisos POSIX y atributos inmutables del sistema:** Las llamadas al sistema como \`open()\`, \`unlink()\` o \`chmod()\` evalúan los bits de permiso estándar (Lectura \`r\`, Escritura \`w\`, Ejecución \`x\`) junto con el UID/GID del proceso ejecutor. Si el archivo posee atributos extendidos inmutables fijados a nivel del sistema de archivos mediante \`chattr +i\`, el kernel bloquea cualquier mutación incluso ante el usuario privilegiado \`root\`, retornando el error \`EPERM (Operation not permitted)\`.
3. **Administración de memoria virtual y Swapping:** Cuando el sistema experimenta presión de memoria y la memoria física disponible es insuficiente para satisfacer las solicitudes del gestor de páginas, el kernel recurre a la memoria swap. Si los umbrales de agresividad (\`vm.swappiness\`) están desajustados o el espacio de intercambio está fragmentado, el sistema entra en un estado de congestión (*thrashing*), degradando el rendimiento general hasta que el subsistema OOM Killer termina procesos para preservar la estabilidad del kernel.`;
}

function getConsoleDiagnosticSection(fm) {
  const tags = (fm.tags || []).map(t => t.toLowerCase());
  const tLower = (fm.title + ' ' + (fm.description || '')).toLowerCase();

  if (tags.includes('docker') || tLower.includes('docker')) {
    return `\`\`\`bash
# 1. Comprobar el estado general del demonio Docker
sudo systemctl status docker --no-pager -l

# 2. Inspeccionar los últimos logs del contenedor afectado
docker logs --tail 50 --timestamps NOMBRE_CONTENEDOR

# 3. Verificar el uso de recursos y memoria en tiempo real
docker stats --no-stream
\`\`\`

- El comando \`docker logs\` con el parámetro \`--tail 50\` extrae únicamente las últimas 50 líneas emitidas en \`stdout\` y \`stderr\`, mientras que \`--timestamps\` permite correlacionar el segundo exacto del fallo con los registros del sistema operativo.
- El flag \`--no-stream\` en \`docker stats\` realiza un muestreo único del consumo de CPU y memoria de todos los contenedores en ejecución, evitando bloquear la terminal interactiva.`;
  }

  if (tags.includes('nginx') || tags.includes('apache') || tLower.includes('nginx') || tLower.includes('apache') || tLower.includes('502') || tLower.includes('504')) {
    return `\`\`\`bash
# 1. Verificar la sintaxis de los archivos de configuración
sudo nginx -t

# 2. Consultar las últimas 50 líneas del registro de errores en tiempo real
sudo tail -n 50 /var/log/nginx/error.log

# 3. Comprobar qué procesos están escuchando en los puertos HTTP/HTTPS
sudo ss -tulpn | grep -E ':(80|443|3000|8080|9000)'
\`\`\`

- El comando \`nginx -t\` valida la sintaxis de todos los bloques \`server\` y \`location\` incluidos, confirmando si los certificados SSL y las rutas de sockets existen en el disco sin interrumpir el servicio activo.
- El comando \`ss\` con los flags \`-t\` (TCP), \`-u\` (UDP), \`-l\` (listening), \`-p\` (procesos y PIDs asociados) y \`-n\` (numérico sin resolución DNS inversa) identifica con precisión milimétrica si otro servicio está ocupando el puerto o si el backend está inactivo.`;
  }

  if (tags.includes('git') || tLower.includes('git')) {
    return `\`\`\`bash
# 1. Inspeccionar el estado del árbol de trabajo y el área de preparación
git status --short --branch

# 2. Visualizar los últimos commits del historial de forma gráfica y compacta
git log --oneline --graph --decorate -n 10

# 3. Comprobar referencias de bloqueo activas en el repositorio
ls -la .git/*.lock .git/refs/heads/*.lock 2>/dev/null
\`\`\`

- El flag \`--short\` en \`git status\` resume en dos caracteres por archivo el estado entre el staging index y el directorio de trabajo, facilitando identificar archivos en conflicto (\`UU\`) o no rastreados (\`??\`).
- El comando \`git log\` con los parámetros \`--oneline\` (un commit por línea), \`--graph\` (diagrama ASCII del árbol) y \`-n 10\` muestra la topología de las ramas y el punto exacto de divergencia con el repositorio remoto.`;
  }

  if (tags.includes('gaming') || tags.includes('proton') || tags.includes('vulkan')) {
    return `\`\`\`bash
# 1. Verificar la detección de la GPU y capacidades de Vulkan
vulkaninfo --summary

# 2. Inspeccionar mensajes del kernel en busca de errores del controlador gráfico
sudo dmesg -T | grep -E "(amdgpu|nvidia|drm|gpu|hang)" | tail -n 25

# 3. Comprobar la versión activa de los controladores de renderizado Mesa / NVIDIA
glxinfo -B | grep -E "(OpenGL renderer|OpenGL core profile version)"
\`\`\`

- \`vulkaninfo --summary\` extrae un reporte conciso de las instancias, capas de validación y extensiones disponibles en el hardware gráfico sin saturar la pantalla con miles de líneas.
- El comando \`dmesg\` con el flag \`-T\` traduce las marcas de tiempo del buffer del kernel a fechas legibles por humanos, permitiendo identificar al instante si se produjo un reinicio de la GPU (*GPU hang/reset*) por sobrecalentamiento o caída del driver.`;
  }

  // Default Linux inspection commands
  return `\`\`\`bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l NOMBRE_SERVICIO

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u NOMBRE_SERVICIO -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
\`\`\`

- El flag \`--no-pager\` en \`systemctl\` y \`journalctl\` evita invocar el paginador interactivo (\`less\`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando \`df\` con los modificadores \`-T\` (tipo de sistema de archivos ext4/xfs/btrfs) y \`-h\` (formato legible en gigabytes/megabytes), combinado con \`-i\` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.`;
}

function getTroubleshootingAndEdgeCases(fm) {
  const tags = (fm.tags || []).map(t => t.toLowerCase());
  const tLower = (fm.title + ' ' + (fm.description || '')).toLowerCase();

  return `### Caso Borde 1: Restricciones de seguridad aplicadas por SELinux o AppArmor

En distribuciones de clase empresarial como Red Hat Enterprise Linux, AlmaLinux o Rocky Linux (que utilizan **SELinux** en modo Enforcing) o en Ubuntu/Debian (que implementan **AppArmor**), las políticas de confinamiento del sistema operativo pueden bloquear el acceso a archivos, sockets UNIX o puertos de red incluso cuando los permisos tradicionales \`chmod 777\` y el usuario \`root\` están en uso.

Para verificar y solventar bloqueos por contexto de seguridad:
\`\`\`bash
# Consultar si SELinux generó denegaciones recientes en el log de auditoría
sudo ausearch -m avc -ts recent 2>/dev/null

# En caso de AppArmor, revisar eventos bloqueados en el diario del kernel
sudo dmesg | grep -i apparmor | tail -n 20
\`\`\`
Si se confirma una denegación de contexto en SELinux, restaura el contexto de seguridad predeterminado del archivo o directorio afectado ejecutando:
\`\`\`bash
# Restaurar etiquetas de contexto de seguridad recursivamente
sudo restorecon -Rv /ruta/afectada
\`\`\`

### Caso Borde 2: Persistencia tras reinicio y desincronización de procesos huérfanos

En ocasiones, tras aplicar una solución en caliente en la terminal, el problema reaparece inesperadamente en el siguiente reinicio del servidor o al finalizar la sesión SSH. Esto ocurre comúnmente cuando existen procesos huérfanos (*zombie processes*) que retienen el bloqueo de archivos o sockets en memoria sin permitir que el nuevo servicio tome control del recurso.

Para identificar y limpiar procesos bloqueados de forma segura:
\`\`\`bash
# Identificar qué proceso tiene abierto el descriptor de archivo o socket
sudo lsof +D /ruta/o/archivo/afectado

# Si es necesario liberar el proceso huérfano de manera ordenada (señal SIGTERM)
sudo kill -15 PID_DEL_PROCESO
\`\`\`

### Verificación de Logs en Tiempo Real y Validación en Producción

Una vez aplicadas las modificaciones correctivas, valida en consola que el sistema opere con total estabilidad y sin emitir advertencias residuales:
\`\`\`bash
# Monitorear registros en vivo filtrando por palabras clave de fallo
sudo journalctl -f -n 100 | grep -Ei "(error|fail|warn|critical)"

# Verificar que el código de retorno del último comando ejecutado sea exitoso (0)
echo $?
\`\`\`
Un valor de retorno \`0\` confirma la ejecución exitosa en el estándar POSIX, garantizando que el servicio o comando ha completado su ciclo sin excepciones pendientes.`;
}

// Process a single file
function expandPost(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  const { data: fm, content: rawContent } = matter(fileContent);

  // Check if already expanded (>800 words and has new sections)
  const currentWords = countWords(rawContent);
  if (currentWords >= 850 && rawContent.includes('## Contexto de Arquitectura y Causa Raíz del Fallo') && rawContent.includes('## Casos Borde (Troubleshooting) y Prácticas en Producción')) {
    console.log(`[SKIP] ${filename} ya está expandido (${currentWords} palabras).`);
    return { filename, words: currentWords, status: 'skipped' };
  }

  // Parse existing components
  // 1. Intro: everything before first ##
  const firstH2Match = rawContent.match(/^##\s+/m);
  let originalIntro = '';
  let restOfContent = rawContent;

  if (firstH2Match) {
    originalIntro = rawContent.substring(0, firstH2Match.index).trim();
    restOfContent = rawContent.substring(firstH2Match.index).trim();
  } else {
    originalIntro = rawContent.trim();
    restOfContent = '';
  }

  // 2. Extract existing table
  let existingTable = '';
  const tableMatch = restOfContent.match(/\|[\s\S]*?\|\n\|[-|\s]+\|\n(?:\|[\s\S]*?\|\n?)+/);
  if (tableMatch) {
    existingTable = tableMatch[0].trim();
  }

  // 3. Extract existing steps
  let existingSteps = '';
  const solMatch = restOfContent.match(/##\s*[^#\n]*(?:Solución|Solucion|Cómo|Como|Implementation|Paso a Paso)[\s\S]*?(?=(?:##\s*[^#\n]*(?:Prevención|Prevencion|Prevention|Consejo)|$))/i);
  if (solMatch) {
    existingSteps = solMatch[0].replace(/^##[^\n]*\n/, '').trim();
  } else {
    // If not found, look for whatever is between table and prevention
    existingSteps = restOfContent.replace(/##\s*Diagnóstico[\s\S]*?(?=\n###|\n##\s*🚀|\n##\s*Cómo|$)/i, '').trim();
  }

  // 4. Extract existing prevention tips
  let existingPrevention = '';
  const prevMatch = restOfContent.match(/##\s*[^#\n]*(?:Prevención|Prevencion|Prevention|Consejo)[\s\S]*$/i);
  if (prevMatch) {
    existingPrevention = prevMatch[0].replace(/^##[^\n]*\n/, '').trim();
  }

  // Now construct the enhanced, professional article
  const architectureSection = getArchitectureContext(fm, rawContent);
  const diagInspection = getConsoleDiagnosticSection(fm);
  const troubleshootingSection = getTroubleshootingAndEdgeCases(fm);

  // If no table was found, provide a clean fallback diagnostic matrix
  let tableSection = existingTable;
  if (!tableSection) {
    tableSection = `| Síntoma Observado | Componente Afectado | Causa Raíz Primaria | Acción Correctiva Inmediata |
|---|---|---|---|
| Fallo o excepción reportada en consola | Sistema / Runtime | Desajuste en configuración, permisos o dependencias | Aplicar las directivas y comandos detallados en la solución técnica |`;
  }

  // Format steps: ensure "## Implementación Técnica Paso a Paso" heading
  let formattedSteps = existingSteps;
  if (!formattedSteps || formattedSteps.length < 50) {
    formattedSteps = `### Paso 1: Localizar y auditar el archivo de configuración o servicio
Antes de efectuar modificaciones, realiza un respaldo del archivo de configuración para permitir una reversión inmediata si fuese necesario:
\`\`\`bash
# Crear copia de seguridad preventiva
sudo cp /ruta/al/archivo /ruta/al/archivo.bak
\`\`\`

### Paso 2: Aplicar la corrección técnica recomendada
Edita el archivo de configuración ajustando los parámetros pertinentes según lo analizado en el diagnóstico:
\`\`\`bash
# Abrir editor con permisos adecuados
sudo nano /ruta/al/archivo
\`\`\`

### Paso 3: Reiniciar el servicio y validar la recarga de configuración
Aplica los cambios reiniciando el demonio o compilando nuevamente el proyecto:
\`\`\`bash
# Recargar configuración sin interrumpir el servicio
sudo systemctl reload NOMBRE_SERVICIO || sudo systemctl restart NOMBRE_SERVICIO
\`\`\``;
  }

  // Clean formattedSteps of any duplicate "## Cómo solucionar" headers
  formattedSteps = formattedSteps.replace(/^##[^\n]*\n/g, '').trim();

  // Format prevention
  let preventionBlock = '';
  if (existingPrevention && existingPrevention.length > 20) {
    preventionBlock = `\n\n## 🛡️ Consejos de Prevención\n\n${existingPrevention}`;
  } else {
    preventionBlock = `\n\n## 🛡️ Consejos de Prevención\n\n- **Automatización de respaldos:** Mantén copias de seguridad de las configuraciones y estados críticos antes de aplicar parches o actualizaciones masivas.
- **Auditoría periódica de logs:** Establece alertas tempranas ante códigos de error HTTP 5xx o excepciones de software mediante herramientas como Prometheus, Grafana o logs centralizados.
- **Principio de mínimo privilegio:** No asignes permisos \`777\` indiscriminadamente; utiliza permisos granulares como \`644\` para archivos estáticos y \`755\` para directorios.`;
  }

  // Build the complete markdown text
  const newMarkdownBody = `${originalIntro}

## Análisis de Arquitectura y Causa Raíz

${architectureSection}

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

${tableSection}

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

${diagInspection}

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

${formattedSteps}

## Resolución de Casos Borde (Troubleshooting)

${troubleshootingSection}${preventionBlock}
`;

  // Update readTime
  const totalWords = countWords(newMarkdownBody);
  const calculatedReadTime = `${Math.max(6, Math.ceil(totalWords / 200))} min`;

  const updatedFrontmatter = {
    ...fm,
    readTime: calculatedReadTime
  };

  const updatedFileContent = matter.stringify(newMarkdownBody, updatedFrontmatter);
  fs.writeFileSync(filePath, updatedFileContent, 'utf-8');

  console.log(`[EXPANDED] ${filename} -> ${totalWords} palabras (Read Time: ${calculatedReadTime})`);
  return { filename, words: totalWords, status: 'expanded' };
}

function run() {
  console.log('--- Iniciando Expansor Técnico Editorial de Artículos ---');
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).sort();

  let expandedCount = 0;
  let skippedCount = 0;
  let underCount = 0;

  for (const file of files) {
    const fullPath = path.join(POSTS_DIR, file);
    const result = expandPost(fullPath);
    if (result.status === 'expanded') expandedCount++;
    else skippedCount++;

    if (result.words < 800) {
      console.warn(`[ALERTA] ${file} tiene ${result.words} palabras (menor a 800).`);
      underCount++;
    }
  }

  console.log('--- Resumen de Expansión Editorial ---');
  console.log(`Total artículos: ${files.length}`);
  console.log(`Expandidos: ${expandedCount}`);
  console.log(`Omitidos (ya cumplían): ${skippedCount}`);
  console.log(`Artículos con menos de 800 palabras: ${underCount}`);
}

run();

export { expandPost, run };
