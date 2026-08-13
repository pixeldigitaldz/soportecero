---
title: "[SOLUCIONADO] Error 'npm ERR! code EACCES permission denied' en Linux"
description: "¿Fallo de permisos EACCES al instalar paquetes globales con npm? Aprende a solucionar los permisos de Node.js sin usar sudo de forma segura."
category: "Web y Código"
tags: ["Node.js", "npm", "Linux"]
readTime: "4 min"
date: "2026-08-03"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Ejecución de npm install global sin permisos en /usr/local/lib/node_modules** | Cambiar el directorio global por defecto de npm a la carpeta home del usuario |
| **Permisos de carpeta del proyecto pertenecientes a root** | Ejecutar `sudo chown -R $USER:$USER .` en la carpeta raíz del proyecto |


El error **`npm ERR! code EACCES permission denied`** (o `EACCES: permission denied, access '/usr/local/lib/node_modules'`) ocurre al intentar instalar paquetes globales con `npm install -g <paquete>`. Sucede porque el directorio del sistema pertenece al usuario `root`, impidiendo que tu usuario normal escriba en él.

> **Solución Rápida (Recomendada):**
> Cambia la ubicación del directorio global de npm a tu carpeta de usuario local:
> ```bash
> mkdir ~/.npm-global
> npm config set prefix '~/.npm-global'
> echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc && source ~/.bashrc
> ```

## 🚀 Cómo solucionar el error de permisos en NPM sin usar sudo

### Método 1: Reconfigurar el directorio predeterminado de NPM (Mejor opción)

Jamás debes instalar paquetes de `npm` usando `sudo`, ya que expone tu sistema a riesgos de seguridad y corrompe los permisos de futuros comandos.

1. **Crear un directorio dedicado para paquetes globales en tu HOME:**
   ```bash
   mkdir -p ~/.npm-global
   ```

2. **Configurar NPM para usar la nueva carpeta:**
   ```bash
   npm config set prefix '~/.npm-global'
   ```

3. **Agregar la nueva ruta a tus variables de entorno PATH:**
   Si usas Bash (`~/.bashrc`):
   ```bash
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```
   Si usas Zsh (`~/.zshrc`):
   ```bash
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc
   ```

4. **Probar la instalación global:**
   ```bash
   npm install -g typescript ts-node
   ```

### Método 2: Utilizar Node Version Manager (NVM)
Usar **NVM** es la práctica estándar en la industria para desarrollo con Node.js. NVM instala Node.js y `npm` dentro del espacio del usuario actual, eliminando por completo cualquier problema de permisos.

```bash
# 1. Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 2. Recargar tu terminal
source ~/.bashrc

# 3. Instalar la versión LTS de Node.js
nvm install --lts
nvm use --lts
```

## 🛡️ Consejo de Prevención
* Evita ejecutar `sudo npm install -g` bajo cualquier circunstancia.
* Si por error usaste `sudo npm` anteriormente y corrompiste los permisos de tu carpeta `~/.npm`, restaura el propietario con:
  ```bash
  sudo chown -R $USER:$USER ~/.npm
  ```
