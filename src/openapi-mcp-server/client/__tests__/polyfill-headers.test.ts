import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PolyfillHeaders', () => {
  let PolyfillHeadersClass: any;

  beforeEach(async () => {
    // Reset modules to force a re-evaluation of the module we're importing
    vi.resetModules();
    // Temporarily remove global Headers if it exists, to ensure we get the polyfill
    const originalHeaders = global.Headers;
    if ('Headers' in global) {
      delete (global as any).Headers;
    }

    const module = await import('../polyfill-headers');
    PolyfillHeadersClass = module.Headers;

    // Restore global Headers
    if (originalHeaders !== undefined) {
      (global as any).Headers = originalHeaders;
    }
  });

  it('should use PolyfillHeaders when global.Headers is undefined', () => {
    expect(PolyfillHeadersClass.name).toBe('PolyfillHeaders');
  });

  describe('constructor', () => {
    it('should initialize empty when called without arguments', () => {
      const headers = new PolyfillHeadersClass();
      expect(headers.get('Content-Type')).toBeNull();
    });

    it('should initialize with a Record<string, string> object', () => {
      const headers = new PolyfillHeadersClass({
        'content-type': 'application/json',
        'Authorization': 'Bearer token'
      });
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('authorization')).toBe('Bearer token');
    });
  });

  describe('append', () => {
    it('should append a new key-value pair', () => {
      const headers = new PolyfillHeadersClass();
      headers.append('X-Custom-Header', 'value1');
      expect(headers.get('x-custom-header')).toBe('value1');
    });

    it('should append multiple values to the same key', () => {
      const headers = new PolyfillHeadersClass();
      headers.append('Accept', 'text/html');
      headers.append('Accept', 'application/xhtml+xml');
      expect(headers.get('accept')).toBe('text/html, application/xhtml+xml');
    });

    it('should handle case-insensitivity when appending to existing keys', () => {
      const headers = new PolyfillHeadersClass();
      headers.append('Content-Type', 'application/json');
      headers.append('content-type', 'text/plain');
      headers.append('CONTENT-TYPE', 'text/html');
      expect(headers.get('content-type')).toBe('application/json, text/plain, text/html');
    });
  });

  describe('get', () => {
    it('should return null for a missing key', () => {
      const headers = new PolyfillHeadersClass();
      expect(headers.get('Non-Existent')).toBeNull();
    });

    it('should retrieve a value using exact case', () => {
      const headers = new PolyfillHeadersClass({'Content-Type': 'application/json'});
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should retrieve a value using mixed case', () => {
      const headers = new PolyfillHeadersClass({'Content-Type': 'application/json'});
      expect(headers.get('cOnTeNt-tYpE')).toBe('application/json');
    });

    it('should return multiple comma-separated values for a key with multiple entries', () => {
      const headers = new PolyfillHeadersClass();
      headers.append('Accept', 'text/html');
      headers.append('Accept', 'application/xhtml+xml');
      expect(headers.get('Accept')).toBe('text/html, application/xhtml+xml');
    });
  });
});
