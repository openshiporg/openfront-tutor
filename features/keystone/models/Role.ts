import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'

export const Role = list({
  access: {
    operation: {
      ...allOperations(permissions.canManageRoles),
      query: isSignedIn,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    listView: { initialColumns: ['name', 'assignedTo'] },
    itemView: { defaultFieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read') },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    canSeeOtherPeople: checkbox({ defaultValue: false }),
    canEditOtherPeople: checkbox({ defaultValue: false }),
    canManagePeople: checkbox({ defaultValue: false }),
    canManageRoles: checkbox({ defaultValue: false }),
    canAccessDashboard: checkbox({ defaultValue: false }),
    canManageBusiness: checkbox({ defaultValue: false, ui: { description: 'Business details, session types, packages, hours, time off.' } }),
    canManageFamilies: checkbox({ defaultValue: false, ui: { description: 'Families, students, inquiries, reviews, package balances.' } }),
    canManageSessions: checkbox({ defaultValue: false, ui: { description: 'Sessions, notes, homework, marks, resources, series.' } }),
    canManagePayments: checkbox({ defaultValue: false }),
    canViewEarnings: checkbox({ defaultValue: false }),
    assignedTo: relationship({ ref: 'User.role', many: true, ui: { itemView: { fieldMode: 'read' } } }),
  },
})
