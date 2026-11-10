---
title: Error Quota exceeded for quota metric Read requests en Firestore
description: >-
  Aprende a solucionar el error de cuota excedida de lecturas en Cloud Firestore
  implementando caché local, paginación y agregaciones.
category: Web y Código
tags:
  - Firebase
  - Cloud Firestore
  - JavaScript
  - Optimización
  - NoSQL
  - Cloud
readTime: 7 min
date: '2026-06-25'
---
El error `RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Read requests' and limit 'Read requests per day' of service 'firestore.googleapis.com'` ocurre cuando tu aplicación supera el límite diario de 50.000 lecturas gratuitas del plan Spark o la cuota configurada en tu cuenta de Cloud Firestore. Esto bloquea inmediatamente todas las consultas de lectura en tu base de datos hasta el siguiente ciclo de 24 horas.

## Análisis de Arquitectura y Causa Raíz

El sistema de control de versiones **Git** opera como una base de datos de objetos direccionables por contenido criptográfico (hashes SHA-1 / SHA-256) respaldada por un grafo acíclico dirigido (DAG). La integridad del repositorio descansa en el directorio interno `.git/`, donde se almacenan cuatro tipos de objetos atómicos: **blobs** (contenido puro de archivos), **trees** (representación de directorios y permisos POSIX), **commits** (metadatos del autor, mensaje y puntero al árbol raíz) y **annotated tags**.

La causa raíz de esta incidencia se produce por una alteración en los punteros de referencia o en el mecanismo de bloqueo transaccional del árbol de trabajo:
1. **Mecanismo de Lockfiles atómicos (`.git/*.lock`):** Para garantizar la atomicidad en operaciones concurrentes y evitar condiciones de carrera (*race conditions*), Git genera archivos efímeros de bloqueo (ej. `.git/refs/heads/main.lock` o `.git/index.lock`) antes de mutar cualquier puntero o actualizar el área de preparación (*staging index*). Si un proceso de Git finaliza inesperadamente (por apagado forzado, corte de IDE o fallo de memoria), el lockfile permanece huérfano en el sistema de archivos, impidiendo cualquier operación de lectura/escritura posterior con un error de bloqueo crítico.
2. **Desincronización del grafo DAG y divergencia de ramas:** Durante procesos de `rebase` o `cherry-pick`, Git reescribe la historia aplicando commits de forma secuencial sobre un nuevo commit base. Si se detectan cambios incompatibles en los mismos bloques de código sin un ancestro común directo (o si se fuerza la unión de árboles de commits independientes creados desde cero), el algoritmo de merge trifásico (*three-way merge*) detiene la ejecución para proteger la integridad del historial, dejando al repositorio en un estado transicional (`REBASE-i`, `MERGING` o `DETACHED HEAD`).
3. **Capa de transporte SSL/TLS y validación de certificados:** Al interactuar con remotos a través de HTTPS, el cliente Git delega la autenticación en la librería local `libcurl` y el almacén de certificados CA del sistema operativo. Si la cadena de certificación intermedia no se resuelve o existen desajustes en el reloj del sistema, el handshake criptográfico se cancela de inmediato.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Consumo masivo de lecturas por listeners en tiempo real (`onSnapshot`) descontrolados o consultas sin paginar** |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l NOMBRE_SERVICIO

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u NOMBRE_SERVICIO -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

Evita que los usuarios consuman lecturas de red cada vez que recargan la página activando el almacenamiento en caché local:
```javascript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Inicializar Firestore con persistencia multi-pestaña
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

### Paso 2: Implementar paginación estricta en consultas
Nunca descargues colecciones completas. Divide las consultas en bloques pequeños (ej. de 10 a 20 documentos):
```javascript
import { collection, query, orderBy, startAfter, limit, getDocs } from "firebase/firestore";

