---
title: "Solución: Error de Token Inválido o expirado en la API de Binance Pay"
description: "Aprende a corregir el fallo de autenticación 'Invalid Signature' o token expirado al integrar pasarelas de pago cripto en tu aplicación web."
category: "Web y Código"
tags: ["Binance", "API", "Crypto"]
readTime: "4 min"
date: "2026-06-27"
---

El error `Invalid Signature` o `Token Expired` en la API de Binance Pay ocurre cuando intentas procesar un pago en USDT u otra criptomoneda y los servidores de Binance rechazan la petición. La causa principal es una desincronización de la marca de tiempo (Timestamp) entre tu servidor local y el reloj oficial de Binance, o una concatenación incorrecta de las claves API al generar la firma criptográfica HMAC-SHA512.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Sincronizar el reloj del servidor (NTP)
Binance rechaza cualquier petición cuyo Timestamp varíe por más de unos pocos segundos respecto a su servidor. En tu servidor Linux, fuerza la sincronización horaria ejecutando:
```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```

Verifica que la hora esté perfectamente cuadrada con el comando `timedatectl`.

### Paso 2: Ordenar las variables para la firma (Payload)

La firma criptográfica requiere que unas el Timestamp, un string aleatorio (Nonce) y el cuerpo de la petición (Body JSON) en un formato estricto. Asegúrate de que tu código concatene los elementos exactamente en este orden antes de pasarlo por la función de hash:
```plaintext
TIMESTAMP + "\n" + NONCE + "\n" + BODY_JSON_STRING + "\n"
```

Un error común es que el JSON de tu código ordene las llaves de forma distinta a como las envías en el cuerpo HTTP, rompiendo la firma de inmediato.

## 🛡️ Consejo de Prevención

Prácticas de seguridad recomendadas:
- Nunca expongas tus llaves privadas (Secret Key) en el código frontend de tu aplicación (JavaScript del cliente). Cualquier usuario podría inspeccionar la página, robar tus credenciales de Binance Pay y vaciar los fondos de tu cuenta comercial. Realiza siempre las solicitudes de firma estrictamente desde el backend (Node.js, PHP o Python).
