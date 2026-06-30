---
title: "Cómo reparar el error 'Corrupt loose object' en repositorios Git locales"
description: "Soluciona la corrupción de objetos sueltos en tu directorio .git recuperando los archivos dañados desde el historial de confirmaciones de tu remoto."
category: "Web y Código"
tags: ["Git", "Web", "Programación"]
readTime: "4 min"
date: "2026-07-13"
---

El error crítico de Git `error: object file .git/objects/... is empty` o `corrupt loose object` ocurre tras un corte eléctrico repentino, un fallo del disco o un apagado forzado de la máquina mientras Git escribía metadatos en la base de datos de objetos locales de tu repositorio.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Localizar y eliminar el objeto corrupto de la base de datos
Git detendrá cualquier operación (`status`, `add`, `commit`) si encuentra un objeto corrupto de tamaño 0 bytes. Ejecuta una comprobación del árbol del repositorio para identificar el archivo dañado:
```bash
# Ejecutar verificación de integridad física del repositorio
git fsck --full
```
*(Anota la ruta del hash del objeto marcado como vacío o corrupto, por ejemplo `.git/objects/8f/c3a9...`, e introduce el comando para eliminarlo físicamente de la base de datos local):*
```bash
# Eliminar el archivo de objeto corrupto vacío de 0 bytes
rm .git/objects/8f/c3a9...
```

### Paso 2: Recuperar los objetos eliminados desde tu copia remota
Una vez que el objeto corrupto ha sido removido, indícale a Git que vuelva a descargar y reconstruir los índices de objetos faltantes desde tu servidor remoto en la nube (como GitHub o GitLab):
```bash
# Descargar objetos faltantes sin alterar tus archivos de trabajo locales
git fetch --all
```

### Paso 3: Verificar y reconstruir el estado del índice local
Vuelve a comprobar la consistencia general del repositorio y reconecta el puntero de tu rama local de trabajo:
```bash
# Validar que no existan más objetos dañados
git fsck --full

# Si persiste un fallo en la cabecera HEAD, restablécela al commit del remoto
git update-ref refs/heads/main origin/main
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita forzar el apagado directo o el reinicio abrupto de tu PC de desarrollo mientras se ejecutan comandos transaccionales pesados de control de versiones (tales como `git checkout`, `git clone` o `git gc`). Si trabajas en entornos virtuales o servidores locales remotos propensos a cortes eléctricos intermitentes, configura tu flujo para realizar commits pequeños con frecuencia y subirlos a tu remoto para tener un respaldo inmediato de tus hashes seguros.
