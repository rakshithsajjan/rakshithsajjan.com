# Bolt Performance Journal

## 2025-05-15 - Initializing Bolt
**Learning:** Identifying the ASCII player as a performance bottleneck due to its high-frequency render loop (15+ FPS) and redundant per-frame calculations.
**Action:** Implement RenderState caching and O(1) character lookups to minimize CPU overhead in the animation loop.
