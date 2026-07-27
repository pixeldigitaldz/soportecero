---
title: How to Fix Redis OOM Command Not Allowed Error (Maxmemory Policy Setup)
description: >-
  Resolve Redis 'OOM command not allowed when used memory > maxmemory' errors by
  setting proper eviction policies and RAM limits.
category: Systems & Servers
tags:
  - Redis
  - Databases
  - Sysadmin
readTime: 4 min
date: '2026-07-27'
---

The `OOM command not allowed when used memory > 'maxmemory'` error occurs when a Redis instance reaches its configured memory ceiling (`maxmemory`) while operating under the default `noeviction` policy. Under these conditions, Redis rejects all write operations (`SET`, `HSET`, `LPUSH`, `SADD`) with an Out-of-Memory exception to protect existing data from unmanaged deletion.

## 🔍 Quick Diagnostics

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| Write commands fail with `OOM command not allowed` | Memory hit the `maxmemory` threshold while using the default `noeviction` policy | Configure an automatic eviction policy (`allkeys-lru` / `volatile-lru`) or increase `maxmemory` |
| The Redis daemon is killed by the Linux Kernel (*OOM Killer*) | `redis.conf` lacks a explicit `maxmemory` boundary, exhausting host system RAM | Set an explicit `maxmemory` quota (e.g., 70-80% of total host physical memory) |
| High memory fragmentation ratio (`mem_fragmentation_ratio > 1.5`) | The Jemalloc allocator holds unreleased pages after bulk key deletion operations | Enable Redis active defragmentation (`activedefrag yes`) |

## 🚀 Step-by-Step Solution

### Step 1: Inspect Redis Memory Usage Statistics
Connect to your Redis instance using `redis-cli` and query the memory subsytem status:

```bash
# Connect via redis-cli
redis-cli -h 127.0.0.1 -p 6379

# Query memory statistics
127.0.0.1:6379> INFO memory

# Key fields to examine:
# used_memory_human:1.95G
# maxmemory_human:2.00G
# maxmemory_policy:noeviction
```

### Step 2: Change Eviction Policy (`maxmemory-policy`) Live
To restore service immediately without restarting your Redis cluster or process, update the eviction policy at runtime:

```bash
# Enable Least Recently Used (LRU) eviction across all keys
127.0.0.1:6379> CONFIG SET maxmemory-policy allkeys-lru

# Optional: Dynamically increase maxmemory if free host memory is available
127.0.0.1:6379> CONFIG SET maxmemory 3gb
```

Key Redis eviction policies explained:
- **`allkeys-lru`**: Evicts the least recently used keys out of all keys. Recommended for web caching layers.
- **`volatile-lru`**: Evicts least recently used keys among those with an explicit TTL set.
- **`allkeys-lfu`**: Evicts the least frequently used keys across the dataset.
- **`noeviction`**: Rejects all write commands with an OOM error (default setting).

### Step 3: Persist Changes in Configuration File (`redis.conf`)
To ensure settings persist across server reboots or container restarts, update your primary `redis.conf`:

```ini
# Path: /etc/redis/redis.conf or custom redis.conf

# Maximum RAM allocated to Redis (e.g., 2 Gigabytes)
maxmemory 2048mb

# Production eviction policy for cache workloads
maxmemory-policy allkeys-lru

# Enable background active defragmentation
activedefrag yes
```

Apply and verify the system service status:
```bash
sudo systemctl restart redis-server
```

## 🛡️ Prevention Advice

Recommended practices for long-term Redis memory management:
- **Enforce Key TTLs**: Always specify Time-To-Live expiration intervals when writing cache entries from application code (`SET key value EX 3600`) to enable natural key garbage collection.
- **Scan for Big Keys**: Routinely scan for bloated data structures using built-in analysis tools: `redis-cli --bigkeys` or `redis-cli --memkeys`.
- **Configure Memory Alerts**: Set up monitoring alerts in Prometheus or Datadog to notify team members when `used_memory` exceeds 80% of configured `maxmemory`.
