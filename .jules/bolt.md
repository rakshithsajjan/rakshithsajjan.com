# Bolt's Performance Journal

## 2025-05-14 - Canvas Optimization for ASCII Animation
**Learning:** Assigning values to `canvas.width` or `canvas.height` resets the entire 2D context state (font, fillStyle, etc.), even if the values are identical. In high-frequency render loops, this causes massive redundant state resets. Additionally, decoupling the rendering FPS (15fps) from the display refresh rate (60Hz) reduces CPU usage by ~75% without visual degradation for video-based content.
**Action:** Always wrap canvas dimension assignments in equality checks. Cache all font and layout calculations in a dedicated state object that is only updated on resize.

## 2025-05-14 - Marked Library v17+ Compatibility
**Learning:** In newer versions of `marked`, the library uses named exports and `marked.parse()` is an asynchronous method. Calling `marked()` as a function or expecting synchronous results in an Astro build environment will cause failures.
**Action:** Use `import { marked } from 'marked'` and `await marked.parse(content)`. For RSS feeds, perform this parsing at the top level or within the GET handler to ensure build-time generation.
