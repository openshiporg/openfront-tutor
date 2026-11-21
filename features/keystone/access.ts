export type RoleFlags = {
  id: string
  name: string
  canSeeOtherPeople: boolean
  canEditOtherPeople: boolean
  canManagePeople: boolean
  canManageRoles: boolean
  canAccessDashboard: boolean
  canManageBusiness: boolean
  canManageFamilies: boolean
  canManageSessions: boolean
  canManagePayments: boolean
  canViewEarnings: boolean
}

export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    email?: string | null
    onboardingStatus?: string | null
    role: RoleFlags | null
  }
}

type AccessArgs = {
  session?: Session
}

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session)
}

const flag = (key: keyof RoleFlags) => ({ session }: AccessArgs) =>
  Boolean(session?.data.role?.[key])

/**
 * Role flags. The `Family` role has every flag off, so a guardian gets nothing
 * from generic list queries or mutations; guardians act only through the
 * custom family operations, which resolve the family from the session.
 */
export const permissions = {
  canManagePeople: flag('canManagePeople'),
  canManageRoles: flag('canManageRoles'),
  canAccessDashboard: flag('canAccessDashboard'),
  canManageBusiness: flag('canManageBusiness'),
  canManageFamilies: flag('canManageFamilies'),
  canManageSessions: flag('canManageSessions'),
  canManagePayments: flag('canManagePayments'),
  canViewEarnings: flag('canViewEarnings'),
  canReadPayments: ({ session }: AccessArgs) =>
    Boolean(session?.data.role?.canManagePayments || session?.data.role?.canViewEarnings),
}

export const rules = {
  canReadPeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (session.data.role?.canSeeOtherPeople) return true
    return { id: { equals: session.itemId } }
  },
  canUpdatePeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (session.data.role?.canEditOtherPeople) return true
    return { id: { equals: session.itemId } }
  },
}

/** All permissions of the one tutor who owns the business. */
export const TUTOR_ROLE = {
  name: 'Tutor',
  canSeeOtherPeople: true,
  canEditOtherPeople: true,
  canManagePeople: true,
  canManageRoles: true,
  canAccessDashboard: true,
  canManageBusiness: true,
  canManageFamilies: true,
  canManageSessions: true,
  canManagePayments: true,
  canViewEarnings: true,
} as const

/** A guardian (parent or adult student). No dashboard, no generic CRUD. */
export const FAMILY_ROLE = {
  name: 'Family',
  canSeeOtherPeople: false,
  canEditOtherPeople: false,
  canManagePeople: false,
  canManageRoles: false,
  canAccessDashboard: false,
  canManageBusiness: false,
  canManageFamilies: false,
  canManageSessions: false,
  canManagePayments: false,
  canViewEarnings: false,
} as const

export const ROLE_SESSION_FIELDS = `
      id
      name
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageBusiness
      canManageFamilies
      canManageSessions
      canManagePayments
      canViewEarnings`
