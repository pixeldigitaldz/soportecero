---
title: "How to Fix Python SSLCertVerificationError CERTIFICATE_VERIFY_FAILED"
description: "Fix SSL: CERTIFICATE_VERIFY_FAILED errors in Python requests, urllib, and pip across macOS, Linux, and Windows step by step."
category: "Web & Code"
tags: ["Python", "SSL", "Security", "Requests", "macOS", "Linux"]
readTime: "5 min"
date: "2026-08-03"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Python on macOS missing bundled OpenSSL root certificates** | Run Install Certificates.command located in Applications Python directory |
| **Outdated certifi bundle or unrecognized corporate/proxy CA certificate** | Update certifi via `pip install --upgrade certifi` or specify custom CA path in verify='/path/ca.crt' |

The exception ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate in Python (requests, urllib3, aiohttp, or pip) occurs when the runtime cannot validate the remote server SSL/TLS certificate chain against its local Certificate Authority (CA) trust store.

## 🚀 Step-by-Step Solution

### Step 1: macOS Fix (Install Official OpenSSL Certificates)
Standalone macOS Python installers do not use macOS System Keychain by default; they use a private OpenSSL store that requires running a post-install script:
```bash
# Execute the official certificate installer command
/Applications/Python\ 3.*/Install\ Certificates.command
```

### Step 2: Update certifi and Operating System Root Certificates
Ensure your active virtual environment and host OS have up-to-date certificate bundles:
```bash
# In your Python virtual environment
pip install --upgrade certifi urllib3 requests

# On Linux (Debian/Ubuntu) system packages:
sudo apt-get update && sudo apt-get install --reinstall ca-certificates -y
sudo update-ca-certificates
```

### Step 3: Provide Custom CA Bundles in Python Requests
When connecting through enterprise proxies, internal VPNs, or self-signed API servers, pass the explicit certificate path:
```python
import requests
import certifi

# Option 1: Use verified certifi bundle explicitly
response = requests.get('https://api.example.com', verify=certifi.where())

# Option 2: Pass company custom root CA certificate
response = requests.get('https://internal-api.local', verify='/etc/ssl/certs/company-ca.crt')
```

### Step 4: Set Global SSL Environment Variables
Configure your environment so all Python packages share the active certificate store:
```bash
# Export in ~/.bashrc or ~/.zshrc
export SSL_CERT_FILE=$(python -m certifi)
export REQUESTS_CA_BUNDLE=$(python -m certifi)
```

## 🛡️ Prevention Advice
- **Avoid verify=False in production:** Disabling verification via verify=False exposes network requests to eavesdropping and credential theft via Man-in-the-Middle (MitM) attacks.
- **Pin certifi in dependencies:** Add certifi to your project requirements.txt to ensure predictable deployments.

## ❓ Frequently Asked Questions (FAQ)

### Why does my browser load the URL without error while Python fails?
Modern web browsers download missing intermediate certificates on the fly using AIA fetching, whereas Python requires the full certificate authority chain to exist locally.

### How do I check which certificate file Python is using?
Run in terminal: `python -c "import certifi; print(certifi.where())"`.
