## 2026-07-07 - Insecure Randomness for Authentication Token
**Vulnerability:** The server generated a random 32-byte fallback authentication token and logged it to the console when started with HTTP transport without an explicit token.
**Learning:** Generating default bearer tokens inline and logging them to standard output is a weak authentication pattern that creates a false sense of security and exposes credentials in server logs.
**Prevention:** Remove fallback logic entirely. Require an explicit token (via `--auth-token` CLI argument or `AUTH_TOKEN` environment variable) for the HTTP transport, and exit with an error if neither is provided.
