import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { withMcpBearerSessions } from "./mcp-oauth/session";
import { ROLE_SESSION_FIELDS, TUTOR_ROLE } from "./access";
import { fileStorage } from "./lib/storage";

const databaseURL = process.env.DATABASE_URL || "file:./keystone.db";

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  secret:
    process.env.SESSION_SECRET || "this secret should only be used in testing",
};

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    // The first account on a deployment is the tutor who owns the business.
    itemData: { role: { create: { ...TUTOR_ROLE } } },
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    },
  },
  sessionData: `
    name
    email
    onboardingStatus
    role {${ROLE_SESSION_FIELDS}
    }
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: databaseURL,
    },
    lists: models,
    storage: { tutor_files: fileStorage() },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false,
    },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions(statelessSessions(sessionConfig)),
    graphql: {
      extendGraphqlSchema,
    },
  })
);
