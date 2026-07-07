import { describe, it, expect } from 'vitest'
import { renderAuthTemplate } from '../template'
import { AuthTemplate, TemplateContext } from '../types'

describe('renderAuthTemplate', () => {
  it('should render a simple URL with context arguments', () => {
    const template: AuthTemplate = {
      url: 'https://api.example.com/oauth/token?grant_type={{args.grant_type}}',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
    const context: TemplateContext = {
      args: { grant_type: 'client_credentials' }
    }

    const result = renderAuthTemplate(template, context)

    expect(result.url).toBe('https://api.example.com/oauth/token?grant_type=client_credentials')
    expect(result.method).toBe('POST')
    expect(result.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(result.body).toBeUndefined()
  })

  it('should not mutate the original template or headers', () => {
    const template: AuthTemplate = {
      url: 'https://api.example.com/{{args.path}}',
      method: 'GET',
      headers: { 'Authorization': 'Bearer {{args.token}}' }
    }
    const context: TemplateContext = {
      args: { path: 'users', token: 'secret123' }
    }

    const result = renderAuthTemplate(template, context)

    expect(result).not.toBe(template) // Should be a new object
    expect(result.headers).not.toBe(template.headers) // Should be a new headers object

    // Ensure original template wasn't mutated
    expect(template.url).toBe('https://api.example.com/{{args.path}}')
    expect(template.headers).toEqual({ 'Authorization': 'Bearer {{args.token}}' })
  })

  it('should render body if it exists', () => {
    const template: AuthTemplate = {
      url: 'https://api.example.com/oauth/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"client_id": "{{args.client_id}}", "client_secret": "{{args.client_secret}}"}'
    }
    const context: TemplateContext = {
      args: { client_id: 'my-client', client_secret: 'my-secret' }
    }

    const result = renderAuthTemplate(template, context)

    expect(result.body).toBe('{"client_id": "my-client", "client_secret": "my-secret"}')
  })

  it('should not escape HTML characters in URLs', () => {
    const template: AuthTemplate = {
      url: 'https://api.example.com/authorize?redirect_uri={{args.redirect_uri}}&scope={{args.scope}}',
      method: 'GET',
      headers: {}
    }
    const context: TemplateContext = {
      args: {
        redirect_uri: 'https://app.example.com/callback?foo=bar',
        scope: 'read:users write:users'
      }
    }

    const result = renderAuthTemplate(template, context)

    // Mustache normally escapes =, &, ?, and spaces.
    // The implementation specifically disables this for URLs.
    expect(result.url).toBe('https://api.example.com/authorize?redirect_uri=https://app.example.com/callback?foo=bar&scope=read:users write:users')
  })

  it('should correctly render nested context variables like securityScheme', () => {
    const template: AuthTemplate = {
      url: '{{securityScheme.oauth2.tokenUrl}}?grant_type={{args.grant_type}}',
      method: 'POST',
      headers: {}
    }
    const context: TemplateContext = {
      securityScheme: {
        oauth2: {
          tokenUrl: 'https://auth.example.com/token'
        }
      },
      args: { grant_type: 'authorization_code' }
    }

    const result = renderAuthTemplate(template, context)

    expect(result.url).toBe('https://auth.example.com/token?grant_type=authorization_code')
  })
})
