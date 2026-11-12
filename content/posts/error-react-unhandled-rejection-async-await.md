---
title: Cómo solucionar el error Unhandled Promise Rejection en React y Async/Await
description: >-
  Guía técnica para identificar y solucionar el error Unhandled Promise
  Rejection en aplicaciones React al utilizar funciones asíncronas con
  async/await y fetch.
category: Web y Código
tags:
  - React
  - JavaScript
  - Web
readTime: 8 min
date: '2026-08-03'
---
El mensaje de error **"Unhandled Promise Rejection"** (o `Uncaught (in promise)`) ocurre en aplicaciones React y JavaScript cuando una Promesa es rechazada (debido a un error de red, respuesta HTTP no válida o fallo en la lógica interna) pero no existe un bloque `.catch()` o una instrucción `try...catch` adecuada para capturar la excepción. En React, esto puede causar cierres inesperados de componentes, estados desincronizados o pantallas en blanco en producción.

## Análisis de Arquitectura y Causa Raíz

En el ecosistema de **Node.js** y compiladores modernos de **JavaScript / TypeScript** (como `tsc`, `esbuild` o `swc`), la ejecución del código transcurre sobre el motor **V8** de Google acoplado a la librería de abstracción de E/S **libuv**, la cual gestiona el bucle de eventos (*Event Loop*) y el pool de hilos para operaciones asíncronas de red y sistema de archivos.

La causa raíz de esta incidencia proviene de desalineaciones en la resolución de módulos, el árbol de tipado AST o la frontera de renderizado:
1. **Árbol de resolución de dependencias y conflictos de pares (`peerDependencies`):** El gestor de paquetes (`npm` v7+) implementa un algoritmo determinista para construir el árbol de módulos en `node_modules`. Cuando dos paquetes requieren versiones mayores distintas de una misma librería compartida como dependencia de pares, el algoritmo de resolución rechaza forzar la instalación para prevenir colisiones en tiempo de ejecución, lanzando el error de conflicto de pares (`ERESOLVE`).
2. **Fase de hidratación y renderizado isomórfico (SSR vs Client):** En frameworks como Next.js o Remix, el código se ejecuta inicialmente en el servidor (entorno Node.js sin interfaz gráfica) antes de compilarse y enviarse al navegador. Si el código fuente intenta acceder a objetos globales del DOM como `window`, `document` o `localStorage` antes del montaje del componente en el cliente (`useEffect`), el motor lanza de inmediato una excepción crítica `ReferenceError: document is not defined` durante el Server-Side Rendering.
3. **Mapeo del Sistema de Tipos AST en TypeScript:** El compilador de TypeScript (`tsc`) genera un árbol de sintaxis abstracta (*Abstract Syntax Tree*) y valida la correspondencia de tipos en tiempo de transpilación. Si una interfaz carece de una definición de propiedad explícita o se utiliza una librería de JavaScript que no expone declaraciones de tipos (`@types/*`), el verificador de tipos emite el error TS2339 para salvaguardar la seguridad de tipos (*type safety*), bloqueando la compilación del proyecto.

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Excepción `Uncaught (in promise) Error` en la consola del navegador al enviar un formulario o cargar datos**: Función `async` ejecutada sin envolver las llamadas asíncronas en un bloque `try...catch` | Wrap `await` expressions inside `try...catch` blocks and manage error state |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l frontend-dev

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u frontend-dev -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

La causa más común es invocar un método asíncrono sin interceptar posibles fallos. Modifica tus controladores de eventos o funciones de consulta:

```javascript
// ❌ INCORRECTO: Si fetch o res.json() falla, la promesa colapsa sin control
const handleFetchData = async () => {
  const res = await fetch('/api/user-data');
  const data = await res.json();
  setUser(data);
};

// ✅ CORRECTO: Captura limpia con actualización de estado de error
const handleFetchData = async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/user-data');
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    setUser(data);
  } catch (err) {
    console.error('Fallo al obtener datos del usuario:', err.message);
    setError(err.message || 'Error de conexión');
  } finally {
    setLoading(false);
  }
};
```

### Paso 2: Manejar correctamente Promesas dentro de `useEffect`
En React, la función pasada a `useEffect` no puede ser declarada directamente como `async` (ya que debe retornar `undefined` o una función de limpieza). Define la función asíncrona dentro del hook:

```jsx
import React, { useState, useEffect } from 'react';

export const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true; // Previene memory leaks si el componente se desmonta

    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) throw new Error('Usuario no encontrado');
        const result = await response.json();
        
        if (isMounted) {
          setUser(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      }
    };

    fetchUserProfile();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (error) return <div className="error-banner">Error: {error}</div>;
  if (!user) return <div>Cargando...</div>;

  return <div>{user.name}</div>;
};
```

### Paso 3: Configurar un listener global para Unhandled Rejections (Fallback)
Como medida de seguridad para producción, registra un manejador global que capture cualquier rechazo no controlado en el objeto `window`:

```javascript
// En index.js / main.jsx / App.jsx
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn(`[Unhandled Rejection Detectado]: ${event.reason}`);
    // Opcional: Enviar reporte de error a Sentry o LogRocket
    // event.preventDefault(); // Previene la salida en consola si es deseado
  });
}
```

## 🛡️ Consejos de Prevención

- **Recuerda que `fetch()` no rechaza por códigos HTTP 404/500**: Comprueba siempre `response.ok` antes de transformar la respuesta a JSON o datos binarios.
- **Usa Axios si prefieres rechazo automático**: A diferencia de la Fetch API nativa, librerías como `axios` rechazan la Promesa automáticamente para cualquier respuesta fuera del rango 2xx.
- **Utiliza React Error Boundaries**: Combina el manejo local de Promesas con *Error Boundaries* en componentes de nivel superior para evitar que excepciones críticas rompan toda la interfaz de usuario.
