## 2025-04-10 - OpenAPI Parser Component Schema Caching
**Learning:** The `OpenAPIToMCPConverter` traverses the entire OpenAPI schema components definition repeatedly for every input/output extraction to gather the `#/$defs`. For large API specs (like Notion's), this causes an O(M * N) overhead where M is the number of operations and N is the number of component schemas.
**Action:** Cache deterministic conversions like `convertComponentsToJsonSchema()` at the class instance level when they operate on immutable configuration data.
