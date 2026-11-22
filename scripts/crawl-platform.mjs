#!/usr/bin/env node
/**
 * Read-only browser crawl. Do not run until the lead confirms live is merged/seeded.
 * BASE_URL=https://… node scripts/crawl-platform.mjs
 * Requires Playwright + Chromium installed outside this script. If not installed
 * in this repo, set PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs.
 * Credentials: ~/.config/openfront/tutor-seed-logins.env (never printed).
 * Only sign-in can POST. After sign-in, all writes and external requests are
 * blocked. Navigation may still invoke the application's existing on-read jobs.
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'

const rawBase = process.env.BASE_URL
if (!rawBase) throw new Error('Set BASE_URL; live must be merged and seeded before running this script.')
const base = new URL(rawBase)
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('BASE_URL must be an HTTP(S) origin without credentials, path or query.')
}
const credentials = parseEnv(await readFile(join(homedir(), '.config/openfront/tutor-seed-logins.env'), 'utf8'))
const email = credentials.SEED_TUTOR_EMAIL
const password = credentials.SEED_TUTOR_PASSWORD
if (!email || !password) throw new Error('Seed login file must contain SEED_TUTOR_EMAIL and SEED_TUTOR_PASSWORD.')
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true })
let failures = 0
let checked = 0
let login = true
let issues = []
const clean = (s) => String(s).replaceAll(email, '[email]').replaceAll(password, '[password]').replace(/([?&](?:token|t|password)=)[^&\s]+/gi, '$1[redacted]').slice(0, 500)
const targets = new Set([
  '/dashboard', '/dashboard/platform/today', '/dashboard/platform/calendar',
  '/dashboard/platform/calendar/series', '/dashboard/platform/families',
  '/dashboard/platform/homework', '/dashboard/platform/resources',
  '/dashboard/platform/billing', '/dashboard/platform/billing/payments',
  '/dashboard/platform/earnings', '/dashboard/platform/inquiries', '/dashboard/platform/reviews',
  '/dashboard/platform/settings', '/dashboard/platform/settings/booking',
  '/dashboard/platform/settings/hours', '/dashboard/platform/settings/services',
  '/dashboard/platform/settings/packages', '/dashboard/platform/settings/payments',
  '/dashboard/platform/settings/messages',
])
const visited = new Set()
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, serviceWorkers: 'block' })
  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (!['http:', 'https:'].includes(url.protocol)) return route.continue()
    // Do not follow links or send credentials/data to any other origin.
    if (url.origin !== base.origin) return route.abort()
    if (['GET', 'HEAD'].includes(req.method())) return route.continue()
    if (login && req.method() === 'POST' && ['/dashboard/signin', '/api/graphql'].includes(url.pathname)) return route.continue()
    // The crawl never submits forms, server actions, GraphQL mutations or jobs.
    issues.push(`Blocked write: ${req.method()} ${url.pathname}`)
    return route.abort()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  page.on('dialog', (dialog) => dialog.dismiss())
  page.on('pageerror', (error) => issues.push(`pageerror: ${clean(error.message)}`))
  page.on('console', (msg) => { if (msg.type() === 'error') issues.push(`console: ${clean(msg.text())}`) })
  page.on('response', (res) => {
    if (new URL(res.url()).origin === base.origin && res.status() >= 400) issues.push(`HTTP ${res.status()}: ${clean(new URL(res.url()).pathname)}`)
  })
  const settle = async () => {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
  await page.goto(`${base.origin}/dashboard/signin`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await Promise.all([
    page.waitForURL((url) => url.origin === base.origin && !url.pathname.includes('/signin')),
    page.locator('button[type="submit"]').click(),
  ])
  await settle()
  login = false
  if (issues.length) {
    failures++
    console.log(`FAIL sign-in: ${[...new Set(issues)].join('; ')}`)
  }
  console.log('Signed in; write requests are now blocked.')

  const collectLinks = async () => {
    const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((link) => link.href))
    // Static platform pages plus every linked family/student/session/invoice/payment.
    // Never enqueue claim/reset/calendar feeds, jobs, downloads or action URLs.
    for (const href of hrefs) {
      const url = new URL(href)
      if (url.origin !== base.origin || url.search || url.hash) continue
      if (/^\/dashboard\/platform\/(families|students|sessions)\/[^/]+$/.test(url.pathname)
        || /^\/dashboard\/platform\/billing\/(invoices|payments)\/[^/]+$/.test(url.pathname)) targets.add(url.pathname)
    }
  }
  await collectLinks()
  for (const path of targets) {
    if (visited.has(path)) continue
    visited.add(path)
    issues = []
    try {
      // Click an actual navigation link when present; otherwise load the known page.
      const link = page.locator(`a[href="${path}"]`).first()
      if (await link.isVisible()) {
        await Promise.all([page.waitForURL((url) => url.pathname === path || (path === '/dashboard' && url.pathname === '/dashboard/platform/today')), link.click()])
      } else {
        await page.goto(base.origin + path, { waitUntil: 'domcontentloaded' })
      }
      await settle()
      if (new URL(page.url()).pathname.includes('/signin')) throw new Error('Redirected to sign-in')
      const body = await page.locator('body').innerText()
      const errorText = body.match(/Application error|Unhandled Runtime Error|Internal Server Error|Something went wrong|This page could not be found|Unable to complete the request/i)
      if (errorText) issues.push(`Page text: ${errorText[0]}`)
      await collectLinks()
    } catch (error) {
      issues.push(clean(error.message))
    }
    checked++
    if (issues.length) failures++
    console.log(`${issues.length ? 'FAIL' : 'PASS'} ${path}`)
    for (const issue of new Set(issues)) console.log(`  ${issue}`)
  }
  console.log(`Crawl: ${checked} pages, ${failures} failures. No action forms submitted.`)
} finally {
  await browser.close()
}
process.exitCode = failures ? 1 : 0
