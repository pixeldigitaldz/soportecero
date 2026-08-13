---
title: 'Error: Quota exceeded for quota metric Read requests en Firestore'
description: 'Aprende a diagnosticar por qué superaste tu límite de lecturas gratuitas en Firebase y cómo arreglar los bucles infinitos en tu frontend.'
category: 'Web y Código'
date: '2026-08-18'
readTime: '3 min'
tags: ['Firebase', 'Firestore', 'React']
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Bucle infinito en `useEffect` (React)** | Añadir las dependencias correctas al array `[]` del hook |
| **Escuchador (`onSnapshot`) duplicado** | Desuscribirse del escuchador al desmontar el componente |
| **Lectura de demasiados documentos** | Usar paginación (`limit`, `startAfter`) en lugar de traer toda la colección |

## La Solución Paso a Paso

**Revisa tus hooks de React (o framework similar)**
La causa número uno de este error (superar las 50,000 lecturas gratuitas diarias en segundos) es un `useEffect` mal configurado. Si haces un `getDocs` dentro de un efecto y este actualiza el estado sin un array de dependencias correcto, el componente se re-renderizará infinitamente.
*Incorrecto:*
```javascript
useEffect(() => {
  fetchData();
}); // <- Falta el array de dependencias
```
*Correcto:*
```javascript
useEffect(() => {
  fetchData();
}, []); // <- Se ejecuta solo una vez al montar
```

**Limpia tus listeners en tiempo real**
Si usas `onSnapshot` para escuchar cambios en tiempo real, Firebase te cobrará una lectura por cada documento inicialmente. Pero si el componente se desmonta y vuelve a montar sin limpiar el listener anterior, crearás múltiples conexiones fantasma.
Asegúrate de retornar la función de limpieza:
```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, "cities"), (snapshot) => {
    // ...
  });

  return () => unsubscribe(); // Limpieza vital al desmontar
}, []);
```

**Revisa el uso de la consola de Firebase**
Curiosamente, dejar abierta la pestaña de Cloud Firestore en la consola web de Firebase cuenta como lecturas. Si tienes una colección que cambia muy rápido y tienes la consola abierta durante horas, agotarás tu cuota rápidamente sin darte cuenta. 

## Prevención
- **Paginación:** Nunca traigas colecciones enteras. Usa `.limit(20)` y paginación para traer solo lo que el usuario ve.
- **Caché Local:** Habilita la persistencia offline en Firestore para que las lecturas recurrentes vengan del caché local del navegador en lugar de facturar lecturas al servidor: `enableIndexedDbPersistence(db)`.
