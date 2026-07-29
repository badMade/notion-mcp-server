import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadOpenApiSpec } from '../init-server'

vi.mock('node:fs')

describe('init-server', () => {
  describe('loadOpenApiSpec', () => {
    let processExitSpy: MockInstance
    let consoleErrorSpy: MockInstance

    beforeEach(() => {
      // Prevent the test process from exiting
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit(${code})`)
      }) as any
      // Silence console error
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as any
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should exit and log an error if fs.readFileSync throws', async () => {
      const errorMessage = 'File not found'
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error(errorMessage)
      })

      // The function should reject/throw the error thrown by process.exit
      await expect(loadOpenApiSpec('dummy-path', undefined)).rejects.toThrow('process.exit(1)')

      expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(process.cwd(), 'dummy-path'), 'utf-8')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to read OpenAPI specification file:', errorMessage)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
