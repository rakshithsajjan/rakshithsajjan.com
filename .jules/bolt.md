## 2025-05-14 - Canvas Render Loop Optimization
**Learning:** Assigning to `canvas.width` or `canvas.height` resets the entire 2D context state (font, fillStyle, etc.), even if the value is the same. Redundant state assignments and layout calculations in high-frequency (15-60 FPS) render loops cause significant CPU overhead and GC pressure.
**Action:** Always cache canvas dimensions and layout metrics. Only update `canvas.width`/`height` and recalculate layout when a resize is detected (e.g., via `ResizeObserver`). Pre-allocate buffers for string manipulation to minimize garbage collection.
