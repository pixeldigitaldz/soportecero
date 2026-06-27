---
title: "Solución a errores de permisos insuficientes al instalar paquetes globales con NPM"
description: "Evita el uso peligroso de sudo al instalar dependencias de Node.js reconfigurando NPM para guardar paquetes en tu directorio de usuario."
category: "Web y Código"
tags: ["NPM", "NodeJS", "Linux"]
readTime: "4 min"
date: "2026-06-27"
---

El error de permisos insuficientes (`EACCES: permission denied`) al intentar instalar paquetes de Node.js de manera global (con el comando `npm install -g`) ocurre porque el directorio predeterminado de NPM (`/usr/local/lib/node_modules/`) es propiedad exclusiva del usuario root del sistema de archivos de tu sistema operativo.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Configurar una ruta de instalación local para NPM
No debes usar `sudo` para instalar paquetes globales, ya que esto puede permitir la ejecución de scripts maliciosos con privilegios de root. En su lugar, configura un directorio local en tu carpeta personal:
```bash
# Crear la carpeta de instalación en tu directorio de usuario
mkdir -p ~/.npm-global

# Indicar a NPM que use esta ruta para los paquetes globales
npm config set prefix '~/.npm-global'
```

### Paso 2: Exportar la nueva ruta a tu entorno de terminal
Para poder ejecutar los binarios instalados desde cualquier parte, agrega el nuevo directorio a tu variable `PATH`:
```bash
# Agregar la línea de exportación a tu perfil de shell (.bashrc o .zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

# Recargar la configuración del shell actual en memoria
source ~/.bashrc
```

### Paso 3: Probar la instalación limpia sin privilegios de root
Instala cualquier herramienta global (por ejemplo, el CLI de Firebase) para confirmar que ya no requieres utilizar `sudo`:
```bash
npm install -g firebase-tools
```

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Evita forzar la instalación de dependencias de desarrollo utilizando el comando `sudo npm install`. Al usar la cuenta de superusuario en repositorios de Node.js, otorgas permisos de control total a cualquier script post-instalación de paquetes externos de terceros, lo que expone tus archivos de configuración y credenciales a vulnerabilidades de robo de información o inyección de malware en tus entornos de trabajo.