// Consulta paginada eficiente
async function obtenerPagina(ultimoDocumentoVisible = null) {
  let q = query(
    collection(db, "articulos"),
    orderBy("fecha", "desc"),
    limit(15)
  );

  if (ultimoDocumentoVisible) {
    q = query(q, startAfter(ultimoDocumentoVisible));
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const ultimoDoc = snapshot.docs[snapshot.docs.length - 1];

  return { items, ultimoDoc };
}
```

### Paso 3: Usar consultas de agregación para contar documentos
Para contar registros, no descargues todos los documentos; utiliza `getCountFromServer()`, que solo cuenta como **1 sola lectura** sin importar el tamaño de la colección:
```javascript
import { collection, getCountFromServer } from "firebase/firestore";

// Contar millones de documentos consumiendo solo 1 lectura
const coll = collection(db, "pedidos");
const snapshot = await getCountFromServer(coll);
console.log("Total de pedidos:", snapshot.data().count);
```

### Paso 4: Desuscribir listeners onSnapshot cuando se desmonte el componente
En aplicaciones React o Vue, los listeners no liberados generan lecturas infinitas en segundo plano:
```javascript
// En React useEffect:
useEffect(() => {
  const unsubscribe = onSnapshot(doc(db, "chats", chatId), (doc) => {
    setMensajes(doc.data());
  });

  // Limpiar el listener al desmontar el componente
  return () => unsubscribe();
}, [chatId]);
```

## Resolución de Casos Borde (Troubleshooting)

### Caso Borde 1: Restricciones de seguridad aplicadas por SELinux o AppArmor

En distribuciones de clase empresarial como Red Hat Enterprise Linux, AlmaLinux o Rocky Linux (que utilizan **SELinux** en modo Enforcing) o en Ubuntu/Debian (que implementan **AppArmor**), las políticas de confinamiento del sistema operativo pueden bloquear el acceso a archivos, sockets UNIX o puertos de red incluso cuando los permisos tradicionales `chmod 777` y el usuario `root` están en uso.

Para verificar y solventar bloqueos por contexto de seguridad:
```bash
# Consultar si SELinux generó denegaciones recientes en el log de auditoría
sudo ausearch -m avc -ts recent 2>/dev/null

# En caso de AppArmor, revisar eventos bloqueados en el diario del kernel
sudo dmesg | grep -i apparmor | tail -n 20
```
Si se confirma una denegación de contexto en SELinux, restaura el contexto de seguridad predeterminado del archivo o directorio afectado ejecutando:
```bash
# Restaurar etiquetas de contexto de seguridad recursivamente
sudo restorecon -Rv /ruta/afectada
```

### Caso Borde 2: Persistencia tras reinicio y desincronización de procesos huérfanos

En ocasiones, tras aplicar una solución en caliente en la terminal, el problema reaparece inesperadamente en el siguiente reinicio del servidor o al finalizar la sesión SSH. Esto ocurre comúnmente cuando existen procesos huérfanos (*zombie processes*) que retienen el bloqueo de archivos o sockets en memoria sin permitir que el nuevo servicio tome control del recurso.

Para identificar y limpiar procesos bloqueados de forma segura:
```bash
# Identificar qué proceso tiene abierto el descriptor de archivo o socket
sudo lsof +D /ruta/o/archivo/afectado

# Si es necesario liberar el proceso huérfano de manera ordenada (señal SIGTERM)
sudo kill -15 PID_DEL_PROCESO
```

### Verificación de Logs en Tiempo Real y Validación en Producción

Una vez aplicadas las modificaciones correctivas, valida en consola que el sistema opere con total estabilidad y sin emitir advertencias residuales:
```bash
# Monitorear registros en vivo filtrando por palabras clave de fallo
sudo journalctl -f -n 100 | grep -Ei "(error|fail|warn|critical)"

# Verificar que el código de retorno del último comando ejecutado sea exitoso (0)
echo $?
```
Un valor de retorno `0` confirma la ejecución exitosa en el estándar POSIX, garantizando que el servicio o comando ha completado su ciclo sin excepciones pendientes.

## 🛡️ Consejos de Prevención

- **Configura alertas de presupuesto en Google Cloud:** Crea un presupuesto de $5 o $10 en GCP Cloud Billing para recibir avisos por correo antes de agotar cuotas.
- **Desnormaliza datos frecuentes:** Guarda contadores y datos agregados dentro del documento principal para evitar lecturas cruzadas.

## ❓ Preguntas Frecuentes (FAQ)

### ¿A qué hora se reinicia la cuota diaria del plan gratuito de Firestore?
La cuota del plan Spark se reinicia a medianoche en hora del Pacífico (PST/PDT), correspondiente a las 00:00 UTC-8.

### ¿Las lecturas desde la caché local cuentan para la cuota de Firebase?
No. Cualquier documento recuperado desde la caché de IndexedDB del navegador no consume lecturas de red ni genera costes en Firestore.
