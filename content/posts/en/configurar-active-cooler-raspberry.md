---
title: How to Configure Active Cooler Fan Speeds and Temperature Thresholds on Raspberry Pi
description: >-
  Learn how to customize Active Cooler PWM fan curves, temperature trip points,
  and cooling parameters on Raspberry Pi 5 via config.txt and the Linux terminal.
category: Systems & Servers
tags:
  - Hardware
  - Linux
  - Raspberry Pi
  - Sysadmin
  - DevOps
readTime: 5 min
date: '2026-07-19'
---

Modern single-board computers (SBCs) and edge appliances—such as the **Raspberry Pi 5**—deliver high-performance computing capabilities with quad-core Cortex-A76 silicon. However, running sustained multi-container Docker workloads, Nextcloud sync hubs, or Plex transcoding stacks quickly generates substantial thermal output. Without proactive cooling management, the SoC will reach its 80°C threshold and initiate aggressive **thermal throttling**, dropping clock frequencies to prevent permanent silicon degradation.

The official Raspberry Pi Active Cooler features an aluminum heatsink combined with a variable-speed PWM blower fan. While the default firmware profile manages fan activation automatically, its factory trip points allow the board to run near 60°C before initiating low-speed airflow. By customizing these Device Tree parameters in `/boot/firmware/config.txt`, you can establish aggressive cooling curves that maintain operating temperatures below 45°C under continuous load.

## Quick Diagnostics
| Cause | Solution |
|---|---|
| **High idle temperatures (>60°C) due to conservative default firmware curve** | Define lower thermal trip points in `/boot/firmware/config.txt` |
| **PWM fan not spinning or operating only at 100% full speed** | Verify connection to dedicated JST-SH 4-pin fan header rather than generic GPIO pins |
| **Outdated EEPROM firmware lacking advanced cooling overlays** | Run `sudo rpi-eeprom-update -a` and apply the latest system firmware |

## 🚀 Step-by-Step Implementation Guide

### Step 1: Measure Real-Time SoC Temperatures and Fan RPM
Before altering thermal curves, inspect your current processor temperature and fan state using official hardware telemetry tools:
```bash
# Query the Broadcom / RP1 temperature sensor
vcgencmd measure_temp

# Inspect fan speed (RPM) and cooling state via Linux sysfs
cat /sys/devices/platform/cooling_fan/hwmon/hwmon*/fan1_input
```
A healthy baseline under light desktop or daemon loads should hover between 38°C and 45°C.

### Step 2: Edit the Firmware Configuration File
On modern Debian/Ubuntu-based distributions for Raspberry Pi (such as Raspberry Pi OS Bookworm), Device Tree configuration is located in the dedicated firmware partition:
```bash
sudo nano /boot/firmware/config.txt
```
*(Note: On legacy operating system releases based on Bullseye or older kernels, this file was located directly at `/boot/config.txt`).*

### Step 3: Define Custom Temperature Trip Points (Device Tree Overlays)
Scroll to the end of `/boot/firmware/config.txt` and append custom `dtparam` cooling rules. Temperature values are expressed in millidegrees Celsius (e.g., `45000` corresponds to 45°C), while `hyst` values define hysteresis degrees to prevent the fan from constantly pulsing on and off around boundary temperatures:
```plaintext
# Custom Active Cooler Thermal Profile (Aggressive Curve)
dtparam=fan_temp0=42000
dtparam=fan_temp0_hyst=3000
dtparam=fan_temp0_speed=75

dtparam=fan_temp1=50000
dtparam=fan_temp1_hyst=3000
dtparam=fan_temp1_speed=125

dtparam=fan_temp2=58000
dtparam=fan_temp2_hyst=3000
dtparam=fan_temp2_speed=175

dtparam=fan_temp3=68000
dtparam=fan_temp3_hyst=3000
dtparam=fan_temp3_speed=255
```
*(Explanation: Speed values range from `0` to `255`, where 75 corresponds to ~30% quiet whisper mode, 125 represents ~50% steady airflow, and 255 drives full 100% cooling capability).*

Save your edits by pressing `Ctrl + O`, confirm with `Enter`, and exit nano using `Ctrl + X`.

### Step 4: Reboot to Apply Firmware Parameters
Apply the new hardware registers by executing a clean system restart:
```bash
sudo reboot
```

### Step 5: Stress Test Thermal Stability Under Load
Once your system boots, run a synthetic CPU stress test to verify that the fan ramps through each configured trip point smoothly:
```bash
# Install stress-ng benchmarking tool
sudo apt update && sudo apt install -y stress-ng

# Stress all 4 CPU cores for 60 seconds while monitoring temps
stress-ng --cpu 4 --timeout 60s & watch -n 1 vcgencmd measure_temp
```

## 🛡️ Hardware Safety & Best Practices
- **Use Dedicated JST-SH 4-Pin Fan Connectors:** Never attempt to power generic 2-pin fans from GPIO pins 1 (3.3V) or 2/4 (5V) if you require PWM modulation. Generic GPIO pin power draws can cause voltage fluctuations, triggering power supply undervoltage warnings (`vcgencmd get_throttled`).
- **Thermal Pad Placement:** Ensure the pre-applied thermal pads on your Active Cooler make direct, flush contact with both the BCM2712 application processor and the RP1 southbridge controller before securing the spring-loaded push pins.

## Frequently Asked Questions (FAQ)

### Can I manually override fan speed on demand from the Linux command line?
Yes. You can write raw PWM values directly to the kernel thermal sysfs interface:
`echo 150 | sudo tee /sys/class/thermal/cooling_device0/cur_state`. Note that automatic firmware thermal management will resume as soon as the SoC hits the next defined trip point.

### Will running the fan at 100% speed shorten its operational lifespan?
The Active Cooler utilizes high-durability fluid dynamic bearings rated for tens of thousands of continuous operational hours. Setting an aggressive curve with stepped stages (e.g., 30% at 42°C) keeps noise virtually inaudible while easily preventing extreme temperature spikes.
