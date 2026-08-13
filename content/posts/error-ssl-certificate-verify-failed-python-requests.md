---
title: Cómo solucionar SSLCertVerificationError / CERTIFICATE_VERIFY_FAILED en Python
description: >-
  Guía técnica para solucionar el error SSLCertVerificationError CERTIFICATE_VERIFY_FAILED al realizar peticiones HTTPS en Python con urllib, requests o httpx.
category: Web y Código
tags:
  - Python
  - SSL
  - Programming
readTime: 4 min
date: '2026-08-03'
---

Al realizar peticiones HTTP seguras en Python utilizando módulos como `urllib`, `requests` o `httpx`, es común encontrarse con la excepción `ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed`. Este error ocurre cuando la biblioteca SSL de Python no logra validar la cadena de certificados TLS/SSL presentados por el servidor de destino, ya sea por falta de certificados CA de confianza en el sistema, certificados autofirmados o configuraciones de red corporativas con proxies de inspección SSL.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **`SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED]` en macOS tras instalar Python**: Falta la instalación del almacén de certificados CA por defecto de OpenSSL en macOS | Ejecutar el script `Install Certificates.command` incluido en la carpeta de Python en macOS |
| **Fallo de verificación SSL en scripts con `requests` o `urllib3` en Linux / Entornos virtuales**: Paquete `certifi` desactualizado o falta el bundle CA del sistema operativo | Actualizar `certifi` con `pip` o definir la variable `REQUESTS_CA_BUNDLE` hacia la CA raíz |
| **Error al conectar a un servidor local de desarrollo o con proxy empresarial**: El servidor utiliza un certificado TLS autofirmado o la CA empresarial no está en el almacén de confianza | Añadir la CA personalizada al bundle de `certifi` o pasar la ruta del certificado a la petición |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Solución para macOS (Instalación de certificados OpenSSL)
Si estás utilizando macOS y descargaste Python desde python.org o Homebrew, el entorno a menudo no viene con los certificados de autoridad de certificación (CA) del sistema vinculados a la librería `ssl`:

```bash
# Para versiones de Python instaladas vía instalador oficial de macOS:
/Applications/Python\ 3.12/Install\ Certificates.command

# Si usas Python 3.11, 3.10 u otra versión, ajusta la ruta correspondientemente:
/Applications/Python\ 3.x/Install\ Certificates.command
```

### Paso 2: Actualizar el paquete `certifi` y los certificados del sistema
Tanto `requests` como `httpx` dependen de la biblioteca `certifi` para mantener una lista actualizada de Certificados Raíz de Confianza de Mozilla. Actualiza este paquete dentro de tu entorno virtual:

```bash
# Actualizar certifi en tu virtualenv
pip install --upgrade certifi urllib3 requests

# En Linux (Debian/Ubuntu) para actualizar las CAs del sistema:
sudo apt-get update && sudo apt-get install --reinstall ca-certificates
sudo update-ca-certificates
```

### Paso 3: Especificar un certificado CA personalizado en `requests` o `urllib`
Si estás interactuando con un servicio interno que usa una Entidad Certificadora (CA) propia o un certificado autofirmado, provee la ruta del archivo `.pem` o `.crt` en la petición en lugar de desactivar la verificación:

```python
import requests
import certifi

# ❌ NO RECOMENDADO: Desactivar la verificación expone a ataques Man-in-the-Middle (MitM)
# response = requests.get('https://mi-api-interna.local', verify=False)

# ✅ RECOMENDADO 1: Pasar la ruta del certificado CA personalizado de la empresa
custom_ca_path = '/etc/ssl/certs/mi_ca_empresa.crt'
response = requests.get('https://mi-api-interna.local', verify=custom_ca_path)

# ✅ RECOMENDADO 2: Configurar la variable de entorno global en Python
import os
os.environ['REQUESTS_CA_BUNDLE'] = '/etc/ssl/certs/mi_ca_empresa.crt'
os.environ['SSL_CERT_FILE'] = '/etc/ssl/certs/mi_ca_empresa.crt'

res = requests.get('https://mi-api-interna.local')
print(res.status_code)
```

Para scripts que utilizan `urllib.request` nativo:

```python
import urllib.request
import ssl
import certifi

# Crear un contexto SSL que utilice el bundle de certifi actualizado
ssl_context = ssl.create_default_context(cafile=certifi.where())

req = urllib.request.Request('https://ejemplo.com')
with urllib.request.urlopen(req, context=ssl_context) as response:
    html = response.read()
```

## 🛡️ Consejos de Prevención

- **Jamás uses `verify=False` en producción**: Desactivar la verificación SSL (`verify=False`) suprime la advertencia pero deja tu aplicación vulnerable a interceptación de tráfico y suplantación de identidad.
- **Mantén `certifi` actualizado en tus requerimientos**: Incluye `certifi>=2024.0.0` en tu archivo `requirements.txt` o `pyproject.toml` para renovar las CAs caducadas.
- **Configura las variables de entorno de red**: En entornos corporativos tras un Proxy SSL, define permanentemente `REQUESTS_CA_BUNDLE` y `CURL_CA_BUNDLE` en el perfil de usuario (`~/.bashrc` o `~/.zshrc`).
