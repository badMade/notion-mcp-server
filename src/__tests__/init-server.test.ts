import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import { initProxy, ValidationError } from '../init-server'
import { MCPProxy } from '../openapi-mcp-server/mcp/proxy'

vi.mock('node:fs')
vi.mock('../openapi-mcp-server/mcp/proxy')

describe('initProxy', () => {
  let processExitMock: any
  let consoleErrorMock: any

  beforeEach(() => {
    processExitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('successfully loads and parses the OpenAPI spec without baseUrl', async () => {
    const mockSpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      servers: [{ url: 'https://example.com' }]
    }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSpec))

    const proxy = await initProxy('test-spec.json', undefined)

    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('test-spec.json'), 'utf-8')
    expect(MCPProxy).toHaveBeenCalledWith('Notion API', mockSpec)
    expect(proxy).toBeInstanceOf(MCPProxy) // Since it's mocked, it will be the mock instance
  })

  it('successfully loads and parses the OpenAPI spec with baseUrl', async () => {
    const mockSpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      servers: [{ url: 'https://example.com' }]
    }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSpec))

    const proxy = await initProxy('test-spec.json', 'https://new-api.example.com')

    const expectedSpec = {
      ...mockSpec,
      servers: [{ url: 'https://new-api.example.com' }]
    }

    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('test-spec.json'), 'utf-8')
    expect(MCPProxy).toHaveBeenCalledWith('Notion API', expectedSpec)
    expect(proxy).toBeInstanceOf(MCPProxy)
  })

  it('exits with code 1 and logs error when reading the spec file fails', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    // It will call process.exit(1) and continue to JSON.parse, which will try to parse undefined.
    // So JSON.parse will fail, and it will call process.exit(1) again.
    // To prevent it throwing unhandled exceptions if process.exit doesn't exit,
    // we can just check if processExitMock was called.

    // Actually, in the real code loadOpenApiSpec does not return if process.exit doesn't stop execution.
    // Let's make process.exit throw an error so it stops execution like it does in reality.
    processExitMock.mockImplementation(() => {
      throw new Error('process.exit called')
    })

    await expect(initProxy('missing-spec.json', undefined)).rejects.toThrow('process.exit called')

    expect(consoleErrorMock).toHaveBeenCalledWith('Failed to read OpenAPI specification file:', 'File not found')
    expect(processExitMock).toHaveBeenCalledWith(1)
  })

  it('exits with code 1 and logs error when parsing the spec fails', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('invalid json')

    processExitMock.mockImplementation(() => {
      throw new Error('process.exit called')
    })

    await expect(initProxy('invalid-spec.json', undefined)).rejects.toThrow('process.exit called')

    expect(consoleErrorMock).toHaveBeenCalledWith('Failed to parse OpenAPI spec:', expect.any(String))
    expect(processExitMock).toHaveBeenCalledWith(1)
  })

  it('throws ValidationError if parsing throws a ValidationError', async () => {
    // This is to hit the specific catch condition where `error instanceof ValidationError`
    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw new ValidationError([{ message: 'Invalid' }])
    })

    vi.mocked(fs.readFileSync).mockReturnValue('{}')

    await expect(initProxy('spec.json', undefined)).rejects.toThrow(ValidationError)
  })
})
