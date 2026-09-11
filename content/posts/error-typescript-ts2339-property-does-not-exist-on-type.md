---
title: "[SOLUCIONADO] Error TypeScript TS2339: Property does not exist on type"
description: "Guía para solucionar el error de TypeScript TS2339 Property does not exist on type en objetos, interfaces, window y eventos de React."
category: "Web y Código"
tags: ["TypeScript","JavaScript","React","Frontend"]
readTime: "4 min"
date: "2026-10-17"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Acceso a propiedades dinámicas en objetos tipados estrictamente sin firmas de índice** | Definir una interfaz con tipos opcionales o usar firmas de índice [key: string]: any |
| **Añadir variables globales al objeto window sin extender la interfaz global de Window** | Declarar la propiedad en un archivo global.d.ts extendiendo interface Window |

Uno de los errores más comunes y frustrantes al compilar código con TypeScript es `error TS2339: Property '...' does not exist on type '...'`. El comprobador de tipos estático detecta que estás intentando acceder a una propiedad que no fue declarada explícitamente en la interfaz o tipo del objeto, deteniendo la compilación.

> **Solución Rápida (1 Minuto):**
> 1. Para objetos dinámicos, añade una firma de índice:
>    `interface MiObjeto { [key: string]: unknown; }`
> 2. Para propiedades globales en window, extiéndelo en un archivo .d.ts.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Tipar interfaces con propiedades opcionales o índice dinámico
Si recibes un objeto de una API con campos variables, declara una interfaz adecuada:
```typescript
// En lugar de un tipo cerrado
interface Usuario {
  id: number;
  nombre: string;
  // Propiedad opcional
  avatar?: string;
  // Permite propiedades dinámicas adicionales
  [key: string]: unknown;
}

const u: Usuario = { id: 1, nombre: "Elena", rol: "Admin" };
console.log(u.rol); // Compila perfectamente sin error TS2339
```

### Paso 2: Extender el objeto global window en TypeScript
Si utilizas librerías externas o scripts de analítica (Google Analytics, Stripe, PayPal) que agregan variables a `window`:
```typescript
// Crea o edita el archivo types/global.d.ts
export {};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    MiVariableGlobal?: string;
  }
}
```
Asegúrate de que `types/global.d.ts` esté incluido en la matriz `include` de tu archivo `tsconfig.json`.

### Paso 3: Resolver el error en eventos de React (HTMLInputElement)
Al manejar eventos de formulario en React, el error TS2339 aparece al intentar leer `e.target.value` en eventos genéricos:
```typescript
// Incorrecto: e: React.SyntheticEvent
// Correcto: especificar el elemento HTML exacto
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value); // TS reconoce 'value' sin errores
};
```

## 🛡️ Consejo de Prevención
* Evita recurrir a `as any` para silenciar el error; debilita toda la seguridad de tipos de tu aplicación.
* Utiliza guardas de tipo (`if ('prop' in obj)`) antes de acceder a propiedades en tipos de unión.

## Preguntas Frecuentes

### ¿Por qué no debo usar "as any" para resolver TS2339?
Porque anula la verificación estática de TypeScript para esa variable, impidiendo que el autocompletado y el compilador te avisen si la propiedad cambia de nombre o se borra en el futuro.

### ¿Cómo compruebo si una propiedad existe en runtime de forma segura?
Utiliza el operador `in`: `if ("propiedad" in objeto) { console.log(objeto.propiedad); }`. TypeScript reducirá automáticamente el tipo dentro del bloque condicional.
