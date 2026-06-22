## 2025-05-15 - [Search Optimization and RSS API Fix]
**Learning:** Adding a debounce to the search input improves performance by reducing the frequency of filtering and DOM updates during rapid typing. Additionally, Astro v4 API endpoints are case-sensitive and must export `GET` (uppercase) to be recognized and should return a standard `Response` object for better compatibility.
**Action:** Always implement debouncing for search inputs to reduce overhead, and ensure Astro API endpoints follow the expected casing and return types to avoid build warnings and errors.
