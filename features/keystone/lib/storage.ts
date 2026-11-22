import path from 'node:path'

import type { StorageConfig } from '@keystone-6/core/types'

/**
 * Homework and resource files. S3-compatible storage when its bucket is set,
 * otherwise files on the server's disk. Either way a file is read only through
 * `/api/files/<homework|resource>/<id>`, which checks who is asking. Links
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
    // Not a public path: the guarded route above serves the bytes.
    generateUrl: (file) => `/api/files/stored${file}`,
    serverRoute: null,
  }
}

export function uploadDir(env: NodeJS.ProcessEnv = process.env) {
  return path.resolve(env.UPLOAD_DIR || '.uploads/files')
}
