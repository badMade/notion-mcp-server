import { OpenAPIToMCPConverter } from './src/openapi-mcp-server/openapi/parser.js'

// Mock a large OpenAPI Spec
const spec = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {},
  components: {
    schemas: {}
  }
}

// Add 500 paths
for (let i = 0; i < 500; i++) {
  spec.paths[`/path${i}`] = {
    get: {
      operationId: `getOp${i}`,
      description: 'Test operation',
      parameters: [
        {
          name: 'param1',
          in: 'query',
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Schema0' }
            }
          }
        }
      }
    }
  }
}

// Add 500 components
for (let i = 0; i < 500; i++) {
  spec.components.schemas[`Schema${i}`] = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      nested: { type: 'object', properties: { val: { type: 'integer' } } }
    }
  }
}

console.time('convertToMCPTools')
const converter = new OpenAPIToMCPConverter(spec as any)
converter.convertToMCPTools()
console.timeEnd('convertToMCPTools')
