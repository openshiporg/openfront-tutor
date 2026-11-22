import type { IncomingMessage } from 'node:http'

import type { Session } from '../access'
import { keystoneContext } from '../context'

/** The Keystone session for a route handler request: only the cookie is forwarded (as `/api/completion`). */
export async function sessionFor(request: Request): Promise<Session | undefined> {
  const context = await keystoneContext.withRequest({ headers: { cookie: request.headers.get('cookie') || '' }, method: request.method, url: new URL(request.url).pathname } as IncomingMessage)
  return context.session as Session | undefined
}
