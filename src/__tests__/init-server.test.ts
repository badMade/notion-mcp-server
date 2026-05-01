import fs from 'node:fs'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { initProxy, ValidationError } from '../init-server'

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}))

describe('init-server', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Throw an error to halt execution after process.exit is called
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`)
    })
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initProxy', () => {
    it('should successfully parse a valid OpenAPI spec in JSON format', async () => {
      const validSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'http://localhost' }],
        paths: {}
      }
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validSpec))

      const proxy = await initProxy('test.json', undefined)
      expect(proxy).toBeDefined()
      expect(fs.readFileSync).toHaveBeenCalled()
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('should successfully parse a valid OpenAPI spec in YAML format', async () => {
      const validSpec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
servers:
  - url: http://localhost
paths: {}
`
      vi.mocked(fs.readFileSync).mockReturnValue(validSpec)

      const proxy = await initProxy('test.yaml', undefined)
      expect(proxy).toBeDefined()
      expect(fs.readFileSync).toHaveBeenCalled()
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('should override baseUrl if provided', async () => {
      const validSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'http://localhost' }],
        paths: {}
      }
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validSpec))

      const proxy = await initProxy('test.json', 'https://api.example.com')
      expect(proxy).toBeDefined()
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('should fail when file cannot be read', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found')
      })

      await expect(initProxy('missing.json', undefined)).rejects.toThrow('process.exit called with 1')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to read OpenAPI specification file:',
        'File not found'
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail when spec has malformed JSON', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid content that is neither json nor yaml {')

      await expect(initProxy('malformed.json', undefined)).rejects.toThrow('process.exit called with 1')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse OpenAPI spec:',
        expect.stringContaining('Unexpected token')
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail when spec has malformed YAML', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: content: :')

      await expect(initProxy('malformed.yaml', undefined)).rejects.toThrow('process.exit called with 1')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse OpenAPI spec:',
        expect.any(String) // Error message from js-yaml
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should propagate ValidationError if thrown during parsing', async () => {
      // Mock JSON.parse to throw ValidationError
      const originalParse = JSON.parse
      const validationError = new ValidationError([{ message: 'test error' }])

      // Setup the mock to throw ValidationError specifically for this test
      vi.spyOn(JSON, 'parse').mockImplementation(() => {
        throw validationError
      })

      vi.mocked(fs.readFileSync).mockReturnValue('{}')

      await expect(initProxy('test.json', undefined)).rejects.toThrow(ValidationError)

      // Restore original
      vi.restoreAllMocks()
    })
  })
})
