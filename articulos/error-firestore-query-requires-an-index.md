---
title: 'Cómo resolver: The query requires an index en Cloud Firestore'
description: >-
  Aprende a solucionar el error de índice compuesto faltante en consultas
  complejas de Firebase Cloud Firestore paso a paso.
category: Web y Código
tags:
  - Firebase
  - Cloud Firestore
  - JavaScript
  - NoSQL
  - Bases de Datos
readTime: 8 min
date: '2026-08-19'
---
El error FAILED_PRECONDITION: The query requires an index en Cloud Firestore se genera cuando ejecutas una consulta compleja que combina cláusulas where() sobre múltiples campos distintos o mezcla un filtro de rango/desigualdad (<, <=, >, >=) con una ordenación orderBy() en un campo diferente. Por diseño NoSQL, Firestore exige un índice compuesto previo para garantizar un rendimiento constante en tiempo de consulta O(N).

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
| **Consulta compuesta en Firestore que combina múltiples campos con filtros de desigualdad o diferente orden** | Create composite index via direct link in error log or Firebase Console |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l firestore-emulator

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u firestore-emulator -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

La forma más rápida de solucionar el problema durante la etapa de desarrollo es hacer clic directamente en la URL proporcionada en el mensaje de error de tu terminal o consola del navegador:
```javascript
// Ejemplo de consulta que detona el error sin índice:
const q = query(
  collection(db, "pedidos"),
  where("estado", "==", "completado"),
  where("total", ">", 100),
  orderBy("total", "desc")
);
```
1. Copia el enlace que acompaña al error The query requires an index. You can create it here: ...
2. Pégalo en tu navegador. Firebase Console abrirá la pantalla de creación con todos los campos y modos de ordenación preconfigurados.
3. Haz clic en **Crear índice** (Create Index) y espera entre 1 y 3 minutos a que el estado cambie de Building a Enabled.

### Paso 2: Declarar el índice de forma persistente en firestore.indexes.json
Para entornos de integración continua (CI/CD) y producción, define el índice en tu proyecto local para evitar que se pierda en despliegues posteriores:
```json
{
  "indexes": [
    {
      "collectionGroup": "pedidos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "total", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Paso 3: Desplegar los índices con la CLI de Firebase
Una vez guardado tu archivo firestore.indexes.json, publica las reglas e índices directamente a tu base de datos:
```bash
# Desplegar únicamente los índices de Cloud Firestore
npx firebase deploy --only firestore:indexes
```

### Paso 4: Validar la ejecución de la consulta
Comprueba que tu aplicación ya no arroja la excepción FAILED_PRECONDITION y procesa los documentos normalmente.

## 🛡️ Consejos de Prevención

- **Optimiza tus modelos de datos:** Evita crear consultas que filtren por más de 3 o 4 campos variables si puedes consolidar estados en un solo campo indexable (por ejemplo, usar un array de etiquetas o un campo compuesto tipo estado_region: "completado_latam").
- **Controla el límite de índices:** Firestore tiene un límite máximo de 200 índices compuestos por base de datos. Mantén limpio tu archivo firestore.indexes.json eliminando índices obsoletos.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Cuánto tiempo tarda en construirse un índice compuesto?
En colecciones pequeñas tarda menos de 60 segundos. En colecciones con millones de documentos, el proceso en segundo plano puede demorar entre 10 y 30 minutos sin interrumpir las demás operaciones de lectura y escritura.

### ¿Las consultas simples de un solo campo requieren crear índices compuestos?
No. Firestore crea índices simples de campo único de forma automática para todos los campos de tus documentos en orden ascendente y descendente.
