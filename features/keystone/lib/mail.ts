import { createTransport, type Transporter } from "nodemailer";

import { trustedOrigin } from "../../shared/trusted-origin";
import { mailConfigured } from "../utils/notify";

// Not a 'use server' module: these functions must never become client-callable actions.

let transport: Transporter | null = null;

function mailer() {
  transport ??= createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

/**
 * Where a reset link lands (S8). Staff reset on the dashboard; a family resets on
 * its own account pages. The origin comes from trustedOrigin(), never from request headers.
 */
export function passwordResetUrl(token: string, audience: "staff" | "family", env: NodeJS.ProcessEnv = process.env) {
  const path = audience === "staff" ? "/dashboard/reset" : "/account/reset";
  return `${trustedOrigin(env)}${path}?token=${encodeURIComponent(token)}`;
}

/** Staff means a role that opens the dashboard and no linked Family; everyone else is a family. */
export async function resetAudience(context: any, itemId: string): Promise<"staff" | "family"> {
  const user = await context.prisma.user.findUnique({
    where: { id: itemId },
    select: { role: { select: { canAccessDashboard: true } }, family: { select: { id: true } } },
  });
  if (!user || user.family) return "family";
  return user.role?.canAccessDashboard ? "staff" : "family";
}

function passwordResetEmail({ url }: { url: string }): string {
  return `
    <body style="background: #f9f9f9;">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: #ffffff; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: #444444;">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="#346df1"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid #346df1; display: inline-block; font-weight: bold;">Reset password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444444;">
            The link works once. If you did not ask for it, you can ignore this email.
          </td>
        </tr>
      </table>
    </body>
  `;
}

/**
 * Keystone's passwordResetLink.sendToken. Keystone only calls it when the account
 * exists, so it never throws: an error here would tell a stranger which emails have
 * accounts. Without SMTP_HOST it logs and returns; the reset pages check
 * mailConfigured() first and tell the person plainly that reset email is not set up.
 */
export async function sendPasswordResetEmail(args: { token: string; identity: string; itemId: string | number | bigint; context: any }): Promise<{ status: "sent" | "skipped" | "failed"; url: string }> {
  const url = passwordResetUrl(args.token, await resetAudience(args.context, String(args.itemId)));
  if (!mailConfigured()) {
    console.warn("[tutor] password reset email skipped: SMTP_HOST is not set");
    return { status: "skipped", url };
  }
  try {
    await mailer().sendMail({
      to: args.identity,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      subject: "Reset your password",
      text: `Reset your password: ${url}\n\nThe link works once. If you did not ask for it, you can ignore this email.`,
      html: passwordResetEmail({ url }),
    });
    return { status: "sent", url };
  } catch (e) {
    console.error("[tutor] password reset email failed:", e instanceof Error ? e.message.slice(0, 200) : "send failed");
    return { status: "failed", url };
  }
}
