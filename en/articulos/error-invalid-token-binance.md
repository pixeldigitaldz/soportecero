---
title: 'Guide: Invalid or Expired Token Error in the Binance Pay API'
description: >-
  Learn how to fix the 'Invalid Signature' authentication failure or expired
  token error when integrating crypto payment gateways into your web
  application.
category: Web & Code
tags:
  - Binance
  - API
  - Crypto
readTime: 6 min
date: '2026-07-27'
---

Receiving an `Invalid Signature` (code `400002` / `-1022`) or `Timestamp for this request is outside of the recvWindow` / `Token Expired` response from the **Binance Pay API** means Binance's authentication gateway rejected your request before processing the payment. Because Binance Pay enforces strict cryptographic request signing and tight replay-window validation, even a 1-character mismatch in payload formatting or a few seconds of server clock drift invalidates the entire request.

## Quick Diagnostics

| Symptom / Cause | Immediate Action |
|---|---|
| **Server clock out of sync with UTC** | Enable NTP sync (`timedatectl set-ntp true`) and compare against `/api/v3/time` |
| **Malformed HMAC-SHA512 signature payload** | Verify exact `timestamp + "\n" + nonce + "\n" + body + "\n"` concatenation |
| **JSON key order or whitespace mismatch** | Sign the exact serialized string sent in the HTTP body |
| **Expired API key, wrong secret, or unwhitelisted IP** | Verify merchant API key permissions and server outbound IPv4 in Binance Merchant Portal |

## Root Cause & Technical Mechanics

Unlike standard OAuth bearer tokens, the Binance Pay Merchant API (`https://bpay.binanceapi.com`) authenticates every `POST` request using three custom headers:
* `BinancePay-Timestamp`: Current Unix timestamp in **milliseconds** (13 digits).
* `BinancePay-Nonce`: A random 32-character alphanumeric string unique per request.
* `BinancePay-Signature`: An **uppercase hexadecimal** HMAC-SHA512 digest computed using your Merchant Secret Key.

Binance rejects requests with `Invalid Signature` or `Expired` errors under four exact conditions:
1. **Clock Drift & Replay Window:** Binance compares `BinancePay-Timestamp` against its own UTC servers. If your server's system clock drifts ahead or behind by more than a few seconds—or if you pass seconds (10 digits) instead of milliseconds (13 digits)—the request is rejected as expired.
2. **Payload String Mismatch:** The HMAC-SHA512 input string must follow the exact format:
   `timestamp + "\n" + nonce + "\n" + json_body + "\n"`
   Notice the mandatory trailing newline (`\n`). Furthermore, if you sign `JSON.stringify(payload)` in one place and let an HTTP client (like Axios or Guzzle) re-serialize the object with different key spacing or Unicode escaping, the signature hash will not match what Binance computes from the raw HTTP body.
3. **Lowercase Hex Digest:** Binance Pay expects the HMAC-SHA512 output in **UPPERCASE** hex (`digest('hex').toUpperCase()`). Passing lowercase hex triggers `Invalid Signature`.
4. **API Key / IP Whitelist Mismatch:** Using a Spot Trading API key instead of a **Binance Pay Merchant API Key**, or sending requests from an IPv6 address when only IPv4 is whitelisted, also results in authentication rejection.

## Step-by-Step Solution

### 1. Synchronize Your Server Clock and Verify Offset Against Binance
Enable NTP synchronization on your Linux host and confirm `System clock synchronized: yes`:
```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
timedatectl status
```

Compare your local UTC millisecond timestamp directly against Binance's server time:
```bash
echo "Local:   $(date +%s%3N)"
curl -s https://api.binance.com/api/v3/time
```
The difference between `Local` and `serverTime` should be under `1000` ms.

### 2. Sign the Exact Raw JSON Body String in Uppercase HMAC-SHA512
Always serialize your JSON body **once**, compute the HMAC-SHA512 signature over that exact string, and send that raw string in your HTTP client:

```javascript
import crypto from 'crypto';

const timestamp = Date.now().toString(); // 13-digit ms
const nonce = crypto.randomBytes(16).toString('hex'); // 32-char string
const rawBody = JSON.stringify(orderPayload);

const payloadToSign = `${timestamp}\n${nonce}\n${rawBody}\n`;
const signature = crypto
  .createHmac('sha512', process.env.BINANCE_PAY_SECRET)
  .update(payloadToSign)
  .digest('hex')
  .toUpperCase();
```

Pass `rawBody` directly as the `body` / `data` argument to `fetch` or `axios` with `Content-Type: application/json`, rather than passing an unserialized JS object.

### 3. Verify Merchant IP Whitelisting
Confirm the exact outbound IPv4 address your server uses for HTTPS requests:
```bash
curl -4 -s https://ifconfig.me
```
Ensure that exact IPv4 address is listed in your **Binance Pay Merchant Portal -> Developer -> API Key** allowlist.

## Frequently Asked Questions

**Why did my signature work in Postman/cURL but fail in Node.js or PHP?**
In PHP (`json_encode`) and Node.js (`axios`), passing an object/array lets the HTTP client re-encode it, which can alter whitespace, float formatting (`10.00` vs `10`), or slash escaping (`/` vs `\/`). Always sign and transmit the exact same pre-serialized string (`JSON_UNESCAPED_SLASHES` in PHP).

**Can I use my regular Binance Spot API keys for Binance Pay?**
No. Binance Pay requires dedicated Merchant API credentials (`BinancePay-Certificate-Sn`) generated inside the **Binance Pay Merchant Portal**, not standard Spot/Futures API keys.

**What if my server uses IPv6 by default when calling `bpay.binanceapi.com`?**
If your VPS has both IPv4 and IPv6 enabled, `curl` or Node's `fetch` may connect over IPv6, which fails an IPv4-only whitelist. Force IPv4 or whitelist both addresses in the Merchant Portal.

## Prevention Advice

* Never store or use `BINANCE_PAY_SECRET` in frontend JavaScript or mobile app bundles; compute all HMAC-SHA512 signatures strictly on your backend server.
* Monitor `systemd-timesyncd` or `chronyd` with health checks so container or VM clock drift never exceeds 1 second.
* Store API keys in encrypted environment secrets (`Vault`, `.env` outside webroot, or cloud KMS) and rotate Merchant API keys immediately if a team member leaves.
