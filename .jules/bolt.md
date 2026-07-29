## 2025-04-23 - Memoize OpenAPI Component Resolution
**Learning:** During OpenAPI parsing, iterating over component schemas dynamically per API path results in explosive O(N*M) time complexity. For large APIs like Notion, this severely delays startup time and tool instantiation.
**Action:** When transforming static API specifications (like OpenAPI to MCP), identify repetitive schema evaluations and memoize them at the converter instance level.
