"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core12 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields = require("@keystone-6/core/fields");

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session);
}
var flag = (key) => ({ session }) => Boolean(session?.data.role?.[key]);
var permissions = {
  canManagePeople: flag("canManagePeople"),
  canManageRoles: flag("canManageRoles"),
  canAccessDashboard: flag("canAccessDashboard"),
  canManageBusiness: flag("canManageBusiness"),
  canManageFamilies: flag("canManageFamilies"),
  canManageSessions: flag("canManageSessions"),
  canManagePayments: flag("canManagePayments"),
  canViewEarnings: flag("canViewEarnings"),
  canReadPayments: ({ session }) => Boolean(session?.data.role?.canManagePayments || session?.data.role?.canViewEarnings)
};
var rules = {
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canSeeOtherPeople) return true;
    return { id: { equals: session.itemId } };
  },
  canUpdatePeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canEditOtherPeople) return true;
    return { id: { equals: session.itemId } };
  }
};
var TUTOR_ROLE = {
  name: "Tutor",
  canSeeOtherPeople: true,
  canEditOtherPeople: true,
  canManagePeople: true,
  canManageRoles: true,
  canAccessDashboard: true,
  canManageBusiness: true,
  canManageFamilies: true,
  canManageSessions: true,
  canManagePayments: true,
  canViewEarnings: true
};
var FAMILY_ROLE = {
  name: "Family",
  canSeeOtherPeople: false,
  canEditOtherPeople: false,
  canManagePeople: false,
  canManageRoles: false,
  canAccessDashboard: false,
  canManageBusiness: false,
  canManageFamilies: false,
  canManageSessions: false,
  canManagePayments: false,
  canViewEarnings: false
};
var ROLE_SESSION_FIELDS = `
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
      canViewEarnings`;

// features/keystone/models/User.ts
var User = (0, import_core.list)({
  access: {
    operation: {
      ...(0, import_access.allOperations)(isSignedIn),
      create: () => true,
      delete: permissions.canManagePeople
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePeople(args),
    hideDelete: (args) => !permissions.canManagePeople(args),
    listView: { initialColumns: ["name", "email", "role"] },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople) return "edit";
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  hooks: {
    resolveInput: async ({ operation, resolvedData, context }) => {
      const session = context.session;
      if (operation !== "create" || session?.data?.role?.canManagePeople) return resolvedData;
      const sudo = context.sudo();
      const found = (await sudo.db.Role.findMany({ where: { name: { equals: FAMILY_ROLE.name } }, take: 1 }))[0];
      const role = found ?? await sudo.db.Role.createOne({ data: { ...FAMILY_ROLE } });
      return { ...resolvedData, role: { connect: { id: role.id } } };
    }
  },
  fields: {
    name: (0, import_fields.text)({ validation: { isRequired: true } }),
    email: (0, import_fields.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: { isRequired: true }
    }),
    password: (0, import_fields.password)({
      access: {
        read: import_access.denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: permissions.canManagePeople,
        update: permissions.canManagePeople
      },
      ui: { itemView: { fieldMode: (args) => permissions.canManagePeople(args) ? "edit" : "read" } }
    }),
    tutorProfile: (0, import_fields.relationship)({ ref: "TutorProfile.owner", access: { create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    family: (0, import_fields.relationship)({ ref: "Family.user", access: { create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    onboardingStatus: (0, import_fields.select)({
      type: "enum",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "Done", value: "done" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      access: { update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id }
    })
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");
var Role = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access3.allOperations)(permissions.canManageRoles),
      query: isSignedIn
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: { initialColumns: ["name", "assignedTo"] },
    itemView: { defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read" }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    canSeeOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields2.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManageBusiness: (0, import_fields2.checkbox)({ defaultValue: false, ui: { description: "Business details, session types, packages, hours, time off." } }),
    canManageFamilies: (0, import_fields2.checkbox)({ defaultValue: false, ui: { description: "Families, students, inquiries, reviews, package balances." } }),
    canManageSessions: (0, import_fields2.checkbox)({ defaultValue: false, ui: { description: "Sessions, notes, homework, marks, resources, series." } }),
    canManagePayments: (0, import_fields2.checkbox)({ defaultValue: false }),
    canViewEarnings: (0, import_fields2.checkbox)({ defaultValue: false }),
    assignedTo: (0, import_fields2.relationship)({ ref: "User.role", many: true, ui: { itemView: { fieldMode: "read" } } })
  }
});

// features/keystone/models/OAuthApp.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");

// features/keystone/models/trackingFields.ts
var import_fields3 = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields3.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields3.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/mcp-oauth/core.ts
var import_node_crypto = __toESM(require("node:crypto"));
var MCP_SCOPES = ["mcp:read", "mcp:write"];
var MCP_ACCESS_PREFIX = "mcp_at_";
var ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
var REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1e3;
var CONSENT_TICKET_TTL_MS = 10 * 60 * 1e3;
var DEVELOPMENT_SECRET = "this secret should only be used in testing";
function secret() {
  return process.env.SESSION_SECRET || DEVELOPMENT_SECRET;
}
function randomToken(prefix, bytes = 32) {
  return `${prefix}${import_node_crypto.default.randomBytes(bytes).toString("base64url")}`;
}
function digestToken(token, purpose = "mcp-oauth-token") {
  return import_node_crypto.default.createHmac("sha256", secret()).update(`${purpose}\0${token}`, "utf8").digest("hex");
}
function bearerToken(header) {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return match ? match[1] : null;
}
function isMcpAccessToken(token) {
  return typeof token === "string" && token.startsWith(MCP_ACCESS_PREFIX) && token.length > MCP_ACCESS_PREFIX.length;
}
function storedScopes(value) {
  return Array.isArray(value) ? MCP_SCOPES.filter((scope) => value.includes(scope)) : [];
}

// features/keystone/models/OAuthApp.ts
var OAuthApp = (0, import_core3.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    name: (0, import_fields4.text)({
      validation: {
        isRequired: true
      }
    }),
    clientId: (0, import_fields4.text)({
      isIndexed: "unique",
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation === "create" && !resolvedData.clientId) {
            return randomToken("mcp_cl_", 18);
          }
          return resolvedData.clientId;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Auto-generated unique identifier for your application."
      }
    }),
    clientSecret: (0, import_fields4.text)({
      access: {
        read: () => false
      },
      hooks: {
        resolveInput: ({ resolvedData }) => {
          if (resolvedData.clientSecret) {
            return digestToken(resolvedData.clientSecret, "oauth-client-secret");
          }
          return void 0;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        description: "Stored only as a digest. Public MCP clients have no secret."
      }
    }),
    tokenEndpointAuthMethod: (0, import_fields4.select)({
      options: [
        { label: "Client secret (POST)", value: "client_secret_post" },
        { label: "Client secret (Basic)", value: "client_secret_basic" },
        { label: "None (public PKCE client)", value: "none" }
      ],
      defaultValue: "client_secret_post",
      ui: {
        description: "How the app authenticates at the token endpoint. MCP clients are public (none)."
      }
    }),
    redirectUris: (0, import_fields4.json)({
      defaultValue: [],
      ui: {
        description: "Array of allowed redirect URIs for OAuth callbacks"
      }
    }),
    scopes: (0, import_fields4.json)({
      defaultValue: [...MCP_SCOPES],
      ui: {
        description: "Array of allowed OAuth scopes. MCP scopes only narrow the signed-in user's own access."
      }
    }),
    webhookUrl: (0, import_fields4.text)({
      ui: {
        description: "URL to receive webhook notifications"
      }
    }),
    status: (0, import_fields4.select)({
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Pending", value: "pending" }
      ],
      defaultValue: "active"
    }),
    installUrl: (0, import_fields4.text)({
      ui: {
        description: "URL where users can install this app"
      }
    }),
    uninstallUrl: (0, import_fields4.text)({
      ui: {
        description: "URL to handle app uninstallation"
      }
    }),
    description: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    metadata: (0, import_fields4.json)({
      defaultValue: {},
      ui: {
        description: "Additional app-specific configuration and settings"
      }
    }),
    developerEmail: (0, import_fields4.text)(),
    privacyPolicyUrl: (0, import_fields4.text)(),
    termsOfServiceUrl: (0, import_fields4.text)(),
    supportUrl: (0, import_fields4.text)(),
    ...trackingFields
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "clientId", "status", "createdAt"]
    }
  }
});

