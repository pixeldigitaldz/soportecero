---
title: "Cómo resolver: The query requires an index en Cloud Firestore"
description: "Aprende a solucionar el error de índice compuesto faltante en consultas complejas de Firebase Cloud Firestore paso a paso."
category: "Web y Código"
tags: ["Firebase", "Cloud Firestore", "JavaScript", "NoSQL", "Bases de Datos"]
readTime: "5 min"
date: "2026-08-19"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Consulta compuesta en Firestore que combina múltiples campos con filtros de desigualdad o diferente orden** | Crear el índice compuesto mediante el enlace directo generado en el log de error de la consola |
| **Índice compuesto faltante en el archivo de despliegue firestore.indexes.json** | Definir la colección, campos y ordenación en firestore.indexes.json y desplegar con Firebase CLI |

El error FAILED_PRECONDITION: The query requires an index en Cloud Firestore se genera cuando ejecutas una consulta compleja que combina cláusulas where() sobre múltiples campos distintos o mezcla un filtro de rango/desigualdad (<, <=, >, >=) con una ordenación orderBy() en un campo diferente. Por diseño NoSQL, Firestore exige un índice compuesto previo para garantizar un rendimiento constante en tiempo de consulta O(N).

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Crear el índice automáticamente desde el enlace de error
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
