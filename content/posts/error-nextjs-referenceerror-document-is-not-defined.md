---
title: 'Solución Error Next.js ReferenceError: document is not defined (App Router y SSR)'
description: >-
  Aprende a solucionar el error 'ReferenceError: document is not defined' y 'window is not defined' en Next.js App Router con dynamic imports y useEffect.
category: Web y Código
tags:
  - Next.js
  - React
  - SSR
  - JavaScript
  - TypeScript
  - Frontend
readTime: 4 min
date: '2026-10-26'
---

El error `ReferenceError: document is not defined` (o su variante `ReferenceError: window is not defined`) es una de las excepciones más comunes en aplicaciones construidas con Next.js (tanto en Pages Router como en App Router). Este fallo se produce cuando código JavaScript intenta interactuar con las API del Document Object Model (DOM) del navegador durante la fase de Server-Side Rendering (SSR) o durante la compilación en el servidor con Node.js, donde los objetos globales `window` y `document` no existen.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **Acceso directo a document o window en el cuerpo principal de un componente** | Mover la lógica que interactúa con el DOM al hook useEffect o validar typeof window !== 'undefined' |
| **Librería externa de UI o gráficos (Leaflet, Chart.js, canvas) evaluada en el servidor** | Importar el componente de manera dinámica usando next/dynamic con la opción ssr: false |
| **Componente de cliente sin directiva en Next.js App Router** | Agregar la directiva 'use client' en la primera línea del archivo correspondiente |

## La Solución Paso a Paso

### Paso 1: Declarar el componente como Client Component con 'use client'
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

## Consejos de Prevención

* Nunca accedas a `document.getElementById`, `window.location` o `navigator.userAgent` en el ámbito global del archivo ni en el cuerpo directo de funciones de componentes.
* Utiliza Server Components para recuperar datos y generar el marcado semántico, delegando las interacciones DOM a componentes hoja (*leaf components*) clientes.
* Configura ESLint con la regla `react-hooks/exhaustive-deps` para gestionar adecuadamente las dependencias de los hooks que consultan el entorno del navegador.
