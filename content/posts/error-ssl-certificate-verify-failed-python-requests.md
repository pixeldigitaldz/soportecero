---
title: Cómo solucionar SSLCertVerificationError / CERTIFICATE_VERIFY_FAILED en Python
description: >-
  Soluciona el error SSL: CERTIFICATE_VERIFY_FAILED en Python requests, urllib y
  pip en macOS, Linux y Windows paso a paso.
category: Web y Código
tags:
  - Python
  - SSL
  - Seguridad
  - Requests
  - macOS
  - Linux
readTime: 7 min
date: '2026-08-03'
---
El error ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate en Python (requests, urllib3, aiohttp o pip) ocurre cuando la librería no puede validar la cadena de confianza del certificado SSL/TLS del servidor remoto contra el almacén local de Autoridades de Certificación (CA).

## Análisis de Arquitectura y Causa Raíz

El protocolo **SSH (Secure Shell)**, estandarizado en RFC 4251-4254, provee un canal de comunicación criptográficamente seguro sobre redes no confiables, operando en la capa de aplicación sobre el protocolo de transporte TCP (puerto estándar 22). Su arquitectura comprende tres componentes desacoplados: la capa de transporte (autenticación del servidor, cifrado simétrico y verificación de integridad), el protocolo de autenticación de usuario, y el protocolo de conexión para multiplexar múltiples canales lógicos.

La causa raíz de esta incidencia radica en fallos de negociación criptográfica o restricciones en la capa de filtrado de paquetes del kernel:
1. **Algoritmos de Intercambio de Claves (KEX) y obsolescencia criptográfica:** Durante el saludo inicial (*handshake*), el cliente y el demonio `sshd` negocian un algoritmo de intercambio de claves seguro (ej. `curve25519-sha256` o `diffie-hellman-group14-sha256`). Si el cliente o el servidor tienen deshabilitados algoritmos heredados (por ejemplo tras una actualización de OpenSSH que desactiva claves SHA-1 o algoritmos RSA débiles), la negociación aborta de inmediato con el error `kex_exchange_identification: read: Connection reset by peer`.
2. **Verificación de huella digital y archivos `known_hosts`:** El cliente SSH protege al usuario contra ataques de intermediario (*Man-in-the-Middle*) cotejando la clave pública del servidor con el registro histórico almacenado en `~/.ssh/known_hosts`. Si el servidor remoto ha sido reinstalado, ha cambiado su par de claves o se ha reasignado la dirección IP en un entorno dinámico de nube, la huella digital criptográfica no coincidirá, activando un bloqueo de seguridad estricto por advertencia de ataque de spoofing.
3. **Bloqueo a nivel de Netfilter y saturación de conexiones:** Si se producen múltiples intentos de conexión fallidos o peticiones de autenticación concurrentes, módulos de seguridad como `fail2ban` o reglas en `iptables` / `nftables` descartan los paquetes entrantes (`DROP`), provocando que el cliente permanezca a la espera hasta agotar el tiempo límite (`Connection timed out`).

## Entorno de Laboratorio y Diagnóstico

Antes de aplicar cualquier cambio destructivo o reiniciar servicios en un entorno de producción, es fundamental ejecutar una matriz de diagnóstico preliminar para identificar la capa exacta donde ocurre el fallo:

| Causa | Solución |
|---|---|
| **Python en macOS sin certificados raíz de OpenSSL instalados** | Run Install Certificates.command located in Applications Python directory |

Para validar el estado en consola sin alterar el sistema, ejecuta los siguientes comandos de inspección:

```bash
# 1. Comprobar el estado del servicio en el gestor de inicialización systemd
sudo systemctl status --no-pager -l python-app

# 2. Inspeccionar los registros del diario del sistema filtrando por unidad
sudo journalctl -u python-app -n 50 --no-pager

# 3. Auditar el espacio y tabla de inodos en todos los sistemas de archivos montados
df -Th && df -ih
```

- El flag `--no-pager` en `systemctl` y `journalctl` evita invocar el paginador interactivo (`less`), permitiendo redirigir la salida o analizar los registros sin interrumpir flujos de automatización.
- El comando `df` con los modificadores `-T` (tipo de sistema de archivos ext4/xfs/btrfs) y `-h` (formato legible en gigabytes/megabytes), combinado con `-i` (tabla de inodos disponibles), permite descartar si el disco está lleno por bytes reales o saturado por millones de archivos pequeños huérfanos.

## Implementación Técnica Paso a Paso

Sigue esta secuencia de ingeniería técnica para aislar y resolver definitivamente la causa raíz del fallo:

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
