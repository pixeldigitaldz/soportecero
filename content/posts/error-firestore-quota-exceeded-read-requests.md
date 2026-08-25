---
title: "Error: Quota exceeded for quota metric Read requests en Firestore"
description: "Aprende a solucionar el error de cuota excedida de lecturas en Cloud Firestore implementando caché local, paginación y agregaciones."
category: "Web y Código"
tags: ["Firebase", "Cloud Firestore", "JavaScript", "Optimización", "NoSQL", "Cloud"]
readTime: "5 min"
date: "2026-06-25"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Consumo masivo de lecturas por listeners en tiempo real (`onSnapshot`) descontrolados o consultas sin paginar** | Reemplazar consultas masivas por paginación con `limit()` y `startAfter()` y activar persistencia local en caché |
| **Límite del plan gratuito Spark (50,000 lecturas/día) superado por bucles en desarrollo** | Identificar la consulta causante en Firebase Console y migrar a plan Blaze con alertas de presupuesto |

El error `RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Read requests' and limit 'Read requests per day' of service 'firestore.googleapis.com'` ocurre cuando tu aplicación supera el límite diario de 50.000 lecturas gratuitas del plan Spark o la cuota configurada en tu cuenta de Cloud Firestore. Esto bloquea inmediatamente todas las consultas de lectura en tu base de datos hasta el siguiente ciclo de 24 horas.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Habilitar la persistencia y caché local en el cliente
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

## 🛡️ Consejos de Prevención
- **Configura alertas de presupuesto en Google Cloud:** Crea un presupuesto de $5 o $10 en GCP Cloud Billing para recibir avisos por correo antes de agotar cuotas.
- **Desnormaliza datos frecuentes:** Guarda contadores y datos agregados dentro del documento principal para evitar lecturas cruzadas.

## ❓ Preguntas Frecuentes (FAQ)

### ¿A qué hora se reinicia la cuota diaria del plan gratuito de Firestore?
La cuota del plan Spark se reinicia a medianoche en hora del Pacífico (PST/PDT), correspondiente a las 00:00 UTC-8.

### ¿Las lecturas desde la caché local cuentan para la cuota de Firebase?
No. Cualquier documento recuperado desde la caché de IndexedDB del navegador no consume lecturas de red ni genera costes en Firestore.
