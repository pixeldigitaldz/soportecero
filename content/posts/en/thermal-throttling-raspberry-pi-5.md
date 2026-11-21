---
title: How to Prevent Thermal Throttling on Raspberry Pi 5
description: >-
  Learn how to diagnose performance drops due to high temperatures and configure
  cooling thresholds on your Raspberry Pi 5 mini PC.
category: Systems & Servers
tags:
  - Raspberry Pi
  - Hardware
  - Linux
readTime: 5 min
date: '2026-07-20'
---

Thermal throttling on the Raspberry Pi 5 occurs when the BCM2712 SoC approaches its 80 °C soft limit or 85 °C hard limit under sustained workloads. When triggered, the board's firmware and PMIC step down the ARM Cortex-A76 cores from 2.4 GHz to 1.5 GHz or lower, causing severe latency spikes in Docker containers, media transcoding, and compilation jobs.

## Quick Diagnostics

| Symptom / Flag | Immediate Action |
|---|---|
| **`vcgencmd measure_temp` exceeds 80.0 °C** | Install an active PWM cooler or improve enclosure airflow |
| **`vcgencmd get_throttled` returns `0x20002` or `0x40004`** | CPU is currently throttled due to temperature limit |
| **`vcgencmd get_throttled` returns `0x50000` or `0x50005`** | Undervoltage detected; upgrade to an official 5V/5A USB-C PD PSU |
| **Fan stays silent until 60 °C+ under burst loads** | Lower `fan_temp0` thresholds in `/boot/firmware/config.txt` |

## Root Cause & Technical Mechanics

The Raspberry Pi 5 pairs a 16 nm quad-core Cortex-A76 SoC (BCM2712) with the custom RP1 I/O controller and a Renesas DA9091 PMIC. Under full multi-core load, the SoC draws roughly 10–12 W—nearly double the thermal density of the Raspberry Pi 4. Because the board lacks a large heat spreader, bare silicon temperatures climb from 45 °C idle to over 82 °C in less than 90 seconds without active airflow.

The VideoCore VII firmware enforces two thermal protection tiers: at **80 °C**, the `soft_temp_limit` begins reducing CPU clock multipliers; at **85 °C**, aggressive throttling clamps frequencies and voltages to prevent permanent silicon degradation. Simultaneously, the kernel's `thermal_zone0` governor drives the dedicated 4-pin JST PWM fan header using four temperature trip points (`fan_temp0` through `fan_temp3`). Out of the box, the default curve waits until 50 °C to spin up at low RPM and only reaches full speed at 75 °C, allowing sudden CPU bursts to hit the 80 °C ceiling before airflow catches up.

## Step-by-Step Solution

### Step 1: Inspect live temperature, clock speed, and throttle bitmask

Run `vcgencmd` to separate thermal throttling from power-delivery undervoltage:

```bash
vcgencmd measure_temp
vcgencmd measure_clock arm
vcgencmd get_throttled
```

Decode the hexadecimal bitmask from `vcgencmd get_throttled`:
- `0x0`: No throttling or undervoltage has occurred since boot.
- Bit 1 (`0x2`) / Bit 17 (`0x20000`): ARM frequency capped currently / since boot.
- Bit 2 (`0x4`) / Bit 18 (`0x40000`): Currently thermally throttled / throttled since boot.
- Bit 0 (`0x1`) / Bit 16 (`0x10000`): Undervoltage detected—check your 5V/5A (27W) USB-C PD power supply.

You can also read the sysfs PWM fan state directly:

```bash
cat /sys/class/thermal/thermal_zone0/temp
cat /sys/class/hwmon/hwmon*/fan1_input
```

### Step 2: Tune the PWM fan curve in firmware configuration

Open `/boot/firmware/config.txt` (on Raspberry Pi OS Bookworm and newer; older builds use `/boot/config.txt`):

```bash
sudo nano /boot/firmware/config.txt
```

Append these `dtparam` trip points (values are in millidegrees Celsius, so `45000` equals 45 °C) under `[all]`:

```ini
[all]
dtparam=fan_temp0=45000
dtparam=fan_temp0_hyst=5000
dtparam=fan_temp0_speed=75
dtparam=fan_temp1=55000
dtparam=fan_temp1_hyst=5000
dtparam=fan_temp1_speed=125
dtparam=fan_temp2=63000
dtparam=fan_temp2_hyst=5000
dtparam=fan_temp2_speed=200
dtparam=fan_temp3=70000
dtparam=fan_temp3_hyst=5000
dtparam=fan_temp3_speed=255
```

This ramps the fan smoothly from ~30% PWM at 45 °C to 100% (`255`) at 70 °C, giving a 10 °C safety margin before the 80 °C throttle line.

### Step 3: Reboot and stress-test thermal stability

Reboot to apply the device tree parameters:

```bash
sudo reboot
```

After rebooting, run a 3-minute synthetic load using `stress-ng` (install via `sudo apt install -y stress-ng`) while watching temperature and clock frequency:

```bash
watch -n 2 "vcgencmd measure_temp && vcgencmd measure_clock arm && vcgencmd get_throttled" &
stress-ng --cpu 4 --timeout 180s
```

Your ARM clock should remain locked at `2400000000` Hz (2.4 GHz) and `get_throttled` should stay `0x0`.

## Frequently Asked Questions

**Can I raise `temp_limit` above 85 °C in `config.txt`?**
No. While `temp_soft_limit` can be adjusted slightly on some older boards, Raspberry Pi 5 firmware caps the hard limit at 85 °C for silicon safety. Overriding it is unsupported and risks hardware failure.

**Does an NVMe HAT affect Raspberry Pi 5 CPU temperatures?**
Yes. M.2 HATs mounted directly above the SoC trap rising heat and add 3–5 W of SSD thermal load. Use taller brass standoffs, a bottom-mounted NVMe base, or the official Active Cooler underneath the HAT.

**Why does `vcgencmd get_throttled` show `0x50000` even when my CPU is cool?**
Bits 16 and 18 (`0x50000`) indicate past undervoltage and throttling, often caused by a phone charger or thin USB-C cable dropping voltage below 4.63 V under load. Always use a 5V/5A USB-C PD supply.

## Prevention Advice

- **Use active PWM cooling:** Passive stick-on heatsinks saturate quickly on the Pi 5; pair an aluminum heatsink with a 4-pin PWM fan connected to the onboard fan header.
- **Avoid sealed plastic enclosures:** Choose open-frame cases or ventilated aluminum chassis with intake/exhaust slots.
- **Keep firmware updated:** Run `sudo rpi-eeprom-update` periodically to receive PMIC and thermal governor improvements.
- **Monitor NVMe and RP1 temperatures:** Ensure airflow also passes over the RP1 southbridge and any PCIe NVMe SSD during sustained I/O.
