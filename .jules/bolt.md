## 2025-05-15 - Layout Thrashing in Animation Loops
**Learning:** Accessing layout-triggering properties like `offsetWidth` or `measureText` inside a `requestAnimationFrame` loop causes synchronous reflows (layout thrashing), which significantly degrades performance, especially at high frame rates. In the ASCII player, this was happening every frame.
**Action:** Cache layout-dependent values in a state object and only update them when the container size changes (e.g., via `ResizeObserver`). This decouples layout measurement from the render loop.

## 2025-05-15 - Astro v4 RSS Endpoint Requirements
**Learning:** In Astro v4, RSS endpoints (and API routes in general) should use the `GET` function export instead of `get` (case sensitivity) and must return a standard `Response` object. Top-level await in these files can also lead to build-time instability in some environments.
**Action:** Use `export const GET = async () => { ... }` and ensure all content fetching/parsing happens inside the handler to improve build robustness.
