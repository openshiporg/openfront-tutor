// S8 password reset: works with no SMTP set, and each kind of account gets its own reset page.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { ctx, prisma, assertTestDatabase, makeTutor, makeFamily } from './helpers'
import { passwordResetUrl, resetAudience } from '../../features/keystone/lib/mail'

describe('password reset (S8)', () => {
  const saved = { SMTP_HOST: process.env.SMTP_HOST, APP_ORIGIN: process.env.APP_ORIGIN }
  before(async () => { await assertTestDatabase(); delete process.env.SMTP_HOST; process.env.APP_ORIGIN = 'https://tutor.example.org' })
  after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } })

  test('S8a. without SMTP the reset request still answers true and stores a token', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { login: true })
    const user = await prisma.user.findFirstOrThrow({ where: { family: { id: f.family.id } } })
    const r = await ctx.graphql.raw({ query: 'mutation($e: String!) { sendUserPasswordResetLink(email: $e) }', variables: { e: user.email } })
    assert.equal(r.errors, undefined, JSON.stringify(r.errors))
    assert.equal((r.data as any).sendUserPasswordResetLink, true)
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    assert.ok(after.passwordResetToken, 'a token was issued')
  })

  test('S8b. a family resets on /account/reset, the tutor on /dashboard/reset, both on the trusted origin', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { login: true })
    const guardian = await prisma.user.findFirstOrThrow({ where: { family: { id: f.family.id } } })
    assert.equal(await resetAudience(ctx, guardian.id), 'family')
    assert.equal(await resetAudience(ctx, t.user.id), 'staff')
    assert.equal(passwordResetUrl('a b', 'family'), 'https://tutor.example.org/account/reset?token=a%20b')
    assert.equal(passwordResetUrl('tok', 'staff'), 'https://tutor.example.org/dashboard/reset?token=tok')
  })
})
