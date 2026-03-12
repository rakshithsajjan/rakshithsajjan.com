# Bolt Performance Journal

## 2025-05-15 - ASCII Player Optimization Initial Audit
**Learning:** The `drawFrame` function in `ascii-player.ts` performs redundant layout calculations, font setting, and canvas resizing on every frame (15 FPS). `ctx.save()`/`ctx.restore()` and `rowBuffer` allocation also contribute to overhead.
**Action:** Move static layout metrics to a cached `RenderState`, pre-allocate buffers, and minimize context state changes.
