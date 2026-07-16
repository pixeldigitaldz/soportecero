---
title: "Fix: Invalid or Expired Token Error in the Binance Pay API"
description: "Learn how to fix the 'Invalid Signature' authentication failure or expired token error when integrating crypto payment gateways into your web application."
category: "Web & Code"
tags: ["Binance", "API", "Crypto"]
readTime: "4 min"
date: "2026-07-30"
---

The `Invalid Signature` or `Token Expired` error in the Binance Pay API occurs when you attempt to process a payment in USDT or another cryptocurrency and the Binance servers reject the request. The primary cause is a timestamp desynchronization between your local server and Binance's official clock, or incorrect concatenation of API keys when generating the HMAC-SHA512 cryptographic signature.

## 🚀 Step-by-Step Solution

### Step 1: Synchronize the server clock (NTP)
Binance rejects any request whose timestamp varies by more than a few seconds from their server's time. On your Linux server, force time synchronization by running:
```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```

Verify that the time is perfectly aligned using the `timedatectl` command.

### Step 2: Order variables for the signature (Payload)

The cryptographic signature requires you to join the timestamp, a random string (nonce), and the request body (JSON body string) in a strict format. Ensure your code concatenates the elements exactly in this order before hashing it:
```plaintext
TIMESTAMP + "\n" + NONCE + "\n" + BODY_JSON_STRING + "\n"
```

A common mistake is that the JSON in your code orders the keys differently than how they are sent in the HTTP body, immediately breaking the signature.

## 🛡️ Prevention Advice

Recommended security practices:
- Never expose your private keys (Secret Key) in your application's frontend code (client-side JavaScript). Any user could inspect the page, steal your Binance Pay credentials, and drain the funds from your merchant account. Always handle signature requests strictly from the backend (Node.js, PHP, or Python).
