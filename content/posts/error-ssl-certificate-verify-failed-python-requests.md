---
title: "Cómo solucionar SSLCertVerificationError / CERTIFICATE_VERIFY_FAILED en Python"
description: "Soluciona el error SSL: CERTIFICATE_VERIFY_FAILED en Python requests, urllib y pip en macOS, Linux y Windows paso a paso."
category: "Web y Código"
tags: ["Python", "SSL", "Seguridad", "Requests", "macOS", "Linux"]
readTime: "5 min"
date: "2026-08-03"
---

## Diagnóstico Rápido
| Causa | Solución |
|---|---|
| **Python en macOS sin certificados raíz de OpenSSL instalados** | Ejecutar el script Install Certificates.command en la carpeta de Python en Aplicaciones |
| **Paquete certifi desactualizado o certificado CA corporativo/intermedio no reconocido** | Actualizar certifi con `pip install --upgrade certifi` o pasar la ruta del certificado CA en verify='/ruta/ca.crt' |

El error ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate en Python (requests, urllib3, aiohttp o pip) ocurre cuando la librería no puede validar la cadena de confianza del certificado SSL/TLS del servidor remoto contra el almacén local de Autoridades de Certificación (CA).

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Solución para macOS (Instalación de certificados OpenSSL)
Las versiones oficiales de Python para macOS no utilizan por defecto el llavero del sistema (Keychain), sino su propio almacén OpenSSL que viene vacío tras la instalación:
```bash
# Ejecutar el script oficial de instalación de certificados para Python 3
/Applications/Python\ 3.*/Install\ Certificates.command
```
O mediante terminal si utilizas Homebrew o pyenv:
```bash
# Instalar y enlazar certificados en el entorno
pip install --upgrade certifi
```

### Paso 2: Actualizar el paquete certifi y los certificados del sistema operativo
Asegúrate de que tu entorno virtual y tu sistema operativo dispongan del bundle de certificados raíz más reciente:
```bash
# En tu entorno virtual de Python
pip install --upgrade certifi urllib3 requests

# En Linux (Debian / Ubuntu) para actualizar CAs del sistema:
sudo apt-get update && sudo apt-get install --reinstall ca-certificates -y
sudo update-ca-certificates
```

### Paso 3: Especificar un certificado CA personalizado en Requests
Si estás consumiendo una API interna, un proxy corporativo o un servidor con certificado autofirmado, especifica la ruta de tu CA:
```python
import requests
import certifi

# Opción 1: Utilizar el bundle verificado de certifi
response = requests.get('https://api.ejemplo.com', verify=certifi.where())

# Opción 2: Especificar tu certificado corporativo (.pem / .crt)
response = requests.get('https://api-interna.local', verify='/etc/ssl/certs/mi-empresa-ca.crt')
```

### Paso 4: Configurar variables de entorno globales (SSL_CERT_FILE / REQUESTS_CA_BUNDLE)
Para que todas las librerías de Python reconozcan el almacén de certificados sin modificar cada script individual:
```bash
# Exportar en tu terminal o archivo ~/.bashrc / ~/.zshrc
export SSL_CERT_FILE=$(python -m certifi)
export REQUESTS_CA_BUNDLE=$(python -m certifi)
```

## 🛡️ Consejos de Prevención
- **No uses verify=False en producción:** Desactivar la verificación SSL con requests.get(url, verify=False) deshabilita el cifrado autenticado y deja tu conexión expuesta a ataques Man-in-the-Middle (MitM) donde contraseñas y tokens pueden ser interceptados.
- **Mantén actualizados tus entornos virtuales:** Incluye certifi en tu archivo requirements.txt para asegurar bundles de certificados vigentes en despliegues automatizados.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Por qué mi navegador abre la página sin error pero Python falla?
Los navegadores web utilizan el almacén de certificados del sistema operativo y admiten mecanismos automáticos como AIA (Authority Information Access) para descargar certificados intermedios faltantes, algo que Python no hace automáticamente por motivos de rendimiento y seguridad estricta.

### ¿Cómo verifico qué archivo de certificados está usando certifi?
Ejecuta en tu terminal: `python -c "import certifi; print(certifi.where())"`.
