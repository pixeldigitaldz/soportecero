---
title: "How to Prevent Thermal Throttling on Raspberry Pi 5"
description: "Learn how to diagnose performance drops due to high temperatures and configure cooling thresholds on your Raspberry Pi 5 mini PC."
category: "Systems & Servers"
tags: ["Raspberry Pi", "Hardware", "Linux"]
readTime: "4 min"
date: "2026-07-20"
---

Thermal throttling on Raspberry Pi 5 occurs when the CPU temperature exceeds 80 °C under heavy workloads. To prevent heat damage, the PMIC (Power Management IC) automatically drops the processor frequency from 2.4 GHz to under 1.5 GHz, drastically degrading container or emulator performance.

## 🚀 Step-by-Step Solution

### Step 1: Monitor CPU temperature and throttling flags in real time
You can check current CPU temperatures and verify if the kernel has triggered clock speed reduction alerts via console:
```bash
# Query current CPU temperature in Celsius
vcgencmd measure_temp

# Check throttling history (a value other than 0x0 indicates heat or voltage limits hit)
vcgencmd get_throttled
```

### Step 2: Adjust fan cooling thresholds (Active Cooler)
Configure your official active cooler fan to spin up to 100% capacity before reaching the critical 80 °C threshold by adjusting firmware parameters:
```bash
# Open boot configuration file
sudo nano /boot/firmware/config.txt
```
Append the following lines to enforce more aggressive cooling starting at 65 °C:
```plaintext
# Force aggressive fan curves
dtparam=fan_temp0=50000
dtparam=fan_temp0_hyst=5000
dtparam=fan_temp1=58000
dtparam=fan_temp1_hyst=5000
dtparam=fan_temp2=65000
dtparam=fan_temp2_hyst=5000
```

### Step 3: Apply and verify config changes
Save the configuration by pressing `Ctrl + O` and restart the board to load the new firmware parameters:
```bash
# Reboot the Raspberry Pi
sudo reboot
```

## 🛡️ Prevention Advice
Recommended security practices:
- Do not deploy Raspberry Pi 5 servers in completely closed cases lacking active ventilation. Under maximum load, the Pi 5 generates nearly double the thermal output of the Pi 4, meaning passive heatsinks alone will saturate thermal limits quickly, keeping your CPU throttled.