// features/keystone/models/OAuthToken.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var digestTokenInput = {
  resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] ? digestToken(resolvedData[fieldKey]) : resolvedData[fieldKey]
};
var OAuthToken = (0, import_core5.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    tokenType: (0, import_fields5.select)({
      options: [
        { label: "Authorization Code", value: "authorization_code" },
        { label: "Access Token", value: "access_token" },
        { label: "Refresh Token", value: "refresh_token" }
      ],
      validation: {
        isRequired: true
      }
    }),
    token: (0, import_fields5.text)({
      access: { read: () => false },
      validation: {
        isRequired: true
      },
      isIndexed: "unique",
      hooks: digestTokenInput
    }),
    clientId: (0, import_fields5.text)({
      validation: {
        isRequired: true
      },
      isIndexed: true
    }),
    user: (0, import_fields5.relationship)({
      ref: "User",
      ui: {
        description: "The user who authorized this token"
      }
    }),
    scopes: (0, import_fields5.json)({
      defaultValue: [],
      ui: {
        description: "Array of granted scopes"
      }
    }),
    redirectUri: (0, import_fields5.text)({
      ui: {
        description: "The redirect URI used during authorization"
      }
    }),
    resource: (0, import_fields5.text)({
      ui: {
        description: "The MCP endpoint (RFC 8707 resource) this grant is for"
      }
    }),
    expiresAt: (0, import_fields5.timestamp)({
      ui: {
        description: "When this token expires"
      }
    }),
    isRevoked: (0, import_fields5.select)({
      options: [
        { label: "Active", value: "false" },
        { label: "Revoked", value: "true" }
      ],
      defaultValue: "false"
    }),
    authorizationCode: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "The authorization code that was exchanged for this token (for access tokens)"
      }
    }),
    refreshToken: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated refresh token (for access tokens)"
      }
    }),
    accessToken: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated access token (for refresh tokens)"
      }
    }),
    state: (0, import_fields5.text)({
      ui: {
        description: "OAuth state parameter for CSRF protection"
      }
    }),
    codeChallenge: (0, import_fields5.text)({
      ui: {
        description: "PKCE code challenge"
      }
    }),
    codeChallengeMethod: (0, import_fields5.select)({
      options: [
        { label: "Plain", value: "plain" },
        { label: "SHA256", value: "S256" }
      ],
      ui: {
        description: "PKCE code challenge method"
      }
    }),
    ...trackingFields
  },
  ui: {
    labelField: "clientId",
    listView: {
      initialColumns: ["tokenType", "clientId", "user", "scopes", "expiresAt", "isRevoked"]
    }
  }
});

// features/keystone/models/business.ts
var import_core7 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");

// features/keystone/utils/ownership.ts
function ownProfileFilter({ session }) {
  if (!session) return false;
  return { profile: { owner: { id: { equals: session.itemId } } } };
}
function ownerFilter({ session }) {
  if (!session) return false;
  return { owner: { id: { equals: session.itemId } } };
}
async function attachOwnProfile({ operation, resolvedData, context }) {
  if (operation !== "create") return resolvedData;
  const userId = context.session?.itemId;
  if (!userId) throw new Error("Sign in first.");
  const [profile] = await context.sudo().query.TutorProfile.findMany({ where: { owner: { id: { equals: userId } } }, take: 1, query: "id" });
  if (!profile) throw new Error("Set up your business first.");
  return { ...resolvedData, profile: { connect: { id: profile.id } } };
}

