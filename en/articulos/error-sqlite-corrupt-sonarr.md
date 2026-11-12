---
title: How to Repair Corrupted SQLite Database in Sonarr, Radarr, and Servarr Stacks
description: >-
  Learn how to fix the 'database disk image is malformed' SQLite error in Sonarr and Radarr.
  Use sqlite3 recovery tools, restore automated scheduled backups, and resolve WAL journal corruption.
category: Systems & Servers
tags:
  - Sonarr
  - Radarr
  - Database
  - SQLite
  - Docker
  - Linux
readTime: 5 min
date: '2026-07-27'
---

Encountering a fatal `database disk image is malformed` error or `SQLite error (11): database disk image is malformed` in application logs for **Sonarr**, **Radarr**, **Lidarr**, or **Prowlarr** is one of the most disruptive incidents in a home server or NAS setup. When this error occurs, the Servarr daemon crashes immediately or displays an empty media library, preventing indexer synchronization, automated torrent grabbing, and metadata management.

This failure occurs when SQLite's internal B-tree page pointers, Write-Ahead Logging (`-wal`) journals, or index structures become corrupted due to unexpected host reboots, sudden power outages, underlying disk I/O errors, or hosting SQLite database files across network filesystems (such as NFS or SMB/CIFS) that lack POSIX byte-range locking consistency.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **Abrupt server shutdown interrupting Write-Ahead Log (WAL) commit** | Rebuild database using `sqlite3 .recover` pipeline into a clean database |
| **Corrupted B-tree index tables with healthy table records** | Restore an automatic scheduled `.zip` backup from the `Backups/scheduled/` folder |
| **Active process holding conflicting lock on `sonarr.db-wal` or `sonarr.db-shm`** | Stop the Docker container before inspecting or copying database files |
| **Database hosted on NFS/SMB network shares lacking POSIX flock support** | Move the appdata config folder to a local SSD or local block mount |

## 🚀 Step-by-Step Implementation Guide

### Method 1: Restore an Automated Scheduled Backup (Fastest & Safest)
Sonarr and Radarr automatically generate scheduled internal database backups before running migrations and updates. Restoring an uncorrupted backup is the most reliable recovery path:

1. Stop the application container to release any open file locks:
```bash
docker stop sonarr
```
2. Navigate to your application's config directory (e.g., `/home/username/appdata/sonarr` or `/docker/sonarr`):
```bash
cd ~/appdata/sonarr
ls -lh Backups/scheduled/
```
3. Identify the newest backup archive (e.g., `sonarr_backup_2026.07.25.zip`).
4. Move the corrupted database files to a backup location:
```bash
mkdir -p corrupt_backup
mv sonarr.db* corrupt_backup/
```
5. Extract the healthy database from the zip archive:
```bash
unzip Backups/scheduled/sonarr_backup_*.zip sonarr.db
```
6. Set correct user ownership (typically UID 1000 or the PUID/PGID configured in your compose file):
```bash
chmod 664 sonarr.db
sudo chown 1000:1000 sonarr.db
```
7. Restart the container:
```bash
docker start sonarr
```

### Method 2: Repair the Corrupted Database via SQLite3 CLI (.recover)
If you do not have a recent backup or cannot afford to lose recently added media, use SQLite's native recovery engine to extract intact records from readable pages into a fresh database schema:

1. Ensure the container is stopped:
```bash
docker stop sonarr
```
2. Install the SQLite command-line tool if not already present on your host:
```bash
sudo apt-get install -y sqlite3 2>/dev/null || sudo pacman -S --noconfirm sqlite
```
3. Navigate to the database folder:
```bash
cd ~/appdata/sonarr
```
4. Verify the extent of corruption using SQLite's integrity pragma:
```bash
sqlite3 sonarr.db "PRAGMA integrity_check;"
```
5. Pipe all recovered records through the `.recover` command into a clean database file:
```bash
# Extract healthy data into a pristine database
sqlite3 sonarr.db ".recover" | sqlite3 sonarr_recovered.db
```
6. Check the integrity of the newly generated database:
```bash
sqlite3 sonarr_recovered.db "PRAGMA integrity_check;"
```
*(The output should return `ok`).*
7. Backup the original file and replace it with the recovered database:
```bash
mv sonarr.db sonarr_corrupted.db.bak
mv sonarr_recovered.db sonarr.db
# Remove stale journal files if present
rm -f sonarr.db-wal sonarr.db-shm
```
8. Ensure correct permissions and restart:
```bash
chmod 664 sonarr.db
sudo chown 1000:1000 sonarr.db
docker start sonarr
```

## 🛡️ Best Practices & Corruption Prevention
- **Never Mount SQLite Databases Over NFS or SMB/CIFS:** SQLite requires atomic, POSIX-compliant file locking (`flock` / `fcntl`). Network protocols introduce latency and inconsistent lock synchronization, which inevitably leads to corrupted page headers. Always host `/config` on a local NVMe or SATA SSD, mounting only media storage directories over network shares.
- **Configure Automated Daily Appdata Backups:** Use scripts or tools like Kopia, Restic, or Borg to snapshot your appdata directories while services are gracefully paused.

## Frequently Asked Questions (FAQ)

### What are the `sonarr.db-wal` and `sonarr.db-shm` files?
In SQLite's Write-Ahead Logging (WAL) mode, changes are written to `sonarr.db-wal` before being checkpointed back into `sonarr.db`. The `sonarr.db-shm` file is a shared-memory index used by concurrent readers. Never delete or move these files while Sonarr is actively running.

### Can I migrate Sonarr from SQLite to PostgreSQL?
Yes. Modern releases of Sonarr v4 and Radarr v5 provide built-in support for PostgreSQL backends. If your server manages a massive library (e.g., over 50,000 items), migrating to PostgreSQL eliminates SQLite file-locking constraints entirely.
