import type { IncomingMessage, ServerResponse } from 'http'

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  headers?: Record<string, string>
  body?: any
  cookies?: Record<string, string>
}

export async function makeRequest(options: RequestOptions): Promise<{ status: number; body: any; headers: any }> {
  const req = {
    method: options.method,
    url: options.path,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    } as Record<string, string>,
  } as IncomingMessage

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()]
    },
    write() {},
    end() {},
  } as unknown as ServerResponse

  if (options.cookies) {
    const cookieStr = Object.entries(options.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    req.headers.cookie = cookieStr
  }

  // Inject globals
  ;(globalThis as any).defineEventHandler = (h: any) => h
  ;(globalThis as any).createError = (e: any) => {
    const err: any = new Error(e?.statusMessage || e?.message || 'Error')
    err.statusCode = e?.statusCode || 500
    throw err
  }
  ;(globalThis as any).getRouterParam = () => undefined

  let handler
  try {
    if (options.path === '/api/me' && options.method === 'GET') {
      handler = await import('../../server/api/me.get')
    } else if (options.path === '/api/csrf' && options.method === 'GET') {
      handler = await import('../../server/api/csrf.get')
    } else if (options.path === '/api/auth/login' && options.method === 'POST') {
      handler = await import('../../server/api/auth/login.post')
    } else if (options.path === '/api/auth/logout' && options.method === 'POST') {
      handler = await import('../../server/api/auth/logout.post')
    } else if (options.path === '/api/customers' && options.method === 'GET') {
      handler = await import('../../server/api/customers.get')
    } else if (options.path === '/api/customers' && options.method === 'POST') {
      handler = await import('../../server/api/customers.post')
    } else if (options.path === '/api/dashboard' && options.method === 'GET') {
      handler = await import('../../server/api/dashboard.get')
    } else if (options.path === '/api/products' && options.method === 'GET') {
      handler = await import('../../server/api/products.get')
    } else if (options.path === '/api/products' && options.method === 'POST') {
      handler = await import('../../server/api/products.post')
    } else if (options.path === '/api/sales' && options.method === 'GET') {
      handler = await import('../../server/api/sales.get')
    } else if (options.path === '/api/sales' && options.method === 'POST') {
      handler = await import('../../server/api/sales.post')
    } else if (options.path === '/api/policies' && options.method === 'GET') {
      handler = await import('../../server/api/policies.get')
    } else if (options.path === '/api/policies' && options.method === 'POST') {
      handler = await import('../../server/api/policies.post')
    } else if (options.path.startsWith('/api/reports/')) {
      handler = await import('../../server/api/reports/sales.get')
    }
  } catch (e: any) {
    if (e.statusCode) {
      return { status: e.statusCode, body: e, headers: {} }
    }
    throw e
  }

  if (!handler?.default) {
    throw new Error(`No handler for ${options.method} ${options.path}`)
  }

  try {
    const event: any = { node: { req, res }, req, res }
    event.context = event.context || {}
    // For h3 readBody to see body
    const h3 = await import('h3')
    ;(h3 as any).readBody = async () => options.body
    const result = await handler.default(event)
    return { status: res.statusCode, body: result, headers: res.headers }
  } catch (error: any) {
    if (error.statusCode) {
      return { status: error.statusCode, body: error, headers: res.headers }
    }
    throw error
  }
}
