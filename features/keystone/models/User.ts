import { list } from '@keystone-6/core'
import { allOperations, denyAll } from '@keystone-6/core/access'
import { password, relationship, select, text } from '@keystone-6/core/fields'

import { FAMILY_ROLE, isSignedIn, permissions, rules } from '../access'
import type { Session } from '../access'

/**
 * Accounts. The first user is created by `createInitialUser` with the Tutor
 * role. Every later sign-up gets the `Family` role (no dashboard, no generic
 * CRUD); `role` can never be chosen by the caller.
 */
export const User = list({
  access: {
    operation: {
      ...allOperations(isSignedIn),
      // Families get accounts through `claimFamilyAccount`; open sign-up is the starter's opt-in.
      create: (args) => process.env.PUBLIC_SIGNUPS_ALLOWED === 'true' || permissions.canManagePeople(args),
      delete: permissions.canManagePeople,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManagePeople(args),
    hideDelete: args => !permissions.canManagePeople(args),
    listView: { initialColumns: ['name', 'email', 'role'] },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople) return 'edit'
        if (session?.itemId === item?.id) return 'edit'
        return 'read'
      },
    },
  },
  hooks: {
    resolveInput: async ({ operation, resolvedData, context }) => {
      const session = context.session as Session | undefined
      if (operation !== 'create' || session?.data?.role?.canManagePeople) return resolvedData
      const sudo = context.sudo()
      // The very first account is the tutor (`createInitialUser` checks there is none yet).
      if ((await sudo.db.User.count({})) === 0) return resolvedData
      const found = (await sudo.db.Role.findMany({ where: { name: { equals: FAMILY_ROLE.name } }, take: 1 }))[0]
      const role = found ?? (await sudo.db.Role.createOne({ data: { ...FAMILY_ROLE } }))
      return { ...resolvedData, role: { connect: { id: role.id } } }
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({
      isFilterable: false,
      isOrderable: false,
      isIndexed: 'unique',
      validation: { isRequired: true },
    }),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) =>
          permissions.canManagePeople({ session }) || session?.itemId === item.id,
      },
      validation: { isRequired: true },
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      access: {
        create: permissions.canManagePeople,
        update: permissions.canManagePeople,
      },
      ui: { itemView: { fieldMode: args => (permissions.canManagePeople(args) ? 'edit' : 'read') } },
    }),
    tutorProfile: relationship({ ref: 'TutorProfile.owner', access: { create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    family: relationship({ ref: 'Family.user', access: { create: () => false, update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    onboardingStatus: select({
      type: 'enum',
      options: [
        { label: 'Not started', value: 'not_started' },
        { label: 'Done', value: 'done' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
      access: { update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id },
    }),
  },
})
