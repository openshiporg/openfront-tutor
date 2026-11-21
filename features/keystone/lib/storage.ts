import path from 'node:path'

import type { StorageConfig } from '@keystone-6/core/types'

/**
 * Homework and resource files. S3-compatible storage when its bucket is set,
 * otherwise files on the server's disk served by `/api/files/[name]`. Links
 * (linkUrl) always work, with or without file storage.
 */
export function fileStorage(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  if (env.S3_BUCKET_NAME) {
    return {
      kind: 's3',
      type: 'file',
      bucketName: env.S3_BUCKET_NAME,
      region: env.S3_REGION || 'us-east-1',
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: true,
      signed: { expiry: 3600 },
    }
  }
  return {
    kind: 'local',
    type: 'file',
    storagePath: uploadDir(env),
    generateUrl: (file) => `/api/files${file}`,
    serverRoute: null,
  }
}

export function uploadDir(env: NodeJS.ProcessEnv = process.env) {
  return path.resolve(env.UPLOAD_DIR || '.uploads/files')
}
