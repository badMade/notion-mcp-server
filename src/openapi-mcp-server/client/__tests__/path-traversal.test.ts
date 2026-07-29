import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../http-client'
import fs from 'fs'
import path from 'path'
import { OpenAPIV3 } from 'openapi-types'
import FormData from 'form-data'

vi.mock('fs')
vi.mock('form-data')

describe('HttpClient Path Traversal Validation', () => {
  let client: HttpClient

  const mockApiInstance = {
    uploadFile: vi.fn(),
  }

  const baseConfig = {
    baseUrl: 'http://test.com',
    headers: {},
  }

  const mockOpenApiSpec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/upload': {
        post: {
          operationId: 'uploadFile',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Success' }
          }
        },
      },
    },
  }

  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    client = new HttpClient(baseConfig, mockOpenApiSpec)
    // @ts-expect-error - Mock the private api property
    client['api'] = Promise.resolve(mockApiInstance)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should allow file upload when path is within allowed directories', async () => {
    process.env.MCP_ALLOWED_DIRECTORIES = '/tmp/allowed,/var/data'

    const mockFormData = new FormData()
    const mockFileStream = { pipe: vi.fn() }
    const mockFormDataHeaders = { 'content-type': 'multipart/form-data; boundary=---123' }

    vi.mocked(fs.createReadStream).mockReturnValue(mockFileStream as any)
    vi.spyOn(FormData.prototype, 'append').mockImplementation(() => {})
    vi.spyOn(FormData.prototype, 'getHeaders').mockReturnValue(mockFormDataHeaders)
    mockApiInstance.uploadFile.mockResolvedValue({ data: {}, status: 200, headers: {} })

    const operation = mockOpenApiSpec.paths['/upload']!.post as OpenAPIV3.OperationObject & { method: string; path: string }
    const params = { file: '/tmp/allowed/test.txt' }

    await expect(client.executeOperation(operation, params)).resolves.toBeDefined()
    expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/allowed/test.txt')
  })

  it('should reject file upload when path is outside allowed directories', async () => {
    process.env.MCP_ALLOWED_DIRECTORIES = '/tmp/allowed'

    const operation = mockOpenApiSpec.paths['/upload']!.post as OpenAPIV3.OperationObject & { method: string; path: string }
    const params = { file: '/tmp/forbidden/secret.txt' }

    await expect(client.executeOperation(operation, params)).rejects.toThrow(
      'Access denied: File path /tmp/forbidden/secret.txt is not in allowed directories'
    )
  })

  it('should reject file upload with path traversal attacks', async () => {
    process.env.MCP_ALLOWED_DIRECTORIES = '/tmp/allowed'

    const operation = mockOpenApiSpec.paths['/upload']!.post as OpenAPIV3.OperationObject & { method: string; path: string }
    const params = { file: '/tmp/allowed/../forbidden/secret.txt' }

    await expect(client.executeOperation(operation, params)).rejects.toThrow(
      'Access denied: File path /tmp/allowed/../forbidden/secret.txt is not in allowed directories'
    )
  })

  it('should handle empty strings and trailing commas in MCP_ALLOWED_DIRECTORIES properly', async () => {
      // Test the trailing comma bug
      process.env.MCP_ALLOWED_DIRECTORIES = '/tmp/allowed,'

      const operation = mockOpenApiSpec.paths['/upload']!.post as OpenAPIV3.OperationObject & { method: string; path: string }

      // If trailing comma was bugged, it would resolve to CWD and allow files there.
      // E.g. allowing arbitrary files not in /tmp/allowed
      const params = { file: '/tmp/forbidden/secret.txt' }

      await expect(client.executeOperation(operation, params)).rejects.toThrow(
        'Access denied: File path /tmp/forbidden/secret.txt is not in allowed directories'
      )
  })
})