// features/keystone/models/fields.ts
var import_fields6 = require("@keystone-6/core/fields");
var no = () => false;
var commandOnly = {
  access: { create: no, update: no },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
};
var secret2 = {
  access: { read: no, create: no, update: no },
  ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
};
function profileField(backRef) {
  return (0, import_fields6.relationship)({
    ref: `TutorProfile.${backRef}`,
    db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") },
    access: { create: no, update: no },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
  });
}
var ownedMany = (ref) => (0, import_fields6.relationship)({ ref, many: true, access: { create: no, update: no }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" } } });
function ownCrud(perm, opts = {}) {
  return {
    operation: { query: perm, create: perm, update: perm, delete: opts.delete === false ? no : perm },
    filter: { query: ownProfileFilter, update: ownProfileFilter, delete: ownProfileFilter }
  };
}
function ownReadOnly(perm = permissions.canReadPayments) {
  return {
    operation: { query: perm, create: no, update: no, delete: no },
    filter: { query: ownProfileFilter }
  };
}
var attachProfileHook = { resolveInput: attachOwnProfile };
function sameProfileHooks(checks) {
  return {
    resolveInput: attachOwnProfile,
    validateInput: async ({ resolvedData, context, addValidationError }) => {
      const userId = context.session?.itemId;
      if (!userId) return;
      for (const { field, list: list9 } of checks) {
        const value = resolvedData[field];
        if (!value) continue;
        const raw = [value.connect, value.set].flat().filter(Boolean);
        const ids = raw.map((v) => v.id).filter((v) => typeof v === "string");
        if (!ids.length) continue;
        const count = await context.sudo().db[list9].count({ where: { id: { in: ids }, profile: { owner: { id: { equals: userId } } } } });
        if (count !== new Set(ids).size) addValidationError(`${field}: choose from your own records.`);
      }
    }
  };
}

// features/keystone/models/business.ts
var no2 = () => false;
var textarea = { ui: { displayMode: "textarea" } };
var TutorProfile = (0, import_core7.list)({
  access: {
    operation: { query: permissions.canManageBusiness, create: no2, update: permissions.canManageBusiness, delete: no2 },
    filter: { query: ownerFilter, update: ownerFilter }
  },
  ui: { labelField: "businessName", listView: { initialColumns: ["businessName", "slug", "timezone", "bookingOpen"] } },
  fields: {
    owner: (0, import_fields7.relationship)({ ref: "User.tutorProfile", ...commandOnly }),
    businessName: (0, import_fields7.text)({ validation: { isRequired: true } }),
    tutorName: (0, import_fields7.text)({ ui: { description: "Your own name as families see it." } }),
    slug: (0, import_fields7.text)({
      isIndexed: "unique",
      validation: { isRequired: true, match: { regex: /^[a-z0-9][a-z0-9-]{1,40}$/, explanation: "Use lowercase letters, numbers and hyphens (2 to 41 characters)." } },
      ui: { description: "Your page address: /t/<this>." }
    }),
    headline: (0, import_fields7.text)(),
    bio: (0, import_fields7.text)(textarea),
    photoUrl: (0, import_fields7.text)({ ui: { description: "An image address for your photo (https://\u2026)." } }),
    qualifications: (0, import_fields7.text)(textarea),
    phone: (0, import_fields7.text)(),
    email: (0, import_fields7.text)(),
    city: (0, import_fields7.text)(),
    country: (0, import_fields7.text)({ ui: { description: "Two-letter country code, e.g. US, PK, GB." } }),
    timezone: (0, import_fields7.text)({ defaultValue: "America/New_York", validation: { isRequired: true } }),
    currencyCode: (0, import_fields7.text)({ defaultValue: "USD", validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "A three-letter currency code, e.g. USD." } } }),
    teachesOnline: (0, import_fields7.checkbox)({ defaultValue: true }),
    teachesInPerson: (0, import_fields7.checkbox)({ defaultValue: false }),
    inPersonArea: (0, import_fields7.text)({ ui: { description: 'Where you teach in person, e.g. "North Austin and Round Rock".' } }),
    defaultMeetingUrl: (0, import_fields7.text)({ ui: { description: "Your Zoom room, Google Meet or any lesson link." } }),
    bookingOpen: (0, import_fields7.checkbox)({ defaultValue: true, ui: { description: "Families can book from your page." } }),
    slotMinutes: (0, import_fields7.integer)({ defaultValue: 30, validation: { isRequired: true, min: 5, max: 120 } }),
    bufferMinutes: (0, import_fields7.integer)({ defaultValue: 10, validation: { isRequired: true, min: 0, max: 120 } }),
    minNoticeHours: (0, import_fields7.integer)({ defaultValue: 12, validation: { isRequired: true, min: 0, max: 720 } }),
    maxAdvanceDays: (0, import_fields7.integer)({ defaultValue: 60, validation: { isRequired: true, min: 1, max: 365 } }),
    cancellationWindowHours: (0, import_fields7.integer)({ defaultValue: 24, validation: { isRequired: true, min: 0, max: 168 } }),
    lateCancelPercent: (0, import_fields7.integer)({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 100 } }),
    noShowPercent: (0, import_fields7.integer)({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 100 } }),
    unpaidHoldMinutes: (0, import_fields7.integer)({ defaultValue: 60, validation: { isRequired: true, min: 30, max: 1440 }, ui: { description: "How long an online booking waiting for card payment keeps its time (30 to 1440 minutes)." } }),
    reschedulesAllowed: (0, import_fields7.integer)({ defaultValue: 2, validation: { isRequired: true, min: 0, max: 10 } }),
    paymentInstructions: (0, import_fields7.text)({ ui: { displayMode: "textarea", description: "How families pay you directly: bank transfer, Zelle, JazzCash, M-Pesa\u2026" } }),
    policiesText: (0, import_fields7.text)(textarea),
    invoiceDueDays: (0, import_fields7.integer)({ defaultValue: 7, validation: { isRequired: true, min: 0, max: 90 } }),
    invoiceCounter: (0, import_fields7.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    reviewsEnabled: (0, import_fields7.checkbox)({ defaultValue: true }),
    calendarTokenHash: (0, import_fields7.text)(secret2),
    subjects: ownedMany("Subject.profile"),
    sessionTypes: ownedMany("SessionType.profile"),
    weeklyHours: ownedMany("WeeklyHours.profile"),
    timeOff: ownedMany("TimeOff.profile"),
    packages: ownedMany("Package.profile"),
    families: ownedMany("Family.profile"),
    students: ownedMany("Student.profile"),
    inquiries: ownedMany("Inquiry.profile"),
    reviews: ownedMany("Review.profile"),
    sessions: ownedMany("Session.profile"),
    sessionNotes: ownedMany("SessionNote.profile"),
    homework: ownedMany("Homework.profile"),
    progressMarks: ownedMany("ProgressMark.profile"),
    resources: ownedMany("Resource.profile"),
    series: ownedMany("RecurringSeries.profile"),
    purchases: ownedMany("PackagePurchase.profile"),
    creditEntries: ownedMany("CreditEntry.profile"),
    invoices: ownedMany("Invoice.profile"),
    invoiceLines: ownedMany("InvoiceLine.profile"),
    payments: ownedMany("Payment.profile"),
    paymentProviders: ownedMany("PaymentProvider.profile"),
    paymentSessions: ownedMany("PaymentSession.profile"),
    expenses: ownedMany("Expense.profile"),
    notifications: ownedMany("NotificationLog.profile"),
    ...trackingFields
  }
});
var Subject = (0, import_core7.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ["name", "levels", "active", "sortOrder"] } },
  fields: {
    profile: profileField("subjects"),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    levels: (0, import_fields7.text)({ ui: { description: 'e.g. "Grades 6 to 12", "IGCSE and A level".' } }),
    sortOrder: (0, import_fields7.integer)({ defaultValue: 0 }),
    active: (0, import_fields7.checkbox)({ defaultValue: true }),
    sessionTypes: (0, import_fields7.relationship)({ ref: "SessionType.subjects", many: true }),
    students: (0, import_fields7.relationship)({ ref: "Student.subjects", many: true }),
    ...trackingFields
  }
});
var SessionType = (0, import_core7.list)({
  hooks: sameProfileHooks([{ field: "subjects", list: "Subject" }]),
  access: ownCrud(permissions.canManageBusiness, { delete: false }),
  ui: { listView: { initialColumns: ["name", "durationMinutes", "priceCents", "mode", "openToNewFamilies", "active"] } },
  fields: {
    profile: profileField("sessionTypes"),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    description: (0, import_fields7.text)(textarea),
    durationMinutes: (0, import_fields7.integer)({ defaultValue: 60, validation: { isRequired: true, min: 10, max: 480 } }),
    priceCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 1e7 }, ui: { description: "Price in minor units (cents). 0 is free." } }),
    mode: (0, import_fields7.select)({ type: "enum", options: [{ label: "Online", value: "online" }, { label: "In person", value: "in_person" }, { label: "Either", value: "either" }], defaultValue: "online", validation: { isRequired: true } }),
    openToNewFamilies: (0, import_fields7.checkbox)({ defaultValue: false, ui: { description: "New families may book this type from your page." } }),
    maxStudents: (0, import_fields7.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 4 }, ui: { description: "Siblings from one family in one session (1 to 4)." } }),
    subjects: (0, import_fields7.relationship)({ ref: "Subject.sessionTypes", many: true }),
    packages: (0, import_fields7.relationship)({ ref: "Package.appliesTo", many: true, ...commandOnly }),
    active: (0, import_fields7.checkbox)({ defaultValue: true }),
    sortOrder: (0, import_fields7.integer)({ defaultValue: 0 }),
    sessions: (0, import_fields7.relationship)({ ref: "Session.sessionType", many: true, ...commandOnly }),
    series: (0, import_fields7.relationship)({ ref: "RecurringSeries.sessionType", many: true, ...commandOnly }),
    ...trackingFields
  }
});
var WeeklyHours = (0, import_core7.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  graphql: { plural: "WeeklyHoursRows" },
  ui: { listView: { initialColumns: ["dayOfWeek", "isWorking", "startMinute", "endMinute"] } },
  fields: {
    profile: profileField("weeklyHours"),
    dayOfWeek: (0, import_fields7.select)({
      type: "enum",
      options: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value })),
      validation: { isRequired: true }
    }),
    isWorking: (0, import_fields7.checkbox)({ defaultValue: true }),
    startMinute: (0, import_fields7.integer)({ defaultValue: 900, validation: { isRequired: true, min: 0, max: 1439 }, ui: { description: "Minutes after midnight (900 = 3:00 PM)." } }),
    endMinute: (0, import_fields7.integer)({ defaultValue: 1200, validation: { isRequired: true, min: 1, max: 1440 }, ui: { description: "Minutes after midnight (1200 = 8:00 PM)." } }),
    breakStartMinute: (0, import_fields7.integer)({ validation: { min: 0, max: 1439 } }),
    breakEndMinute: (0, import_fields7.integer)({ validation: { min: 1, max: 1440 } }),
    ...trackingFields
  }
});
var TimeOff = (0, import_core7.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ["startsAt", "endsAt", "reason"] } },
  fields: {
    profile: profileField("timeOff"),
    startsAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    reason: (0, import_fields7.text)(),
    ...trackingFields
  }
});
var Package = (0, import_core7.list)({
  hooks: sameProfileHooks([{ field: "appliesTo", list: "SessionType" }]),
  access: ownCrud(permissions.canManageBusiness, { delete: false }),
  ui: { listView: { initialColumns: ["name", "minutes", "priceCents", "validMonths", "active"] } },
  fields: {
    profile: profileField("packages"),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    description: (0, import_fields7.text)(textarea),
    minutes: (0, import_fields7.integer)({ validation: { isRequired: true, min: 30, max: 6e4 }, ui: { description: "Prepaid minutes (600 = 10 hours)." } }),
    priceCents: (0, import_fields7.integer)({ validation: { isRequired: true, min: 0, max: 1e8 } }),
    validMonths: (0, import_fields7.integer)({ defaultValue: 12, validation: { isRequired: true, min: 1, max: 60 } }),
    appliesTo: (0, import_fields7.relationship)({ ref: "SessionType.packages", many: true, ui: { description: "Leave empty to use on any session type." } }),
    active: (0, import_fields7.checkbox)({ defaultValue: true }),
    sortOrder: (0, import_fields7.integer)({ defaultValue: 0 }),
    purchases: (0, import_fields7.relationship)({ ref: "PackagePurchase.package", many: true, ...commandOnly }),
    ...trackingFields
  }
});

