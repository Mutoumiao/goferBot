import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { StorageService } from '../../../packages/server/src/processors/storage/storage.service.js'

const VECTOR_DIMENSION = 1536

export interface UploadedDocWithChunk {
  docId: string
  chunkId: string
  storageKey: string
}

export async function uploadDocumentWithChunk(
  app: NestFastifyApplication,
  kbId: string,
  token: string,
  filename: string,
  content: string,
  folderId?: string,
): Promise<UploadedDocWithChunk> {
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
  const parts: Buffer[] = []

  const filePart = buildMultipartBody(
    boundary,
    'file',
    filename,
    'text/plain',
    Buffer.from(content),
  )
  parts.push(filePart)

  if (folderId) {
    const folderField = Buffer.from(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="folderId"\r\n\r\n' +
        `${folderId}\r\n`,
    )
    parts.push(folderField)
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`))
  const multipartBody = Buffer.concat(parts)

  const uploadRes = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kbId}/documents/upload`,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      authorization: `Bearer ${token}`,
    },
    payload: multipartBody,
  })

  if (uploadRes.statusCode !== 201) {
    throw new Error(`uploadDocumentWithChunk failed: ${uploadRes.statusCode} ${uploadRes.body}`)
  }

  const { id: docId, storageKey } = uploadRes.json().data
  const prisma = app.get(PrismaService)
  const chunkId = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO chunks (id, document_id, kb_id, content, chunk_index, embedding)
    VALUES (
      ${chunkId}::uuid,
      ${docId}::uuid,
      ${kbId}::uuid,
      ${content},
      ${0},
      ${new Array(VECTOR_DIMENSION).fill(0.1)}::vector
    )
  `

  return { docId, chunkId, storageKey }
}

export async function hasEmbedding(prisma: PrismaService, chunkId: string): Promise<boolean> {
  const result = await prisma.$queryRaw`
    SELECT embedding IS NOT NULL as has_embedding
    FROM chunks
    WHERE id = ${chunkId}
  `
  return (result as Array<{ has_embedding: boolean }>)[0]?.has_embedding ?? false
}

export async function canDownloadStorage(
  app: NestFastifyApplication,
  key: string,
): Promise<boolean> {
  const storage = app.get(StorageService)
  try {
    await storage.downloadFile(key)
    return true
  } catch {
    return false
  }
}

function buildMultipartBody(
  boundary: string,
  fieldName: string,
  filename: string,
  contentType: string,
  buffer: Buffer,
): Buffer {
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  )
  const suffix = Buffer.from(`\r\n`)
  return Buffer.concat([prefix, buffer, suffix])
}
