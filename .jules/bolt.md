## 2025-05-22 - ASCII Player Redundant Renders
**Learning:** The ASCII player was redrawing every requestAnimationFrame (60fps) even though the content only updates at 15fps. Additionally, it was resetting canvas dimensions and recalculating layout every single frame, causing significant CPU overhead and layout thrashing.
**Action:** Decouple layout/dimension calculations from the render loop. Use a `RenderState` object updated by `ResizeObserver`. Only redraw when the frame index actually changes or after a resize.
