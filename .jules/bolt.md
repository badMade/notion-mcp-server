## 2024-05-23 - [File Read Opt]
**Learning:** Prefer `await fs.promises.readFile` over `fs.readFileSync` for reading files inside async functions, to avoid blocking the event loop and improve server performance.
**Action:** Replace `fs.readFileSync` with `await fs.promises.readFile` in `src/init-server.ts`.
