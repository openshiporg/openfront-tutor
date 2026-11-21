import type { Session } from '../access'

type Args = { session?: Session }

/** Every business record belongs to one tutor's profile; a tutor only sees their own. */
export function ownProfileFilter({ session }: Args) {
  if (!session) return false
  return { profile: { owner: { id: { equals: session.itemId } } } }
}

export function ownerFilter({ session }: Args) {
  if (!session) return false
  return { owner: { id: { equals: session.itemId } } }
}

type HookArgs = {
  operation: 'create' | 'update' | 'delete'
  resolvedData: Record<string, unknown>
  context: { session?: Session; sudo(): { query: { TutorProfile: { findMany(a: Record<string, unknown>): Promise<Array<{ id: string }>> } } } }
}

/**
 * On create the record is attached to the signed-in tutor's own profile. A
 * client-supplied profile is ignored, so records can never land in someone
 * else's business. (Barber `attachOwnProfile`, profile renamed.)
 */
export async function attachOwnProfile({ operation, resolvedData, context }: HookArgs) {
  if (operation !== 'create') return resolvedData
  const userId = context.session?.itemId
  if (!userId) throw new Error('Sign in first.')
  const [profile] = await context.sudo().query.TutorProfile.findMany({ where: { owner: { id: { equals: userId } } }, take: 1, query: 'id' })
  if (!profile) throw new Error('Set up your business first.')
  return { ...resolvedData, profile: { connect: { id: profile.id } } }
}
