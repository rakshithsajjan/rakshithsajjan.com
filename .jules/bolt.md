## 2025-05-15 - Canvas State Reset Optimization
**Learning:** Assigning values to `canvas.width` or `canvas.height` resets the entire 2D context state (font, fillStyle, textBaseline, etc.), even if the values are identical to current ones. In high-frequency render loops (e.g., ASCII player at 15+ FPS), this causes redundant state reassignment and performance degradation.
**Action:** Always check if dimensions have changed before assigning to `canvas.width` or `canvas.height`. Decouple layout/metric calculations into a `RenderState` object that is only updated on resize or initialization, minimizing the work done per frame.

## 2025-05-15 - Modern Astro API Routes and Markdown Parsing
**Learning:** Astro v4 API endpoints (e.g., `rss.xml.ts`) should use the `export async function GET(context)` signature and return a `Response` object. When using the `marked` library (v17+), the `marked.parse()` method is asynchronous; failing to await it can lead to build cancellations or runtime errors.
**Action:** Use the `GET` signature for API routes and always `await marked.parse()` for Markdown content. Ensure the `Response` has the correct `content-type`.
