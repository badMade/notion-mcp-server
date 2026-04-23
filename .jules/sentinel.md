## 2025-03-09 - [Logging Full Axios Errors Leaks Credentials]
**Vulnerability:** Logging the entire `error` object when an Axios request fails (e.g., `console.error('Error', error)`) can leak sensitive request headers, including `Authorization` and API keys.
**Learning:** Axios error objects include the original `request` and `config` objects, which contain all headers sent with the request.
**Prevention:** Only log specific, safe properties from HTTP errors, such as `error.message`, `error.response?.status`, and sanitized `error.response?.data`. Never log the full error or `error.config`.
