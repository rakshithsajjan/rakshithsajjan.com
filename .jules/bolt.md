# Bolt's Journal - Critical Learnings

## 2025-05-14 - Decoupling Content FPS and Layout in Animation Loops
**Learning:** In loop-based UI components (like ASCII players or custom canvas animations), recalculating layout metrics, font sizes, and canvas properties every frame is a major bottleneck. Even if the content changes (e.g., at 15 FPS), the browser might run the `requestAnimationFrame` loop at 60Hz or higher. Moving these calculations into a `RenderState` object updated only via `ResizeObserver` or initialization dramatically reduces CPU overhead and avoids potential layout thrashing from frequent canvas/DOM interactions.
**Action:** Always check if animation loops are performing redundant math or property assignments. Hoist static/semi-static state into observer-driven caches.
