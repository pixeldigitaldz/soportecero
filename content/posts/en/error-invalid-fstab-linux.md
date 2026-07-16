---
title: "Fix: Linux Boot Failure due to Incorrect Configuration in /etc/fstab"
description: "Learn how to repair your Linux system if it fails to boot and gets stuck in Emergency Mode due to an error in the fstab file."
category: "Systems & Servers"
tags: ["Linux", "Sysadmin", "Terminal"]
readTime: "5 min"
date: "2026-07-30"
---

Modifying the `/etc/fstab` file to mount secondary hard drives or swap partitions (SWAP) is common, but a single typo, an extra space, or a non-existent disk UUID will cause your Linux distribution to fail to boot, sending you directly to a black screen displaying the error message `Welcome to emergency mode!`.

## 🚀 Step-by-Step Solution

### Step 1: Gain write access
In emergency mode, the file system is typically locked in "Read-Only" mode, meaning you won't be able to save any corrections. Execute this command to unlock it:
```bash
mount -o remount,rw /
```

### Step 2: Edit the file with caution
Open the configuration file using the console's built-in text editor:
```bash
nano /etc/fstab
```

### Step 3: Comment out or repair the corrupt line
Find the last line you added (the one for the new disk or SWAP). If you are not sure what the syntax error is, insert a hash symbol # at the beginning of that entire line. This tells Linux to ignore that instruction during boot:
```plaintext
# /swapfile none swap sw 0 0
```
Save the changes by pressing Ctrl + O, press Enter, and exit with Ctrl + X.

### Step 4: Test and reboot
Before rebooting blindly, tell the system to check if the syntax of the fstab file is correct:
```bash
findmnt --verify
```
If the terminal does not output red error lines, you can perform a clean reboot to return to your desktop environment:
```bash
reboot
```

## 🛡️ Prevention Advice

Recommended security practices:
* When adding secondary disks in /etc/fstab, always use the nofail property in the parameters (e.g., defaults,nofail). This way, if the external disk is disconnected or fails, Linux will bypass mounting it and boot normally instead of crashing into emergency mode.