// features/keystone/models/people.ts
var import_core8 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var textarea2 = { ui: { displayMode: "textarea" } };
var opt = (...values) => values.map((value) => ({ label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value }));
var Family = (0, import_core8.list)({
  hooks: sameProfileHooks([]),
  access: ownCrud(permissions.canManageFamilies, { delete: false }),
  ui: { labelField: "guardianName", listView: { initialColumns: ["guardianName", "email", "phone", "status", "billingMode"] } },
  fields: {
    profile: profileField("families"),
    guardianName: (0, import_fields9.text)({ validation: { isRequired: true } }),
    email: (0, import_fields9.text)({ isIndexed: true }),
    phone: (0, import_fields9.text)(),
    secondContactName: (0, import_fields9.text)(),
    secondContactPhone: (0, import_fields9.text)(),
    status: (0, import_fields9.select)({ type: "enum", options: opt("lead", "active", "paused", "former", "blocked"), defaultValue: "lead", validation: { isRequired: true } }),
    billingMode: (0, import_fields9.select)({ type: "enum", options: opt("pay_as_you_book", "invoice", "flat_monthly"), defaultValue: "pay_as_you_book", validation: { isRequired: true } }),
    monthlyFeeCents: (0, import_fields9.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 1e8 }, ui: { description: "Fixed monthly fee in minor units (flat monthly billing only)." } }),
    address: (0, import_fields9.text)({ ui: { displayMode: "textarea", description: "For in-person lessons." } }),
    timezone: (0, import_fields9.text)(),
    howTheyFoundMe: (0, import_fields9.text)(),
    privateNotes: (0, import_fields9.text)({ ui: { displayMode: "textarea", description: "Only you see this." } }),
    user: (0, import_fields9.relationship)({ ref: "User.family", ...commandOnly }),
    inviteTokenHash: (0, import_fields9.text)(secret2),
    calendarTokenHash: (0, import_fields9.text)(secret2),
    students: (0, import_fields9.relationship)({ ref: "Student.family", many: true, ...commandOnly }),
    sessions: (0, import_fields9.relationship)({ ref: "Session.family", many: true, ...commandOnly }),
    series: (0, import_fields9.relationship)({ ref: "RecurringSeries.family", many: true, ...commandOnly }),
    purchases: (0, import_fields9.relationship)({ ref: "PackagePurchase.family", many: true, ...commandOnly }),
    invoices: (0, import_fields9.relationship)({ ref: "Invoice.family", many: true, ...commandOnly }),
    payments: (0, import_fields9.relationship)({ ref: "Payment.family", many: true, ...commandOnly }),
    reviews: (0, import_fields9.relationship)({ ref: "Review.family", many: true, ...commandOnly }),
    inquiries: (0, import_fields9.relationship)({ ref: "Inquiry.family", many: true, ...commandOnly }),
    ...trackingFields
  }
});
var Student = (0, import_core8.list)({
  hooks: sameProfileHooks([{ field: "family", list: "Family" }, { field: "subjects", list: "Subject" }]),
  access: ownCrud(permissions.canManageFamilies, { delete: false }),
  ui: { labelField: "firstName", listView: { initialColumns: ["firstName", "lastName", "family", "level", "status"] } },
  fields: {
    profile: profileField("students"),
    family: (0, import_fields9.relationship)({ ref: "Family.students", db: { foreignKey: true } }),
    firstName: (0, import_fields9.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields9.text)(),
    level: (0, import_fields9.text)({ ui: { description: 'Grade or year, e.g. "Grade 10", "Year 11".' } }),
    school: (0, import_fields9.text)(),
    birthYear: (0, import_fields9.integer)({ validation: { min: 1900, max: 2100 } }),
    goals: (0, import_fields9.text)(textarea2),
    needs: (0, import_fields9.text)({ ui: { displayMode: "textarea", description: "What to watch for. Only you see this." } }),
    meetingUrl: (0, import_fields9.text)({ ui: { description: "Overrides your default lesson link for this student." } }),
    status: (0, import_fields9.select)({ type: "enum", options: opt("active", "paused", "finished"), defaultValue: "active", validation: { isRequired: true } }),
    subjects: (0, import_fields9.relationship)({ ref: "Subject.students", many: true }),
    sessions: (0, import_fields9.relationship)({ ref: "Session.students", many: true, ...commandOnly }),
    series: (0, import_fields9.relationship)({ ref: "RecurringSeries.students", many: true, ...commandOnly }),
    homework: (0, import_fields9.relationship)({ ref: "Homework.student", many: true, ...commandOnly }),
    marks: (0, import_fields9.relationship)({ ref: "ProgressMark.student", many: true, ...commandOnly }),
    resources: (0, import_fields9.relationship)({ ref: "Resource.students", many: true, ...commandOnly }),
    ...trackingFields
  }
});
var Inquiry = (0, import_core8.list)({
  access: {
    // Created by the public `sendInquiry` command only.
    operation: { query: permissions.canManageFamilies, create: () => false, update: permissions.canManageFamilies, delete: () => false },
    filter: { query: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false, update: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false }
  },
  ui: { listView: { initialColumns: ["name", "email", "studentLevel", "subject", "status", "createdAt"] } },
  fields: {
    profile: profileField("inquiries"),
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    email: (0, import_fields9.text)(),
    phone: (0, import_fields9.text)(),
    studentLevel: (0, import_fields9.text)(),
    subject: (0, import_fields9.text)(),
    message: (0, import_fields9.text)(textarea2),
    status: (0, import_fields9.select)({ type: "enum", options: opt("new", "contacted", "converted", "closed"), defaultValue: "new", validation: { isRequired: true }, ...commandOnly }),
    family: (0, import_fields9.relationship)({ ref: "Family.inquiries", ...commandOnly }),
    ...trackingFields
  }
});
var Review = (0, import_core8.list)({
  access: {
    // Written by `submitReview`; published or hidden by `moderateReview`.
    operation: { query: permissions.canManageFamilies, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false }
  },
  ui: { listView: { initialColumns: ["displayName", "rating", "status", "createdAt"] } },
  fields: {
    profile: profileField("reviews"),
    // One per family, enforced by `submitReview` under the family lock.
    family: (0, import_fields9.relationship)({ ref: "Family.reviews", ...commandOnly }),
    displayName: (0, import_fields9.text)({ validation: { isRequired: true } }),
    rating: (0, import_fields9.integer)({ validation: { isRequired: true, min: 1, max: 5 } }),
    body: (0, import_fields9.text)(textarea2),
    status: (0, import_fields9.select)({ type: "enum", options: opt("pending", "published", "hidden"), defaultValue: "pending", validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/teaching.ts
var import_core9 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var no3 = () => false;
var textarea3 = { ui: { displayMode: "textarea" } };
var opt2 = (...values) => values.map((value) => ({ label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value }));
var readonlyEnum = (values, defaultValue) => (0, import_fields11.select)({ type: "enum", options: opt2(...values), defaultValue, validation: { isRequired: true }, ...commandOnly });
var SESSION_STATUSES = ["pending_payment", "scheduled", "completed", "cancelled", "late_cancelled", "no_show", "excused", "released"];
var FUNDINGS = ["package", "card", "invoice", "flat", "free"];
var Session = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canManageSessions, create: no3, update: permissions.canManageSessions, delete: no3 },
    filter: { query: ownProfileFilter, update: ownProfileFilter }
  },
  ui: { labelField: "typeNameSnapshot", listView: { initialColumns: ["startsAt", "family", "typeNameSnapshot", "status", "funding", "paymentStatus"] } },
  fields: {
    profile: profileField("sessions"),
    family: (0, import_fields11.relationship)({ ref: "Family.sessions", ...commandOnly }),
    students: (0, import_fields11.relationship)({ ref: "Student.sessions", many: true, ...commandOnly }),
    sessionType: (0, import_fields11.relationship)({ ref: "SessionType.sessions", ...commandOnly }),
    series: (0, import_fields11.relationship)({ ref: "RecurringSeries.sessions", ...commandOnly }),
    startsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true }, ...commandOnly }),
    endsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true }, ...commandOnly }),
    mode: (0, import_fields11.select)({ type: "enum", options: opt2("online", "in_person"), defaultValue: "online", validation: { isRequired: true } }),
    meetingUrl: (0, import_fields11.text)({ ui: { description: "Overrides the student and default lesson link for this session." } }),
    locationText: (0, import_fields11.text)(),
    status: readonlyEnum([...SESSION_STATUSES], "scheduled"),
    funding: readonlyEnum([...FUNDINGS], "free"),
    source: readonlyEnum(["online", "tutor", "series"], "tutor"),
    typeNameSnapshot: (0, import_fields11.text)(commandOnly),
    priceCents: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    chargedCents: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    chargedMinutes: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    billable: (0, import_fields11.select)({ type: "enum", options: opt2("no", "yes"), defaultValue: "no", validation: { isRequired: true }, ...commandOnly }),
    paymentStatus: readonlyEnum(["not_due", "unpaid", "paid", "refunded", "part_refunded"], "not_due"),
    holdEndsAt: (0, import_fields11.timestamp)(commandOnly),
    guardianMessage: (0, import_fields11.text)({ ui: { displayMode: "textarea" }, ...commandOnly }),
    cancellationReason: (0, import_fields11.text)(commandOnly),
    cancelledBy: readonlyEnum(["none", "guardian", "tutor", "system"], "none"),
    cancelledAt: (0, import_fields11.timestamp)(commandOnly),
    completedAt: (0, import_fields11.timestamp)(commandOnly),
    rescheduleCount: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    rescheduledFrom: (0, import_fields11.timestamp)(commandOnly),
    reminderSentAt: (0, import_fields11.timestamp)(commandOnly),
    publicAccessTokenHash: (0, import_fields11.text)(secret2),
    note: (0, import_fields11.relationship)({ ref: "SessionNote.session", ...commandOnly }),
    homework: (0, import_fields11.relationship)({ ref: "Homework.session", many: true, ...commandOnly }),
    creditEntries: (0, import_fields11.relationship)({ ref: "CreditEntry.session", many: true, ...commandOnly }),
    payments: (0, import_fields11.relationship)({ ref: "Payment.session", many: true, ...commandOnly }),
    paymentSessions: (0, import_fields11.relationship)({ ref: "PaymentSession.session", many: true, ...commandOnly }),
    invoiceLines: (0, import_fields11.relationship)({ ref: "InvoiceLine.session", many: true, ...commandOnly }),
    ...trackingFields
  }
});
var SessionNote = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canManageSessions, create: no3, update: permissions.canManageSessions, delete: no3 },
    filter: { query: ownProfileFilter, update: ownProfileFilter }
  },
  ui: { listView: { initialColumns: ["session", "covered", "workOnNext", "sharedAt"] } },
  fields: {
    profile: profileField("sessionNotes"),
    session: (0, import_fields11.relationship)({ ref: "Session.note", db: { foreignKey: true }, ...commandOnly }),
    covered: (0, import_fields11.text)(textarea3),
    wentWell: (0, import_fields11.text)(textarea3),
    workOnNext: (0, import_fields11.text)(textarea3),
    effort: (0, import_fields11.integer)({ validation: { min: 1, max: 5 } }),
    privateNote: (0, import_fields11.text)({ ui: { displayMode: "textarea", description: "Only you see this." } }),
    sharedAt: (0, import_fields11.timestamp)(commandOnly),
    ...trackingFields
  }
});
var Homework = (0, import_core9.list)({
  hooks: sameProfileHooks([{ field: "student", list: "Student" }]),
  access: ownCrud(permissions.canManageSessions),
  graphql: { plural: "HomeworkItems" },
  ui: { listView: { initialColumns: ["title", "student", "dueAt", "status"] } },
  fields: {
    profile: profileField("homework"),
    student: (0, import_fields11.relationship)({ ref: "Student.homework" }),
    session: (0, import_fields11.relationship)({ ref: "Session.homework", ...commandOnly }),
    title: (0, import_fields11.text)({ validation: { isRequired: true } }),
    instructions: (0, import_fields11.text)(textarea3),
    dueAt: (0, import_fields11.timestamp)(),
    linkUrl: (0, import_fields11.text)(),
    file: (0, import_fields11.file)({ storage: "tutor_files" }),
    status: readonlyEnum(["assigned", "handed_in", "reviewed"], "assigned"),
    handedInAt: (0, import_fields11.timestamp)(commandOnly),
    guardianComment: (0, import_fields11.text)({ ui: { displayMode: "textarea" }, ...commandOnly }),
    handInUrl: (0, import_fields11.text)(commandOnly),
    feedback: (0, import_fields11.text)({ ui: { displayMode: "textarea" }, ...commandOnly }),
    reviewedAt: (0, import_fields11.timestamp)(commandOnly),
    ...trackingFields
  }
});
var ProgressMark = (0, import_core9.list)({
  hooks: sameProfileHooks([{ field: "student", list: "Student" }]),
  access: ownCrud(permissions.canManageSessions),
  ui: { listView: { initialColumns: ["student", "label", "takenOn", "score", "outOf"] } },
  fields: {
    profile: profileField("progressMarks"),
    student: (0, import_fields11.relationship)({ ref: "Student.marks" }),
    label: (0, import_fields11.text)({ validation: { isRequired: true }, ui: { description: 'e.g. "Unit 3 test", "SAT practice 4".' } }),
    takenOn: (0, import_fields11.timestamp)({ validation: { isRequired: true } }),
    score: (0, import_fields11.integer)({ validation: { isRequired: true, min: 0 } }),
    outOf: (0, import_fields11.integer)({ validation: { isRequired: true, min: 1 } }),
    note: (0, import_fields11.text)(),
    ...trackingFields
  }
});
var Resource = (0, import_core9.list)({
  hooks: sameProfileHooks([{ field: "students", list: "Student" }]),
  access: ownCrud(permissions.canManageSessions),
  ui: { listView: { initialColumns: ["title", "linkUrl", "students"] } },
  fields: {
    profile: profileField("resources"),
    title: (0, import_fields11.text)({ validation: { isRequired: true } }),
    linkUrl: (0, import_fields11.text)(),
    file: (0, import_fields11.file)({ storage: "tutor_files" }),
    students: (0, import_fields11.relationship)({ ref: "Student.resources", many: true, ui: { description: "Leave empty to share with every active student." } }),
    note: (0, import_fields11.text)(textarea3),
    ...trackingFields
  }
});
var RecurringSeries = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canManageSessions, create: no3, update: no3, delete: no3 },
    filter: { query: ownProfileFilter }
  },
  graphql: { plural: "RecurringSeriesItems" },
  ui: { listView: { initialColumns: ["family", "sessionType", "dayOfWeek", "startMinute", "status"] } },
  fields: {
    profile: profileField("series"),
    family: (0, import_fields11.relationship)({ ref: "Family.series", ...commandOnly }),
    students: (0, import_fields11.relationship)({ ref: "Student.series", many: true, ...commandOnly }),
    sessionType: (0, import_fields11.relationship)({ ref: "SessionType.series", ...commandOnly }),
    dayOfWeek: (0, import_fields11.integer)({ validation: { isRequired: true, min: 0, max: 6 }, ...commandOnly, ui: { description: "0 = Sunday \u2026 6 = Saturday, in your timezone." } }),
    startMinute: (0, import_fields11.integer)({ validation: { isRequired: true, min: 0, max: 1439 }, ...commandOnly }),
    mode: (0, import_fields11.select)({ type: "enum", options: opt2("online", "in_person"), defaultValue: "online", validation: { isRequired: true }, ...commandOnly }),
    startsOn: (0, import_fields11.text)({ validation: { isRequired: true }, ...commandOnly, ui: { description: "YYYY-MM-DD" } }),
    endsOn: (0, import_fields11.text)(commandOnly),
    status: readonlyEnum(["active", "paused", "ended"], "active"),
    generatedThrough: (0, import_fields11.text)(commandOnly),
    skippedDates: (0, import_fields11.text)({ ui: { displayMode: "textarea", description: "Weeks that could not be booked (one YYYY-MM-DD per line)." }, ...commandOnly }),
    sessions: (0, import_fields11.relationship)({ ref: "Session.series", many: true, ...commandOnly }),
    ...trackingFields
  }
});

