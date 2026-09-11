---
title: "[SOLUCIONADO] npm ERR! ERESOLVE unable to resolve dependency tree en npm install"
description: "Aprende a resolver el error ERESOLVE unable to resolve dependency tree al instalar paquetes y librerías en Node.js y React."
category: "Web y Código"
tags: ["npm","Nodejs","JavaScript","React"]
readTime: "4 min"
date: "2026-10-13"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Conflicto estricto de dependencias de pares (peerDependencies) introducido en npm v7+** | Utilizar el flag --legacy-peer-deps o actualizar las librerías obsoletas a versiones compatibles |
| **Incompatibilidad de versiones entre React 18/19 y paquetes antiguos de terceros** | Configurar .npmrc con legacy-peer-deps=true o forzar resolución con overrides |

Al ejecutar `npm install` o añadir una nueva librería a tu proyecto de Node.js, la instalación se detiene bruscamente arrojando: `npm ERR! code ERESOLVE` y `npm ERR! ERESOLVE unable to resolve dependency tree` con un diagrama de conflicto de versiones. Este fallo ocurre porque a partir de npm v7, el instalador valida estrictamente que todas las dependencias de pares (*peerDependencies*) coincidan a la perfección.

> **Solución Rápida (1 Minuto):**
> 1. Para desbloquear la instalación de inmediato:
>    `npm install --legacy-peer-deps`
> 2. O haz que el comportamiento sea permanente en tu proyecto:
>    `echo "legacy-peer-deps=true" >> .npmrc`

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Comprender el árbol de conflicto de dependencias
Observa la salida del error en la terminal. npm detalla exactamente qué dos paquetes tienen requisitos contradictorios:
```plaintext
Could not resolve dependency:
peer react@"^17.0.0" from libreria-antigua@1.2.0
node_modules/libreria-antigua
  libreria-antigua@"^1.2.0" from root_project
```
En este caso, tu proyecto usa React 18 o 19, pero una librería antigua exige que tengas instalado React 17.

### Paso 2: Instalar omitiendo el chequeo estricto (--legacy-peer-deps)
El flag `--legacy-peer-deps` restaura el comportamiento permisivo de npm v4 a v6, ignorando los conflictos de dependencias de pares incompatibles:
```bash
npm install --legacy-peer-deps
```
Para evitar tener que escribir el parámetro en cada comando o en tus entornos de CI/CD (GitHub Actions, Vercel), crea un archivo `.npmrc` en la raíz del proyecto:
```ini
# .npmrc
legacy-peer-deps=true
```

### Paso 3: Forzar versiones compatibles con la directiva overrides de npm
Si prefieres mantener el chequeo estricto de npm pero forzar a la librería conflictiva a usar tu versión instalada, añade una sección `overrides` en tu archivo `package.json`:
```json
{
  "name": "mi-proyecto",
  "dependencies": {
    "react": "^18.3.1"
  },
  "overrides": {
    "libreria-antigua": {
      "react": "$react"
    }
  }
}
```
Borra `package-lock.json` y `node_modules` y reinstala limpiamente:
```bash
rm -rf package-lock.json node_modules
npm install
```

## 🛡️ Consejo de Prevención
* Revisa la actividad y compatibilidad de las librerías en npm antes de incorporarlas a proyectos de producción.
* Utiliza `npm outdated` con regularidad para no acumular discrepancias de versiones entre paquetes.

## Preguntas Frecuentes

### ¿Cuál es la diferencia entre --legacy-peer-deps y --force?
--legacy-peer-deps simplemente ignora los requisitos de dependencias de pares y no intenta instalarlas automáticamente. --force fuerza la descarga sobrescribiendo paquetes, lo que puede romper dependencias cruzadas.

### ¿Es seguro utilizar legacy-peer-deps en producción?
Sí, la inmensa mayoría de las librerías siguen funcionando sin problemas siempre que la API que consumen no haya sufrido cambios disruptivos mayores entre versiones de React o Node.
