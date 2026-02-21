# Bolt's Journal - Performance Optimizations

## 2025-02-21 - [ASCII Player Optimization]
**Learning:** High-frequency animation loops (60 FPS) are often overkill for content that updates at lower frequencies (e.g., 15 FPS ASCII video). Caching layout calculations (DOM measurements) and font metrics in a `RenderState` object updated only via `ResizeObserver` eliminates redundant work on every frame.
**Action:** Always decouple content update frequency from browser refresh rate. Use `setTransform` instead of multiple `save`/`restore`/`translate`/`scale` calls for better canvas performance. Pre-allocate row buffers to minimize garbage collection.

## 2025-02-21 - [Astro v4 Endpoint Naming]
**Learning:** Astro v4 requires uppercase HTTP method exports (e.g., `GET`) for API endpoints. Lowercase `get` will cause build warnings and potential routing failures.
**Action:** Always use uppercase for HTTP method exports in Astro endpoints.
