## 2025-05-15 - Canvas State Reset via Width/Height Assignment
**Learning:** Assigning values to `canvas.width` or `canvas.height` resets the entire 2D context state (font, fillStyle, etc.), even if the values are identical to the previous ones.
**Action:** Always check if dimensions have actually changed before assigning to `canvas.width/height` to avoid redundant state resets in high-frequency render loops.

## 2025-05-15 - Marked v17+ Async Requirements
**Learning:** Modern `marked` versions no longer support synchronous parsing in certain environments or when using modern features.
**Action:** Always use `await marked.parse(content)` instead of `marked(content)` to ensure compatibility with v17+ of the library.

## 2025-05-15 - ASCII Animation Loop Optimization
**Learning:** To minimize CPU overhead and GC pressure in high-frequency loops (15+ FPS), decoupling content FPS from refresh rates and caching layout/color metrics in a persistent state object updated via `ResizeObserver` is more efficient than recalculating per frame.
**Action:** Implement a dedicated `RenderState` object and use `{ alpha: false, desynchronized: true }` context attributes for low-latency canvas rendering.
