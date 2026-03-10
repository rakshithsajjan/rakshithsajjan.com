## 2025-05-15 - Canvas Optimization in High-Frequency Loops
**Learning:** Assigning values to `canvas.width` or `canvas.height` resets the 2D context state (font, fillStyle, shadowBlur, etc.), even if the values are the same. This forces redundant state re-assignments and context re-initialization every frame.
**Action:** Always check if dimensions have changed before assignment. Cache context settings in a `RenderState` object and only re-apply them when the canvas size actually changes or the state is initialized.

## 2025-05-15 - Optimization Overhead
**Learning:** `console.time` and `console.timeEnd` add measurable overhead and log noise when placed inside hot loops (e.g., `requestAnimationFrame` at 60 FPS).
**Action:** Remove performance timing logs before finalizing production-ready code. Use external profiling tools or temporary measurement scripts instead.
