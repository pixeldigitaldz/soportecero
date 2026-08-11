---
title: 'Solución: The query requires an index en Cloud Firestore'
description: 'Aprende a resolver el error FAILED_PRECONDITION: The query requires an index al hacer búsquedas compuestas en Firebase.'
category: 'Web y Código'
date: '2026-08-19'
readTime: '2 min'
tags: ['Firebase', 'Firestore', 'Database']
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Consulta compuesta no indexada** | Hacer clic en el enlace que Firebase devuelve en el mensaje de error para crear el índice |
| **Falta de índices en despliegues** | Usar Firebase CLI para desplegar `firestore.indexes.json` |

## La Solución Paso a Paso

**Revisa el mensaje de error en la consola**
Cuando intentas hacer una consulta en Firestore que combina filtrados de igualdad (`==`) con desigualdades (`>`, `<`, `!=`) o múltiples ordenamientos (`orderBy`), Firestore te exigirá un índice compuesto.
El mensaje de error en la consola del navegador lucirá así:
`FirebaseError: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/...`

**Haz clic en el enlace autogenerado**
Firestore es extremadamente amigable. El propio error incluye una URL exacta. 
Simplemente copia y pega el enlace `https://console.firebase.google.com/...` en tu navegador. Esto te llevará directamente a la consola de Firebase con un modal ya prellenado con los campos exactos que necesitas indexar.

**Espera a que se construya el índice**
Una vez que hagas clic en "Crear" dentro de la consola, el estado del índice pasará a *Building* (Construyendo). Este proceso puede tardar desde unos minutos hasta un par de horas dependiendo del tamaño de tu colección. Cuando el estado cambie a *Enabled* (Habilitado), tu consulta funcionará inmediatamente sin cambiar nada de código.

## Prevención
- **Guarda tus índices en código:** Para evitar problemas al migrar de un entorno de pruebas a producción, usa el CLI de Firebase para descargar tus índices locales: `firebase firestore:indexes > firestore.indexes.json` y súbelos a tu control de versiones (Git).
- **Evita desigualdades excesivas:** Recuerda que Firestore solo permite una desigualdad por consulta (`<`, `<=`, `>`, `>=`, `!=`, `not-in`). Si necesitas filtros muy complejos en múltiples campos, tal vez necesites un motor de búsqueda externo como Algolia.
