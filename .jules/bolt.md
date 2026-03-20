## 2025-05-14 - Optimizing ASCII Player Canvas Rendering

**Learning:** Accessing canvas dimensions (`canvas.width`, `canvas.height`) or resetting them in every frame of an animation loop (`requestAnimationFrame`) can be expensive as it forces the browser to re-allocate or reset the canvas context state. Similarly, repeatedly setting context properties like `font`, `fillStyle`, and `shadowBlur` inside the loop adds unnecessary overhead.

**Action:** Implement a `RenderState` object to cache layout and font metrics, updated only on container resize or manifest load. Move all static canvas state assignments into a dedicated update function called outside the hot render loop. Use `desynchronized: true` and `alpha: false` for the 2D context to further reduce latency and composition overhead.
