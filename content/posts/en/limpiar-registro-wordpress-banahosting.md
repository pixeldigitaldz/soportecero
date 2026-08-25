---
title: "How to clean and optimize a bloated WordPress database in BanaHosting"
description: "Step-by-step guide to removing expired transients, post revisions, and optimizing MySQL table storage in cPanel BanaHosting."
category: "Systems & Servers"
tags: ["WordPress", "BanaHosting", "MySQL", "cPanel", "Optimization"]
readTime: "5 min"
date: "2026-07-27"
---

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **wp_options table bloated by expired transient records and unpruned autoload data** | Run SQL cleanup queries for transients in phpMyAdmin |
| **Accumulated post revisions and orphan postmeta consuming IOPS in wp_posts** | Cap post revisions in `wp-config.php` and run OPTIMIZE TABLE in MySQL |

Unchecked growth of WordPress databases in shared hosting environments like BanaHosting or standard cPanel VPS causes sites to exceed inode quotas, trigger CPU/IOPS resource throttling, and suffer intermittent 500/503 errors. The culprit is typically unpruned `_transient_` options and thousands of draft revisions.

## 🚀 Step-by-Step Solution

### Step 1: Limit Post Revisions in wp-config.php
Prevent WordPress from creating unlimited revision rows by adding configuration limits to `wp-config.php`:
```php
// Limit post revisions to 3 versions
define('WP_POST_REVISIONS', 3);

// Increase autosave interval to 120 seconds
define('AUTOSAVE_INTERVAL', 120);

// Empty trash automatically every 7 days
define('EMPTY_TRASH_DAYS', 7);
```

### Step 2: Clean Expired Transients in wp_options via phpMyAdmin
Open **cPanel > phpMyAdmin**, select your database, and run this query under the SQL tab:
```sql
-- Remove transient records from options table
DELETE FROM wp_options WHERE option_name LIKE ('_transient_%');
DELETE FROM wp_options WHERE option_name LIKE ('_site_transient_%');
```

### Step 3: Remove Orphan Revisions and Post Meta
Delete old draft revisions and their detached metadata entries:
```sql
-- 1. Remove revision entries
DELETE a,b,c
FROM wp_posts a
LEFT JOIN wp_term_relationships b ON (a.ID = b.object_id)
LEFT JOIN wp_postmeta c ON (a.ID = c.post_id)
WHERE a.post_type = 'revision';

-- 2. Clean orphan postmeta rows
DELETE pm FROM wp_postmeta pm LEFT JOIN wp_posts wp ON wp.ID = pm.post_id WHERE wp.ID IS NULL;
```

### Step 4: Defragment and Optimize Database Tables
Reclaim unallocated disk space and rebuild index trees:
```sql
OPTIMIZE TABLE wp_options, wp_posts, wp_postmeta, wp_comments;
```

## 🛡️ Prevention Advice
- **Avoid database logging plugins:** Offload analytics and redirect tracking to services like Cloudflare or GA4 rather than writing raw hits into MySQL tables.
- **Automate maintenance:** Schedule monthly optimization cron tasks via WP-CLI or lightweight maintenance tools.

## ❓ Frequently Asked Questions (FAQ)

### Is deleting _transient_ rows safe?
Yes, completely safe. Transients are temporary cached values that plugins will transparently re-populate upon the next request.

### Will removing revisions affect my live published posts?
No. Only historical intermediate drafts are pruned. Live articles remain untouched.
