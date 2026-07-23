## 2024-03-24 - [OpenAPI Component Caching]
**Learning:** In large OpenAPI specs, converting component schemas repeatedly during method extraction can cause massive redundant processing.
**Action:** Memoize pure component conversions per spec/instance to avoid O(N * C) redundant work.
