## 2024-05-24 - Animation loop optimizations in Astro/TypeScript
**Learning:** High-frequency animation loops (using `requestAnimationFrame`) can cause significant CPU/GPU overhead if layout measurements (`clientWidth`, `measureText`) or canvas state resets (`canvas.width = ...`) occur every frame. Additionally, mapping video time to discrete ASCII frames requires throttling the draw calls to the video's actual frame rate to avoid redundant rendering.
**Action:** Always cache layout metrics in a state object updated only via `ResizeObserver` or initialization. Use `{ alpha: false }` for canvas contexts when transparency is not needed. Implement frame index comparison to skip `draw()` calls if the video time hasn't advanced to the next discrete frame.

## 2024-05-24 - Astro 4 RSS Feed & Markdown parsing
**Learning:** Migrating to Astro 4 require updating RSS endpoints to use the `GET` function signature. Furthermore, modern `marked` library versions (v17+) have shifted to asynchronous parsing. If used within an Astro static build, this must be `await`ed to prevent "Build was canceled" errors during SSG.
**Action:** Use `export async function GET(context)` for RSS endpoints and `await marked.parse()` for Markdown content to ensure build stability and API compatibility.
