import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../app'
import { UnauthorizedError } from '../types/errors'
import { tenants } from '../db/schema'

export interface SessionUser {
  id: string
  email: string
  name: string
}

let _devTenantId: string | null = null

export function authMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const env = c.env.ENVIRONMENT || 'development'
    if (env === 'development' || env === 'testing') {
      const devUser: SessionUser = { id: 'dev_user', email: 'dev@indices.app', name: 'Dev User' }
      c.set('userId', devUser.id)
      c.set('user', devUser)

      if (!_devTenantId) {
        try {
          const db = c.var.db
          const [tenant] = await db.select().from(tenants).limit(1)
          _devTenantId = tenant?.id ?? 'test-tenant-id'
        } catch {
          _devTenantId = 'test-tenant-id'
        }
      }
      c.set('tenantId', _devTenantId)

      return next()
    }

    const sessionToken = c.req.header('cookie')
      ?.split(';')
      .find((cookie) => cookie.trim().startsWith('better-auth.session_token='))
      ?.split('=')[1]

    const authHeader = c.req.header('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!sessionToken && !bearerToken) {
      throw new UnauthorizedError('No session token or bearer token provided')
    }

    try {
      const authUrl = c.env.BETTER_AUTH_URL || 'http://localhost:3001'
      const response = await fetch(`${authUrl}/api/auth/get-session`, {
        headers: {
          cookie: sessionToken ? `better-auth.session_token=${sessionToken}` : '',
          authorization: bearerToken ? `Bearer ${bearerToken}` : '',
        },
      })

      if (!response.ok) {
        throw new UnauthorizedError('Invalid session')
      }

      const session = (await response.json()) as { user: SessionUser }
      c.set('userId', session.user.id)
      c.set('user', session.user)
      return next()
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err
      throw new UnauthorizedError('Session validation failed')
    }
  }
}
