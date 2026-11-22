import { createTransport, type Transporter } from 'nodemailer'

import type { Db } from './business'

let transport: Transporter | null = null

export function mailConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.SMTP_HOST)
}

function mailer() {
  transport ??= createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  })
  return transport
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Sends one email and writes a `NotificationLog` row for it: `sent`, `failed`,
 * or `skipped` when mail is not set up. Never inside a transaction; never
 * throws, so a mail failure cannot undo the action that triggered it. Every
 * message carries one link the tutor can also copy from the dashboard.
 */
export async function notify(db: Db, input: {
  profileId: string
  kind: string
  to: string | null | undefined
  subject: string
  lines: string[]
  link?: string
  linkLabel?: string
  replyTo?: string | null
  sessionId?: string
  invoiceId?: string
}) {
  const to = (input.to || '').trim()
  let status: 'sent' | 'failed' | 'skipped' = 'skipped'
  let error = ''
  if (!to) error = 'No email address on file.'
  else if (!mailConfigured()) error = 'Email is not set up on this site (SMTP_HOST).'
  else {
    try {
      const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">${input.lines.map((l) => `<p>${esc(l)}</p>`).join('')}${input.link ? `<p><a href="${esc(input.link)}" style="display:inline-block;background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${esc(input.linkLabel || 'Open')}</a></p><p style="color:#666;font-size:13px">${esc(input.link)}</p>` : ''}</div>`
      const text = [...input.lines, input.link ? `${input.linkLabel || 'Open'}: ${input.link}` : ''].filter(Boolean).join('\n\n')
      await mailer().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, replyTo: input.replyTo || undefined, subject: input.subject, text, html })
      status = 'sent'
    } catch (e) {
      status = 'failed'
      error = e instanceof Error ? e.message.slice(0, 300) : 'Send failed'
    }
  }
  try {
    await db.notificationLog.create({ data: { profileId: input.profileId, kind: input.kind, to, subject: input.subject.slice(0, 200), link: input.link ?? '', status, error, sessionId: input.sessionId ?? null, invoiceId: input.invoiceId ?? null } })
  } catch (e) {
    console.error('[tutor] notification log failed', e instanceof Error ? e.message : e)
  }
  return { status, error }
}

/** RFC 5545 calendar text for one or more sessions. */
export function icsCalendar(name: string, events: Array<{ id: string; startsAt: Date; endsAt: Date; title: string; description?: string; location?: string; status?: string }>) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const fold = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Openfront Tutor//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${fold(name)}`]
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@openfront-tutor`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(e.startsAt)}`, `DTEND:${stamp(e.endsAt)}`, `SUMMARY:${fold(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${fold(e.description)}`)
    if (e.location) lines.push(`LOCATION:${fold(e.location)}`)
    lines.push(`STATUS:${e.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
