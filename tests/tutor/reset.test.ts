// S8 password reset: works with no SMTP set, and each kind of account gets its own reset page.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { ctx, prisma, assertTestDatabase, makeTutor, makeFamily } from './helpers'
import { passwordResetUrl, resetAudience } from '../../features/keystone/lib/mail'
import * as ops from '../../features/keystone/utils/tutorOps'

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

  test('S8c. without SMTP the tutor can give a claimed family a one-time password link that Keystone redeems', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { login: true })
    const user = await prisma.user.findFirstOrThrow({ where: { family: { id: f.family.id } } })
    const r = await ops.inviteFamily(prisma, t.session, f.family.id, true, ctx) as any
    assert.equal(r.kind, 'password')
    assert.equal(r.mail.status, 'skipped')
    const url = new URL(r.url)
    assert.equal(url.origin + url.pathname, 'https://tutor.example.org/account/reset')
    const token = url.searchParams.get('token')!
    const redeem = 'mutation($e: String!, $t: String!, $p: String!) { redeemUserPasswordResetToken(email: $e, token: $t, password: $p) { code message } }'
    const wrong = await ctx.graphql.raw({ query: redeem, variables: { e: user.email, t: token + 'x', p: 'a-new-password-1' } })
    assert.equal((wrong.data as any).redeemUserPasswordResetToken.code, 'FAILURE')
    const ok = await ctx.graphql.raw({ query: redeem, variables: { e: user.email, t: token, p: 'a-new-password-1' } })
    assert.equal(ok.errors, undefined, JSON.stringify(ok.errors))
    assert.equal((ok.data as any).redeemUserPasswordResetToken, null, 'redeemed')
    const again = await ctx.graphql.raw({ query: redeem, variables: { e: user.email, t: token, p: 'another-password-2' } })
    assert.equal((again.data as any).redeemUserPasswordResetToken.code, 'TOKEN_REDEEMED', 'the link works once')
    // Sign-in itself needs a request to set the cookie on, so check the stored hash changed to a real one.
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    assert.notEqual(stored.password, user.password)
    assert.match(stored.password, /^\$2[aby]\$\d{2}\$/, 'a bcrypt hash written by Keystone')
  })

  test('S8d. another tutor cannot make a password link for this family; a family without an account still gets an invite', async () => {
    const t = await makeTutor()
    const other = await makeTutor()
    const claimed = await makeFamily(t, { login: true })
    await assert.rejects(() => ops.inviteFamily(prisma, other.session, claimed.family.id, false, ctx), /Choose a family/)
    const fresh = await makeFamily(t)
    const r = await ops.inviteFamily(prisma, t.session, fresh.family.id, false, ctx) as any
    assert.equal(r.kind, 'invite')
    assert.match(r.url, /\/account\/claim\?f=/)
  })
})