// features/keystone/models/money.ts
var import_core10 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var no4 = () => false;
var opt3 = (...values) => values.map((value) => ({ label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value }));
var readonlyEnum2 = (values, defaultValue) => (0, import_fields13.select)({ type: "enum", options: opt3(...values), defaultValue, validation: { isRequired: true }, ...commandOnly });
var ro = (extra = {}) => ({ ...commandOnly, ...extra });
var PackagePurchase = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManageFamilies),
  ui: { labelField: "nameSnapshot", listView: { initialColumns: ["family", "nameSnapshot", "minutesRemaining", "status", "expiresAt"] } },
  fields: {
    profile: profileField("purchases"),
    family: (0, import_fields13.relationship)({ ref: "Family.purchases", ...commandOnly }),
    package: (0, import_fields13.relationship)({ ref: "Package.purchases", ...commandOnly }),
    nameSnapshot: (0, import_fields13.text)(commandOnly),
    appliesToIds: (0, import_fields13.text)({ ...commandOnly, ui: { ...commandOnly.ui, description: "Session type ids this package covers, copied when bought (empty = any)." } }),
    minutesGranted: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    minutesRemaining: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    pricePaidCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundedCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    status: readonlyEnum2(["awaiting_payment", "active", "used_up", "expired", "refunded", "cancelled"], "awaiting_payment"),
    purchasedAt: (0, import_fields13.timestamp)(commandOnly),
    expiresAt: (0, import_fields13.timestamp)(commandOnly),
    entries: (0, import_fields13.relationship)({ ref: "CreditEntry.purchase", many: true, ...commandOnly }),
    payments: (0, import_fields13.relationship)({ ref: "Payment.purchase", many: true, ...commandOnly }),
    paymentSessions: (0, import_fields13.relationship)({ ref: "PaymentSession.purchase", many: true, ...commandOnly }),
    ...trackingFields
  }
});
var CreditEntry = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManageFamilies),
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["purchase", "kind", "minutes", "session", "createdAt"] } },
  fields: {
    profile: profileField("creditEntries"),
    purchase: (0, import_fields13.relationship)({ ref: "PackagePurchase.entries", ...commandOnly }),
    session: (0, import_fields13.relationship)({ ref: "Session.creditEntries", ...commandOnly }),
    kind: readonlyEnum2(["grant", "hold", "release", "debit", "reversal", "expire", "refund", "adjustment"], "grant"),
    minutes: (0, import_fields13.integer)(ro({ validation: { isRequired: true } })),
    note: (0, import_fields13.text)(commandOnly),
    key: (0, import_fields13.text)({ ...secret2, isIndexed: "unique" }),
    ...trackingFields
  }
});
var Invoice = (0, import_core10.list)({
  db: { extendPrismaSchema: (schema) => schema.replace(/\n}\s*$/, "\n  @@unique([profileId, number])\n}") },
  access: ownReadOnly(permissions.canManagePayments),
  ui: { labelField: "number", listView: { initialColumns: ["number", "family", "status", "totalCents", "paidCents", "dueAt"] } },
  fields: {
    profile: profileField("invoices"),
    family: (0, import_fields13.relationship)({ ref: "Family.invoices", ...commandOnly }),
    number: (0, import_fields13.text)(ro({ validation: { isRequired: true } })),
    status: readonlyEnum2(["draft", "sent", "paid", "void"], "draft"),
    issuedAt: (0, import_fields13.timestamp)(commandOnly),
    dueAt: (0, import_fields13.timestamp)(commandOnly),
    periodMonth: (0, import_fields13.text)(ro({ ui: { ...commandOnly.ui, description: "YYYY-MM of a flat monthly fee on this invoice." } })),
    subtotalCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    totalCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    paidCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    note: (0, import_fields13.text)(commandOnly),
    voidedAt: (0, import_fields13.timestamp)(commandOnly),
    lines: (0, import_fields13.relationship)({ ref: "InvoiceLine.invoice", many: true, ...commandOnly }),
    payments: (0, import_fields13.relationship)({ ref: "Payment.invoice", many: true, ...commandOnly }),
    paymentSessions: (0, import_fields13.relationship)({ ref: "PaymentSession.invoice", many: true, ...commandOnly }),
    publicAccessTokenHash: (0, import_fields13.text)(secret2),
    ...trackingFields
  }
});
var InvoiceLine = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManagePayments),
  ui: { listView: { initialColumns: ["invoice", "description", "quantity", "unitCents", "totalCents"] } },
  fields: {
    profile: profileField("invoiceLines"),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice.lines", ...commandOnly }),
    session: (0, import_fields13.relationship)({ ref: "Session.invoiceLines", ...commandOnly }),
    description: (0, import_fields13.text)(ro({ validation: { isRequired: true } })),
    quantity: (0, import_fields13.integer)(ro({ defaultValue: 1, validation: { isRequired: true, min: 1 } })),
    unitCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    totalCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    sortOrder: (0, import_fields13.integer)(ro({ defaultValue: 0 })),
    ...trackingFields
  }
});
var Payment = (0, import_core10.list)({
  access: ownReadOnly(permissions.canReadPayments),
  ui: { listView: { initialColumns: ["family", "kind", "method", "status", "amountCents", "paidAt"] } },
  fields: {
    profile: profileField("payments"),
    family: (0, import_fields13.relationship)({ ref: "Family.payments", ...commandOnly }),
    session: (0, import_fields13.relationship)({ ref: "Session.payments", ...commandOnly }),
    purchase: (0, import_fields13.relationship)({ ref: "PackagePurchase.payments", ...commandOnly }),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice.payments", ...commandOnly }),
    refundOf: (0, import_fields13.relationship)({ ref: "Payment.refunds", ...commandOnly }),
    refunds: (0, import_fields13.relationship)({ ref: "Payment.refundOf", many: true, ...commandOnly }),
    kind: readonlyEnum2(["session", "package", "invoice", "refund"], "session"),
    method: readonlyEnum2(["stripe", "cash", "bank_transfer", "mobile_money", "other"], "cash"),
    status: readonlyEnum2(["reported", "confirmed", "rejected", "refunded", "partially_refunded"], "confirmed"),
    amountCents: (0, import_fields13.integer)(ro({ validation: { isRequired: true, min: 0 } })),
    refundedCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundCount: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundPendingCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    currencyCode: (0, import_fields13.text)(ro({ defaultValue: "USD" })),
    reference: (0, import_fields13.text)(commandOnly),
    providerReference: (0, import_fields13.text)(commandOnly),
    paidAt: (0, import_fields13.timestamp)(commandOnly),
    reportedByGuardian: (0, import_fields13.checkbox)({ defaultValue: false, ...commandOnly }),
    decidedAt: (0, import_fields13.timestamp)(commandOnly),
    note: (0, import_fields13.text)(commandOnly),
    ...trackingFields
  }
});
var adapter = { validation: { isRequired: true }, defaultValue: "manual", ui: { description: "Name of the payment adapter this operation uses." } };
var PaymentProvider = (0, import_core10.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManagePayments),
  ui: { listView: { initialColumns: ["name", "code", "isInstalled"] } },
  fields: {
    profile: profileField("paymentProviders"),
    name: (0, import_fields13.text)({ validation: { isRequired: true } }),
    code: (0, import_fields13.text)({ validation: { isRequired: true, match: { regex: /^pp_(manual|stripe)$/, explanation: "Provider code is pp_manual or pp_stripe." } } }),
    isInstalled: (0, import_fields13.checkbox)({ defaultValue: true }),
    createPaymentFunction: (0, import_fields13.text)(adapter),
    capturePaymentFunction: (0, import_fields13.text)(adapter),
    refundPaymentFunction: (0, import_fields13.text)(adapter),
    getPaymentStatusFunction: (0, import_fields13.text)(adapter),
    generatePaymentLinkFunction: (0, import_fields13.text)(adapter),
    handleWebhookFunction: (0, import_fields13.text)(adapter),
    paymentSessions: (0, import_fields13.relationship)({ ref: "PaymentSession.paymentProvider", many: true, ...commandOnly }),
    ...trackingFields
  }
});
var PaymentSession = (0, import_core10.list)({
  access: ownReadOnly(permissions.canReadPayments),
  ui: { listView: { initialColumns: ["target", "status", "amountCents", "expiresAt"] } },
  fields: {
    profile: profileField("paymentSessions"),
    target: readonlyEnum2(["session", "package", "invoice"], "session"),
    session: (0, import_fields13.relationship)({ ref: "Session.paymentSessions", ...commandOnly }),
    purchase: (0, import_fields13.relationship)({ ref: "PackagePurchase.paymentSessions", ...commandOnly }),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice.paymentSessions", ...commandOnly }),
    paymentProvider: (0, import_fields13.relationship)({ ref: "PaymentProvider.paymentSessions", ...commandOnly }),
    status: readonlyEnum2(["pending", "captured", "expired", "cancelled", "refunded"], "pending"),
    amountCents: (0, import_fields13.integer)(ro({ validation: { isRequired: true, min: 0 } })),
    currencyCode: (0, import_fields13.text)(ro({ defaultValue: "USD" })),
    providerPaymentId: (0, import_fields13.text)({ ...commandOnly, isIndexed: true }),
    expiresAt: (0, import_fields13.timestamp)(commandOnly),
    capturedAt: (0, import_fields13.timestamp)(commandOnly),
    ...trackingFields
  }
});
var PaymentWebhookEvent = (0, import_core10.list)({
  access: { operation: { query: no4, create: no4, update: no4, delete: no4 } },
  ui: { isHidden: true },
  fields: {
    replayKey: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    providerCode: (0, import_fields13.text)({ validation: { isRequired: true } }),
    providerEventId: (0, import_fields13.text)({ validation: { isRequired: true } }),
    eventType: (0, import_fields13.text)({ validation: { isRequired: true } }),
    payloadHash: (0, import_fields13.text)({ validation: { isRequired: true } }),
    processedAt: (0, import_fields13.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Expense = (0, import_core10.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canViewEarnings),
  ui: { listView: { initialColumns: ["spentOn", "category", "amountCents", "note"] } },
  fields: {
    profile: profileField("expenses"),
    spentOn: (0, import_fields13.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } }),
    category: (0, import_fields13.select)({ type: "enum", options: opt3("travel", "materials", "software", "room", "other"), defaultValue: "other", validation: { isRequired: true } }),
    amountCents: (0, import_fields13.integer)({ validation: { isRequired: true, min: 0, max: 1e8 } }),
    note: (0, import_fields13.text)(),
    ...trackingFields
  }
});
var NotificationLog = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ["kind", "to", "subject", "status", "createdAt"] } },
  fields: {
    profile: profileField("notifications"),
    kind: (0, import_fields13.text)(ro({ validation: { isRequired: true } })),
    to: (0, import_fields13.text)(commandOnly),
    subject: (0, import_fields13.text)(commandOnly),
    link: (0, import_fields13.text)(commandOnly),
    status: readonlyEnum2(["sent", "failed", "skipped"], "skipped"),
    error: (0, import_fields13.text)(commandOnly),
    session: (0, import_fields13.relationship)({ ref: "Session", ...commandOnly }),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice", ...commandOnly }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  OAuthApp,
  OAuthToken,
  TutorProfile,
  Subject,
  SessionType,
  WeeklyHours,
  TimeOff,
  Package,
  Family,
  Student,
  Inquiry,
  Review,
  Session,
  SessionNote,
  Homework,
  ProgressMark,
  Resource,
  RecurringSeries,
  PackagePurchase,
  CreditEntry,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentProvider,
  PaymentSession,
  PaymentWebhookEvent,
  Expense,
  NotificationLog
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/index.ts
var graphql = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql`
      type Query {
        redirectToInit: Boolean
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/mcp-oauth/session.ts
async function resolveMcpAccessToken(context, token, listKey = "User") {
  try {
    const sudo = context.sudo();
    const record = await sudo.db.OAuthToken.findOne({ where: { token: digestToken(token) } });
    if (!record || record.tokenType !== "access_token" || record.isRevoked !== "false" || !record.userId || !record.expiresAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return void 0;
    }
    const app = await sudo.db.OAuthApp.findOne({ where: { clientId: record.clientId } });
    if (!app || app.status !== "active") return void 0;
    const mcp = {
      clientId: record.clientId,
      scopes: storedScopes(record.scopes),
      tokenId: String(record.id)
    };
    return { itemId: String(record.userId), listKey, mcp };
  } catch {
    return void 0;
  }
}
function withMcpBearerSessions(strategy, listKey = "User") {
  return {
    ...strategy,
    async get({ context }) {
      const token = bearerToken(context?.req?.headers?.authorization);
      if (isMcpAccessToken(token)) return resolveMcpAccessToken(context, token, listKey);
      return strategy.get({ context });
    }
  };
}

// features/keystone/lib/storage.ts
var import_node_path = __toESM(require("node:path"));
function fileStorage(env = process.env) {
  if (env.S3_BUCKET_NAME) {
    return {
      kind: "s3",
      type: "file",
      bucketName: env.S3_BUCKET_NAME,
      region: env.S3_REGION || "us-east-1",
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      endpoint: env.S3_ENDPOINT || void 0,
      forcePathStyle: true,
      signed: { expiry: 3600 }
    };
  }
  return {
    kind: "local",
    type: "file",
    storagePath: uploadDir(env),
    generateUrl: (file2) => `/api/files${file2}`,
    serverRoute: null
  };
}
function uploadDir(env = process.env) {
  return import_node_path.default.resolve(env.UPLOAD_DIR || ".uploads/files");
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  secret: process.env.SESSION_SECRET || "this secret should only be used in testing"
};
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    // The first account on a deployment is the tutor who owns the business.
    itemData: { role: { create: { ...TUTOR_ROLE } } }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    onboardingStatus
    role {${ROLE_SESSION_FIELDS}
    }
  `
});
var keystone_default = withAuth(
  (0, import_core12.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    lists: models,
    storage: { tutor_files: fileStorage() },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
    },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions((0, import_session.statelessSessions)(sessionConfig)),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
