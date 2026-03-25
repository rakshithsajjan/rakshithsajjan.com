# Bolt's Performance Journal

## 2025-05-15 - Optimizing ASCII player and fixing RSS export
**Learning:** High-frequency render loops (15+ FPS) like the ASCII player are sensitive to redundant context state assignments (e.g., `font`, `fillStyle`) and layout-triggering DOM properties (e.g., `clientWidth`, `clientHeight`). Assigning to `canvas.width` or `canvas.height` resets the 2D context state, requiring it to be reapplied.

**Action:** Implement a `RenderState` object to cache layout and font metrics, updated only via `ResizeObserver`. Centralize context state assignments to avoid redundant updates within the render loop. Fix `marked` usage and RSS export case for Astro v4 compatibility.
