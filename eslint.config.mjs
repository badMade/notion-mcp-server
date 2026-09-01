export default [
  {
    ignores: ['dist/', 'build/', 'node_modules/']
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        AbortController: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        fetch: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        ReadableStream: 'readonly',
        TextEncoder: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        Headers: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        document: 'readonly',
        window: 'readonly',
        location: 'readonly',
        self: 'readonly',
        performance: 'readonly',
        crypto: 'readonly',
        MessageChannel: 'readonly',
        MessagePort: 'readonly',
        Worker: 'readonly',
        SharedWorker: 'readonly',
        postMessage: 'readonly',
        close: 'readonly',
        importScripts: 'readonly',
        indexedDB: 'readonly',
        caches: 'readonly',
        BroadcastChannel: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        queueMicrotask: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'prefer-const': 'warn'
    }
  }
];
