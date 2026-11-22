import { relationship } from '@keystone-6/core/fields'

import { permissions } from '../access'
import type { Session } from '../access'
import { attachOwnProfile, ownProfileFilter } from '../utils/ownership'

type Perm = (args: { session?: Session }) => boolean

const no = () => false

/**
 * Written only by the named commands; shown read-only in the dashboard.
 * A getter, because Keystone writes into field config objects (a shared
 * object would make every field using it non-nullable).
 */
export const fieldKit = {
  get commandOnly() {
    return {
      access: { create: no, update: no },
      ui: { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const } },
    }
  },
  /** Never readable or writable through the generic API. */
  get secret() {
    return {
      access: { read: no, create: no, update: no },
      ui: { itemView: { fieldMode: 'hidden' as const }, createView: { fieldMode: 'hidden' as const }, listView: { fieldMode: 'hidden' as const } },
    }
  },
}

/** The owning tutor profile: required, attached from the session, never from input. */
export function profileField(backRef: string) {
  return relationship({
    ref: `TutorProfile.${backRef}`,
    db: { foreignKey: true, extendPrismaSchema: (schema: string) => schema.replaceAll('?', '') },
    access: { create: no, update: no },
    ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
  })
}

/** The back side of a profile relationship on TutorProfile. */
export const ownedMany = (ref: string) => relationship({ ref, many: true, access: { create: no, update: no }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' } } })

/** Full CRUD for the tutor with `perm`, scoped to their own profile. A Family user has no flags, so it gets nothing. */
export function ownCrud(perm: Perm, opts: { delete?: boolean } = {}) {
  return {
    operation: { query: perm, create: perm, update: perm, delete: opts.delete === false ? no : perm },
    filter: { query: ownProfileFilter, update: ownProfileFilter, delete: ownProfileFilter },
  }
}

/** Read-only for the tutor; every write goes through a command. */
export function ownReadOnly(perm: Perm = permissions.canReadPayments) {
  return {
    operation: { query: perm, create: no, update: no, delete: no },
    filter: { query: ownProfileFilter },
  }
}

export const attachProfileHook = { resolveInput: attachOwnProfile as never }

type RelationCheck = { field: string; list: string }

/**
 * Confused-deputy guard: a tutor may only connect records of their own
 * business. Checks every `connect` in the listed relationship fields.
 */
export function sameProfileHooks(checks: RelationCheck[]) {
  return {
    resolveInput: attachOwnProfile as never,
    validateInput: async ({ resolvedData, context, addValidationError }: { resolvedData: Record<string, unknown>; context: { session?: Session; sudo(): { db: Record<string, { count(a: unknown): Promise<number> }> } }; addValidationError(msg: string): void }) => {
      const userId = context.session?.itemId
      if (!userId) return
      for (const { field, list } of checks) {
        const value = resolvedData[field] as { connect?: { id?: string } | Array<{ id?: string }>; set?: Array<{ id?: string }> } | undefined
        if (!value) continue
        const raw = [value.connect, value.set].flat().filter(Boolean) as Array<{ id?: string }>
        const ids = raw.map((v) => v.id).filter((v): v is string => typeof v === 'string')
        if (!ids.length) continue
        const count = await context.sudo().db[list].count({ where: { id: { in: ids }, profile: { owner: { id: { equals: userId } } } } })
        if (count !== new Set(ids).size) addValidationError(`${field}: choose from your own records.`)
      }
    },
  }
}
