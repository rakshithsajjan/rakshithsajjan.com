## 2025-05-14 - [ASCII Player Layout Thrashing]
**Learning:** Decoupling layout calculations (font measurement, canvas resizing, scale calculation) from high-frequency `requestAnimationFrame` loops is critical for maintaining consistent FPS and reducing CPU overhead in Astro/TS components. Even simple property access like `container.clientWidth` can trigger layout recalculations if the DOM has been modified elsewhere.
**Action:** Use a `RenderState` object to cache layout metrics, updated via `ResizeObserver` or explicit events, instead of recalculating per-frame.

## 2025-05-14 - [Garbage Collection in Render Loops]
**Learning:** Pre-allocating reuseable buffers (like `rowBuffer` for canvas row operations) outside the main render loop significantly reduces garbage collection pressure, which is vital for smooth animations on low-power devices.
**Action:** Always look for array/object allocations inside `requestAnimationFrame` or `setInterval` and move them to a persistent state.
