---
title: Cómo solucionar el error Unhandled Promise Rejection en React y Async/Await
description: >-
  Guía técnica para identificar y solucionar el error Unhandled Promise Rejection en aplicaciones React al utilizar funciones asíncronas con async/await y fetch.
category: Web y Código
tags:
  - React
  - JavaScript
  - Web
readTime: 4 min
date: '2026-08-03'
---

El mensaje de error **"Unhandled Promise Rejection"** (o `Uncaught (in promise)`) ocurre en aplicaciones React y JavaScript cuando una Promesa es rechazada (debido a un error de red, respuesta HTTP no válida o fallo en la lógica interna) pero no existe un bloque `.catch()` o una instrucción `try...catch` adecuada para capturar la excepción. En React, esto puede causar cierres inesperados de componentes, estados desincronizados o pantallas en blanco en producción.

## 🔍 El Diagnóstico Rápido

| Síntoma | Causa Raíz | Solución |
| :--- | :--- | :--- |
| Excepción `Uncaught (in promise) Error` en la consola del navegador al enviar un formulario o cargar datos | Función `async` ejecutada sin envolver las llamadas asíncronas en un bloque `try...catch` | Envolver las llamadas `await` en bloques `try...catch` y gestionar el estado de error |
| Rejection no capturado dentro de un `useEffect` | Promesa lanzada dentro de un handler de evento o efecto que falta por retornar o tratar los errores | Crear una función interna `async` dentro del `useEffect` e implementar manejo de errores explícito |
| Errores 4xx/5xx de API no son detectados como rechazos en `fetch()` | `fetch()` no rechaza la promesa por códigos de estado HTTP de error (ej. 404 o 500) a menos que se fuerce manualmente | Validar `response.ok` antes de procesar el cuerpo JSON y lanzar un `Error` si es falso |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Capturar errores en funciones `async/await` con `try...catch...finally`
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
