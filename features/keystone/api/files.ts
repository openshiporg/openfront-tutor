import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { PrismaClient } from '@prisma/client'

import { keystoneContext } from '../context'
import { fileStorage, uploadDir } from '../lib/storage'
import { guarded } from '../utils/business'
import { sessionFor } from './request-session'

const notFound = () => new Response('Not found', { status: 404 })

/**
 * Homework and resource files, only to the tutor who owns them and the
 * families they are shared with. Local storage streams from disk; S3 storage
 * redirects to the signed URL Keystone makes.
 */
export async function serveFile(request: Request, kind: string, id: string) {
  const session = await sessionFor(request).catch(() => undefined)
  if (!session?.itemId) return notFound()
  const db = guarded(keystoneContext.prisma as PrismaClient)
  const userId = session.itemId
  let filename: string | null = null
  if (kind === 'resource') {
    const r = await db.resource.findFirst({ where: { id, OR: [{ profile: { ownerId: userId } }, { profile: { families: { some: { userId } } }, OR: [{ students: { none: {} } }, { students: { some: { family: { userId } } } }] }] }, select: { file_filename: true } })
    filename = r?.file_filename ?? null
  } else if (kind === 'homework') {
    const h = await db.homework.findFirst({ where: { id, OR: [{ profile: { ownerId: userId } }, { student: { family: { userId } } }] }, select: { file_filename: true } })
    filename = h?.file_filename ?? null
  }
  if (!filename || filename.includes('/') || filename.includes('..')) return notFound()
  const storage = fileStorage()
  if (storage.kind === 's3') {
    const ctx = keystoneContext.sudo()
    const url = await ctx.files('tutor_files').getUrl(filename)
    return Response.redirect(url, 302)
  }
  const file = path.join(uploadDir(), filename)
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return notFound()
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { 'content-length': String(info.size), 'content-disposition': `attachment; filename="${filename.replace(/^[^-]+-/, '')}"`, 'cache-control': 'private, no-store', 'content-type': 'application/octet-stream' } })
}
