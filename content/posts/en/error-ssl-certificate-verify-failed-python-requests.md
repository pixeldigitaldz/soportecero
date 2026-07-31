---
title: How to Fix Python SSLCertVerificationError CERTIFICATE_VERIFY_FAILED
description: >-
  A technical guide to resolve SSLCertVerificationError CERTIFICATE_VERIFY_FAILED when making HTTPS requests in Python using urllib, requests, or httpx.
category: Web & Code
tags:
  - Python
  - SSL
  - Programming
readTime: 4 min
date: '2026-08-03'
---

When executing secure HTTPS requests in Python using packages like `urllib`, `requests`, or `httpx`, developers frequently encounter `ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed`. This error occurs when Python's underlying SSL module cannot validate the TLS/SSL certificate chain returned by the target server due to missing system Root CAs, self-signed certificates, or corporate SSL inspection proxies.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED]` on macOS after installing Python | macOS Python builds do not use system Keychain CAs by default and require manual OpenSSL CA setup | Run the `Install Certificates.command` script included in the macOS Python application bundle |
| SSL verification error in scripts using `requests` or `urllib3` on Linux / Virtualenv | Outdated `certifi` package or missing operating system CA certificates bundle | Upgrade `certifi` via `pip` or set the `REQUESTS_CA_BUNDLE` environment variable to system CAs |
| Connection failure when targeting internal APIs, staging servers, or corporate proxies | Target server uses a self-signed certificate or custom Enterprise Root CA missing from trust store | Pass the custom CA certificate path to the request or set custom environment variable bundles |

## 🚀 Step-by-Step Solution

### Step 1: macOS Fix (Install OpenSSL CA Certificates)
If you installed Python on macOS via python.org package installers or Homebrew, the Python runtime environment does not automatically link to macOS system CAs:

```bash
# For Python official installer on macOS:
/Applications/Python\ 3.12/Install\ Certificates.command

# If using another Python version (e.g. 3.11, 3.10), update the path accordingly:
/Applications/Python\ 3.x/Install\ Certificates.command
```

### Step 2: Upgrade `certifi` and System CA Store
Both `requests` and `httpx` rely on Mozilla's curated list of Root CAs provided by the `certifi` package. Update `certifi` inside your active virtual environment:

```bash
# Upgrade certifi and HTTP client packages inside virtualenv
pip install --upgrade certifi urllib3 requests

# On Linux (Debian/Ubuntu) update system CAs:
sudo apt-get update && sudo apt-get install --reinstall ca-certificates
sudo update-ca-certificates
```

### Step 3: Pass Custom CA Bundles to `requests` or `urllib`
When working with internal microservices, self-signed SSL certificates, or corporate proxies, specify the custom `.pem` or `.crt` certificate file instead of disabling SSL validation:

```python
import requests
import certifi

# ❌ INSECURE: Disabling verification leaves your application vulnerable to MitM attacks
# response = requests.get('https://internal-api.local', verify=False)

# ✅ RECOMMENDED 1: Pass custom Enterprise CA certificate file explicitly
custom_ca_path = '/etc/ssl/certs/corporate_ca.crt'
response = requests.get('https://internal-api.local', verify=custom_ca_path)

# ✅ RECOMMENDED 2: Configure global environment variables in Python code
import os
os.environ['REQUESTS_CA_BUNDLE'] = '/etc/ssl/certs/corporate_ca.crt'
os.environ['SSL_CERT_FILE'] = '/etc/ssl/certs/corporate_ca.crt'

res = requests.get('https://internal-api.local')
print(res.status_code)
```

For scripts utilizing standard `urllib.request`:

```python
import urllib.request
import ssl
import certifi

# Create SSL context populated with up-to-date certifi CAs
ssl_context = ssl.create_default_context(cafile=certifi.where())

req = urllib.request.Request('https://example.com')
with urllib.request.urlopen(req, context=ssl_context) as response:
    html = response.read()
```

## 🛡️ Prevention Advice

- **Never Use `verify=False` in Production Code**: Disabling SSL verification bypasses encryption integrity checks, opening your application to Man-in-the-Middle (MitM) credential interception.
- **Keep `certifi` Updated in Dependencies**: Include `certifi>=2024.0.0` in your `requirements.txt` or `pyproject.toml` to automatically renew expired root certificates.
- **Set Shell-wide Proxy CA Paths**: In corporate environments behind SSL inspection firewalls, define `REQUESTS_CA_BUNDLE` and `CURL_CA_BUNDLE` in your shell configuration (`~/.bashrc` or `~/.zshrc`).
