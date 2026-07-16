---
title: "How to Solve Insufficient Permission Errors When Installing Global Packages with NPM"
description: "Avoid the dangerous use of sudo when installing Node.js dependencies by reconfiguring NPM to save packages in your user directory."
category: "Web & Code"
tags: ["NPM", "NodeJS", "Linux"]
readTime: "4 min"
date: "2026-08-01"
---

The insufficient permission error (`EACCES: permission denied`) when trying to install Node.js packages globally (with the `npm install -g` command) occurs because NPM's default directory (`/usr/local/lib/node_modules/`) is owned exclusively by the root user of your operating system's filesystem.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar una ruta de instalación local para NPM
You should not use `sudo` to install global packages, as this can allow the execution of malicious scripts with root privileges. Instead, configure a local directory in your personal folder:
```bash
# Crear la carpeta de instalación en tu directorio de usuario
mkdir -p ~/.npm-global

# Indicar a NPM que use esta ruta para los paquetes globales
npm config set prefix '~/.npm-global'
```

### Paso 2: Exportar la nueva ruta a tu entorno de terminal
To be able to run the installed binaries from anywhere, add the new directory to your `PATH` variable:
```bash
# Agregar la línea de exportación a tu perfil de shell (.bashrc o .zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

# Recargar la configuración del shell actual en memoria
source ~/.bashrc
```

### Paso 3: Probar la instalación limpia sin privilegios de root
Install any global tool (for example, the Firebase CLI) to confirm that you no longer need to use `sudo`:
```bash
npm install -g firebase-tools
```

## 🛡️ Consejo de Prevención

Recommended security practices:
- Avoid forcing the installation of development dependencies using the `sudo npm install` command. By using the superuser account on Node.js repositories, you grant full control permissions to any post-installation script of external third-party packages, which exposes your configuration files and credentials to vulnerabilities of information theft or malware injection in your work environments.
