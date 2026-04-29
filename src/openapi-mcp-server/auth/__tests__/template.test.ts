import { describe, it, expect } from 'vitest'
import { renderAuthTemplate } from '../template'
import { AuthTemplate, TemplateContext } from '../types'

describe('renderAuthTemplate', () => {
  const baseTemplate: AuthTemplate = {
    url: 'https://api.example.com/oauth/token?client_id={{args.clientId}}',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=authorization_code&code={{args.code}}&redirect_uri={{args.redirectUri}}',
  }

  const baseContext: TemplateContext = {
    args: {
      clientId: 'test-client-id',
      code: 'test-code',
      redirectUri: 'https://callback.example.com?param=value',
    },
  }

  it('should render URL with template variables', () => {
    const result = renderAuthTemplate(baseTemplate, baseContext)
    expect(result.url).toBe('https://api.example.com/oauth/token?client_id=test-client-id')
  })

  it('should render body with template variables', () => {
    const result = renderAuthTemplate(baseTemplate, baseContext)
    expect(result.body).toBe('grant_type=authorization_code&code=test-code&redirect_uri=https://callback.example.com?param=value')
  })

  it('should disable HTML escaping for URLs and body', () => {
    const templateWithSpecialChars: AuthTemplate = {
      ...baseTemplate,
      url: 'https://api.example.com/auth?query={{args.query}}',
      body: 'data={{args.data}}',
    }
    const contextWithSpecialChars: TemplateContext = {
      args: {
        query: 'a&b',
        data: '<tag>',
      },
    }
    const result = renderAuthTemplate(templateWithSpecialChars, contextWithSpecialChars)

    // If escaping was enabled, & would become &amp; and < would become &lt;
    expect(result.url).toBe('https://api.example.com/auth?query=a&b')
    expect(result.body).toBe('data=<tag>')
  })

  it('should handle templates without body', () => {
    const templateWithoutBody: AuthTemplate = {
      url: 'https://api.example.com/user?id={{args.userId}}',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }
    const context: TemplateContext = {
      args: {
        userId: '123',
      },
    }
    const result = renderAuthTemplate(templateWithoutBody, context)
    expect(result.url).toBe('https://api.example.com/user?id=123')
    expect(result.body).toBeUndefined()
  })

  it('should return a new headers object to ensure immutability', () => {
    const result = renderAuthTemplate(baseTemplate, baseContext)
    expect(result.headers).toEqual(baseTemplate.headers)
    expect(result.headers).not.toBe(baseTemplate.headers)
  })

  it('should work when no variables are present in the template', () => {
    const staticTemplate: AuthTemplate = {
      url: 'https://api.example.com/static',
      method: 'GET',
      headers: {},
    }
    const result = renderAuthTemplate(staticTemplate, baseContext)
    expect(result.url).toBe('https://api.example.com/static')
  })
})
