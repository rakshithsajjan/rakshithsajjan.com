## 2026-03-04 - Layout and Font Metric Caching in Animation Loops
**Learning:** High-frequency animation loops (60fps) can be significantly throttled by redundant layout and font measurements, especially when the content refresh rate is lower (e.g., 15fps video). Caching these metrics in a persistent state object and only updating them via `ResizeObserver` or explicit changes can drastically reduce CPU overhead.
**Action:** Always decouple layout logic from the render loop. Use a state object to store pre-calculated dimensions, aspect ratios, and styles.
