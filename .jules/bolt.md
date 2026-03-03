# Bolt's Performance Journal

## 2025-03-03 - Render Loop Caching and Context Optimization
**Learning:** In high-frequency animation loops (15+ FPS), context state changes (font, fillStyle, transforms) and layout calculations are major bottlenecks. Assigning values to canvas.width/height also resets context state. Using { alpha: false } improves throughput but requires manual background clearing.
**Action:** Always cache layout and font metrics in a dedicated state object updated only via ResizeObserver. Use persistent buffers for per-frame data. Skip redundant draw calls if the source data hasn't changed between screen refreshes.
