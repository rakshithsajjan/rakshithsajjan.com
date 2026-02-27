## 2024-05-15 - Redundant Canvas Resizing in Animation Loops

**Learning:** Assigning values to `canvas.width` or `canvas.height` in every frame of an animation loop (e.g., 15+ FPS) is a significant performance bottleneck. Even if the value hasn't changed, the assignment triggers the browser to reset the 2D context state (font, fillStyle, etc.) and potentially reallocate internal buffers.

**Action:** Always check if dimensions have actually changed before assigning to `canvas.width/height`. Cache layout and context state (font, shadow, etc.) in a persistent object and only update it during initialization or on resize via `ResizeObserver`.
