---
title: "[SOLUCIONADO] Cancelar un Rebase en Git o Error 'No rebase in progress'"
description: "¿Te has quedado atrapado en medio de un rebase de Git o aparece el error 'No rebase in progress'? Solución paso a paso para abortar rebase."
category: "Web y Código"
tags: ["Git", "GitHub", "DevOps"]
readTime: "3 min"
date: "2026-08-28"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Operación de Rebase pendiente o interrumpida por conflictos** | Resolver conflictos y continuar con `git rebase --continue` o abortar con `git rebase --abort` |
| **Carpeta temporal .git/rebase-merge bloqueando nuevos comandos** | Cancelar la operación rebase actual para restaurar el estado limpio del árbol |


El estado **`interactive rebase in progress`** (o el error opuesto `fatal: No rebase in progress`) ocurre al ejecutar `git rebase` cuando Git encuentra conflictos de fusión en un commit intermedio y suspende la secuencia a la espera de intervención manual. Si la terminal se cierra o la carpeta oculta `.git/rebase-merge` se corrompe, el repositorio queda bloqueado.

> **Solución Rápida (1 Minuto):**
> 1. Para cancelar y volver al estado previo al rebase:
>    `git rebase --abort`
> 2. Si marca `fatal: No rebase in progress` pero sigues atrapado, elimina la carpeta de bloqueo:
>    `rm -rf .git/rebase-apply .git/rebase-merge`

## 🚀 Cómo resolver o abortar un Rebase de Git paso a paso

### Paso 1: Abortar el proceso de Rebase limpiamente
Si deseas deshacer todas las modificaciones intermedias y restaurar tu rama exactamente como estaba antes de iniciar el rebase:

```bash
git rebase --abort
```

### Paso 2: Forzar la salida cuando Git dice "No rebase in progress" pero el estado persiste
Si tu prompt de la terminal sigue mostrando `(main|REBASE 1/5)` pero el comando `git rebase --abort` arroja `fatal: No rebase in progress`:

Significa que existen residuos del estado temporal de rebase en la carpeta `.git`. Elimínalos manualmente:

```bash
# Eliminar directorios residuales de rebase
rm -rf .git/rebase-apply
rm -rf .git/rebase-merge

# Restaurar el puntero de HEAD si quedo desalineado
git checkout main
```

### Paso 3: Continuar el Rebase tras resolver conflictos (Opción Avanzada)
Si prefieres **completar** el rebase en lugar de abortarlo:

1. Resuelve los conflictos en los archivos marcados.
2. Agrega los cambios al área de preparación:
   ```bash
   git add .
   ```
3. Continúa el proceso sin crear un nuevo commit:
   ```bash
   git rebase --continue
   ```

## 🛡️ Consejo de Prevención
* Utiliza `git stash` antes de iniciar rebases complejos en ramas compartidas con otros desarrolladores.
