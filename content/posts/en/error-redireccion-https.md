---
title: "How to Solve the HTTP to HTTPS Infinite Redirect Loop on Your Own Domain"
description: "Technical guide to resolve the infinite ERR_TOO_MANY_REDIRECTS loop when configuring SSL certificates on your web server, WordPress, or Cloudflare."
category: "Web & Code"
tags: ["SSL", "Cloudflare", "Servers"]
readTime: "3 min"
date: "2026-08-02"
---

The `ERR_TOO_MANY_REDIRECTS` (Too many redirects) error occurs when your web server and an external service (such as Cloudflare) enter into a conflict of instructions: the server tells the browser to use HTTPS, but Cloudflare intercepts the request and returns it in HTTP, creating an infinite loop that prevents the page from loading.

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Ajustar el cifrado en Cloudflare
If you use Cloudflare to protect your own domain, the primary cause is having the SSL mode configured as "Flexible".
1. Log in to your Cloudflare dashboard and go to the **SSL/TLS** section.
2. Change the encryption mode from "Flexible" to **Full** or **Full (Strict)**.
3. This forces communication between Cloudflare and your server to be 100% encrypted under HTTPS, breaking the loop.

### Paso 2: Revisar el archivo `.htaccess` (En servidores Apache)
If you do not use Cloudflare, the issue lies in your server's rules. Open your `.htaccess` file and make sure to use a clean redirect rule that does not conflict with itself:
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

## 🛡️ Consejo de Prevención
Recommended security practices:
- Always clear your browser cache (Ctrl + F5) after making changes to SSL certificates, as browsers remember old redirect paths and may show you the error saved in their local memory.
