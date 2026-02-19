# Bolt's Performance Journal

## 2025-01-24 - Initial Audit
**Learning:** Found multiple performance bottlenecks in the custom ASCII video player:
1. Canvas resizing and layout calculations are performed every frame.
2. The animation loop re-draws the same frame at 60fps even if the video is 15fps.
3. Expensive canvas operations like `measureText` and shadow settings are repeated unnecessarily.
**Action:** Refactor `ascii-player.ts` to cache layout state, only re-draw when the frame changes or on resize, and minimize redundant API calls.
