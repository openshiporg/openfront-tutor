#!/usr/bin/env node
/**
 * `npm test`: the §9 tests against a real Postgres. They write rows, so they
 * run only on a database whose name ends in `_test`:
 *   TEST_DATABASE_URL=postgres://…/openfront_tutor_test npm test
 * Migrations are applied first. Unit tests (tests/*.test.cjs) need no database.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
const name = url.split('/').pop()?.split('?')[0] || ''
const unit = readdirSync('tests').filter((f) => f.endsWith('.test.cjs')).map((f) => `tests/${f}`)
const db = readdirSync('tests/tutor').filter((f) => f.endsWith('.test.ts')).map((f) => `tests/tutor/${f}`)

if (!name.endsWith('_test')) {
  console.error('Set TEST_DATABASE_URL to a Postgres database whose name ends in _test. The tests write rows, so they never run on another database.')
  process.exit(1)
}
// The scratch server is shared by many repos: keep this run to a few connections.
const pooled = /[?&]connection_limit=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}connection_limit=4&pool_timeout=60`
const env = { ...process.env, DATABASE_URL: pooled, NODE_ENV: 'test' }
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', env }).status ?? 1

if (spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env: { ...env, DATABASE_URL: url } }).status !== 0) process.exit(1)
process.exit(run(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...unit, ...db]))
