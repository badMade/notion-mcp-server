## 2025-05-15 - [HIGH] Fix Auth Token logging to console
**Vulnerability:** The server was auto-generating a random 32-byte hex authentication token for the Streamable HTTP transport and logging it in plain text to the console (stdout).
**Learning:** Auto-generating and logging secrets to standard output is a security risk as logs are often stored, aggregated, or viewed by unauthorized personnel, leading to credential leakage (CWE-532).
**Prevention:** Avoid auto-generating secrets that must be logged. Instead, make credentials a mandatory requirement provided by the user via secure channels (environment variables or CLI flags).
