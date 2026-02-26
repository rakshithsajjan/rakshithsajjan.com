## 2025-05-15 - Redundant ASCII Player Layout Calculations

**Learning:** The ASCII video player was re-calculating font metrics, column/row counts, and resetting the canvas context (via `canvas.width/height` assignments) on every single `requestAnimationFrame`. This resulted in high CPU usage and redundant processing for static or slow-changing video content. Decoupling layout math into a `RenderState` updated only via `ResizeObserver` and using `{ alpha: false }` for the 2D context significantly improves efficiency.

**Action:** In high-frequency render loops (15+ FPS), cache all layout, font, and color calculations in a structured state object. Only update this state on resize or initialization. Ensure canvas state resets (like resizing) are only triggered when dimensions actually change.
