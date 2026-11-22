'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

/** Every §5.7 operation answers `CommandResult { success, error, data }`. */
export type Command<T = unknown> = { success: boolean; error: string | null; data: T | null }

const CONNECTION = 'We could not reach the server. Check your connection and try again.'

/**
 * Runs one GraphQL command and returns its CommandResult. `error` is the
 * server's own sentence (shown to the person as it is); a transport failure
 * becomes one plain sentence.
 */
export async function command<T = unknown>(query: string, variables: Record<string, unknown>, field: string): Promise<Command<T>> {
  const response = await keystoneClient<Record<string, Command<T>>>(query, variables, { cache: 'no-store' })
  if (!response.success) return { success: false, error: response.error || CONNECTION, data: null }
  const result = response.data?.[field]
  if (!result) return { success: false, error: 'The server did not answer. Try again.', data: null }
  return { success: Boolean(result.success), error: result.error ?? (result.success ? null : 'This could not be completed. Try again.'), data: (result.data ?? null) as T | null }
}

/** A query that returns raw JSON (publicTutor, homeTutor). */
export async function jsonQuery<T>(query: string, variables: Record<string, unknown>, field: string): Promise<{ ok: true; data: T | null } | { ok: false; error: string }> {
  const response = await keystoneClient<Record<string, T | null>>(query, variables, { cache: 'no-store' })
  if (!response.success) return { ok: false, error: response.error || CONNECTION }
  return { ok: true, data: (response.data?.[field] ?? null) as T | null }
}
