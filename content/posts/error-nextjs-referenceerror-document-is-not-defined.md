---
title: >-
  Solución Error Next.js ReferenceError: document is not defined (App Router y
  SSR)
description: >-
  Aprende a solucionar el error 'ReferenceError: document is not defined' y
  'window is not defined' en Next.js App Router con dynamic imports y useEffect.
category: Web y Código
tags:
  - Next.js
  - React
  - SSR
  - JavaScript
  - TypeScript
  - Frontend
readTime: 8 min
date: '2026-10-26'
---
El error `ReferenceError: document is not defined` (o su variante `ReferenceError: window is not defined`) es una de las excepciones más comunes en aplicaciones construidas con Next.js (tanto en Pages Router como en App Router). Este fallo se produce cuando código JavaScript intenta interactuar con las API del Document Object Model (DOM) del navegador durante la fase de Server-Side Rendering (SSR) o durante la compilación en el servidor con Node.js, donde los objetos globales `window` y `document` no existen.

## Contexto de Arquitectura y Causa Raíz del Fallo

En el ecosistema de **Node.js** y compiladores modernos de **JavaScript / TypeScript** (como `tsc`, `esbuild` o `swc`), la ejecución del código transcurre sobre el motor **V8** de Google acoplado a la librería de abstracción de E/S **libuv**, la cual gestiona el bucle de eventos (*Event Loop*) y el pool de hilos para operaciones asíncronas de red y sistema de archivos.

La causa raíz de esta incidencia proviene de desalineaciones en la resolución de módulos, el árbol de tipado AST o la frontera de renderizado:
1. **Árbol de resolución de dependencias y conflictos de pares (`peerDependencies`):** El gestor de paquetes (`npm` v7+) implementa un algoritmo determinista para construir el árbol de módulos en `node_modules`. Cuando dos paquetes requieren versiones mayores distintas de una misma librería compartida como dependencia de pares, el algoritmo de resolución rechaza forzar la instalación para prevenir colisiones en tiempo de ejecución, lanzando el error de conflicto de pares (`ERESOLVE`).
2. **Fase de hidratación y renderizado isomórfico (SSR vs Client):** En frameworks como Next.js o Remix, el código se ejecuta inicialmente en el servidor (entorno Node.js sin interfaz gráfica) antes de compilarse y enviarse al navegador. Si el código fuente intenta acceder a objetos globales del DOM como `window`, `document` o `localStorage` antes del montaje del componente en el cliente (`useEffect`), el motor lanza de inmediato una excepción crítica `ReferenceError: document is not defined` durante el Server-Side Rendering.
3. **Mapeo del Sistema de Tipos AST en TypeScript:** El compilador de TypeScript (`tsc`) genera un árbol de sintaxis abstracta (*Abstract Syntax Tree*) y valida la correspondencia de tipos en tiempo de transpilación. Si una interfaz carece de una definición de propiedad explícita o se utiliza una librería de JavaScript que no expone declaraciones de tipos (`@types/*`), el verificador de tipos emite el error TS2339 para salvaguardar la seguridad de tipos (*type safety*), bloqueando la compilación del proyecto.

## Entorno de Laboratorio y Diagnóstico Previo

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Acceso directo a document o window en el cuerpo principal de un componente** |

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

En el modelo App Router de Next.js (`app/`), todos los componentes son Server Components por defecto. Si tu componente necesita interactuar con eventos del navegador o APIs del cliente, declara la directiva en la línea 1:

```tsx
'use client';

import React, { useState } from 'react';

export default function ContadorInteractivo() {
  const [contador, setContador] = useState(0);

  return (
    <button onClick={() => setContador(contador + 1)}>
      Clics: {contador}
    </button>
  );
}
```

### Paso 2: Trasladar el acceso al DOM dentro de useEffect
Incluso con `'use client'`, el servidor pre-renderiza el HTML inicial ejecutando el cuerpo del componente. El hook `useEffect` garantiza que su contenido se ejecute exclusivamente en el navegador tras montar el componente:

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function AnchoPantalla() {
  const [ancho, setAncho] = useState<number | null>(null);

  useEffect(() => {
    // Seguro: solo se ejecuta en el navegador
    setAncho(window.innerWidth);

    const handleResize = () => setAncho(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (ancho === null) return <div>Calculando dimensión...</div>;

  return <p>Ancho de ventana: {ancho}px</p>;
}
```

### Paso 3: Cargar librerías de terceros con next/dynamic y ssr: false
Si una librería externa ejecuta llamadas a `document.createElement` o `window` en su inicialización (como librerías de mapas o editores de texto enriquecido), debes desactivar su renderizado en servidor mediante `next/dynamic`:

```tsx
'use client';

import dynamic from 'next/dynamic';

// Desactiva el Server-Side Rendering para este componente específico
const MapaInteractivo = dynamic(
  () => import('./ComponenteMapaLeaflet'),
  {
    ssr: false,
    loading: () => <p>Cargando visualización del mapa...</p>
  }
);

export default function PaginaUbicacion() {
  return (
    <section>
      <h1>Nuestra Ubicación</h1>
      <MapaInteractivo />
    </section>
  );
}
```

### Paso 4: Validar la existencia de window antes de leer almacenamiento o cookies
Si necesitas leer datos de `localStorage` o `sessionStorage` fuera de un efecto (por ejemplo, en funciones auxiliares), valida previamente el contexto de ejecución:

```typescript
export function obtenerTokenSeguro(): string | null {
  if (typeof window === 'undefined') {
    // Entorno de servidor: retorno seguro para evitar ReferenceError
    return null;
  }
  return localStorage.getItem('auth_token');
}
```

## Preguntas Frecuentes

### ¿Por qué 'use client' no evita el error de window is not defined?
La directiva `'use client'` define los límites entre Server y Client Components, pero Next.js sigue pre-renderizando el HTML inicial de los Client Components en el servidor para optimizar el First Contentful Paint. Si ejecutas `window` fuera de `useEffect`, fallará durante ese pre-renderizado.

### ¿Cómo afecta el uso de ssr: false al posicionamiento SEO de Google?
El contenido dentro de un componente con `ssr: false` no estará en el HTML inicial recibido por los motores de búsqueda. Es recomendable usar `ssr: false` únicamente para widgets interactivos, gráficos, paneles privados o mapas, manteniendo los encabezados, textos y metadatos principales como Server Components.

### ¿Qué diferencia hay entre typeof window !== 'undefined' y useEffect?
`typeof window !== 'undefined'` es una comprobación síncrona que indica si el código corre en Node.js o navegador, pero usarlo para renderizar condicionalmente en el cuerpo del componente puede causar un error de hidratación (*Hydration Mismatch*). `useEffect` es la solución canónica para sincronizar estado con el cliente sin romper la hidratación.

## Casos Borde (Troubleshooting) y Prácticas en Producción

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

* Nunca accedas a `document.getElementById`, `window.location` o `navigator.userAgent` en el ámbito global del archivo ni en el cuerpo directo de funciones de componentes.
* Utiliza Server Components para recuperar datos y generar el marcado semántico, delegando las interacciones DOM a componentes hoja (*leaf components*) clientes.
* Configura ESLint con la regla `react-hooks/exhaustive-deps` para gestionar adecuadamente las dependencias de los hooks que consultan el entorno del navegador.
