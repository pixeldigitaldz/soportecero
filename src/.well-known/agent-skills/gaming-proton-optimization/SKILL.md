# Gaming Tech and Proton Optimization

Optimize game stability, resolve DXVK/VKD3D crashes, eliminate stuttering from shader compilations, and configure Wayland fractional scaling for PC gaming on Linux and Steam Deck.

## When to Use

Use this skill when diagnosing game crashes (e.g., VK_ERROR_DEVICE_LOST, DXGI_ERROR_DEVICE_HUNG), micro-stutters, pipewire audio crackling, or controller disconnects under Steam, Gamescope, or Lutris.

## Requirements

- Inspect Vulkan and DXVK shader cache configuration (`DXVK_HUD`, `mesa_glthread`).
- Configure Gamescope and Wine/Proton launch options appropriately.
- Check GPU hang logs with `dmesg | grep -i amdgpu` or `nvidia-smi`.
- Apply targeted environment flags per the game-specific guides on SoporteCero.
