## 2025-05-14 - Redundant rendering in ASCII player
**Learning:** The ASCII player's `tick` function calls `drawFrame` on every `requestAnimationFrame` (typically 60fps), even if the content frame hasn't changed (typically 15fps). Additionally, `drawFrame` performs expensive canvas resizing and layout calculations on every call.
**Action:** Cache layout/style state in a `RenderState` object and only re-calculate on resize. Only trigger `drawFrame` when the content frame index actually changes.
