## 2024-05-23 - [Optimized ASCII Player Canvas Rendering]
**Learning:** In high-frequency canvas animation loops (15 FPS in this case), repeated access to DOM properties like `clientWidth` or `clientHeight` causes "Layout Thrashing" by forcing the browser to recalculate the layout on every frame. Additionally, recreating large arrays (like a row buffer for character data) every frame increases Garbage Collection pressure.

**Action:**
1. Move layout-dependent calculations to a `ResizeObserver` or an initialization step and cache them in a state object.
2. Pre-allocate and reuse buffers for intermediate data processing.
3. Cache context properties (like `font`, `fillStyle`) and invariant transformations to minimize the number of calls to the Canvas API.
