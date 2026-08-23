## 2026-08-23 - Prevent sensitive data leakage in Axios error logs
**Vulnerability:** Logging raw Axios/openapi-client-axios error objects (`console.error(error)`) exposes sensitive request headers, such as `Authorization: Bearer <TOKEN>`, which are included in `error.config.headers`.
**Learning:** The default behavior of `console.error` with complex objects dumps the entire prototype chain and attached properties, which for network request libraries often includes the original request configuration containing auth tokens.
**Prevention:** Always sanitize error logs when handling network requests. Extract and log only safe, specific properties like `error.message` and `error.response.status` instead of the full error object.
