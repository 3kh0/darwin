import { mkdir, writeFile, readFile, unlink, readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'

const MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

function mediaDir(): string {
  return join(process.cwd(), '.data', 'media')
}

async function ensureDir() {
  await mkdir(mediaDir(), { recursive: true })
}

export async function storeTempFile(data: Buffer, mimeType: string): Promise<string> {
  await ensureDir()

  const ext = mimeToExt(mimeType)
  const id = `${randomUUID()}${ext ? `.${ext}` : ''}`
  const path = join(mediaDir(), id)
  await writeFile(path, data)
  return id
}

export async function readTempFile(fileId: string): Promise<{ data: Buffer; mimeType: string } | null> {
  if (fileId.includes('/') || fileId.includes('..') || fileId.includes('\0')) return null

  const path = join(mediaDir(), fileId)
  try {
    const data = await readFile(path)
    const ext = extname(fileId).slice(1).toLowerCase()
    return { data, mimeType: extToMime(ext) }
  } catch {
    return null
  }
}

export async function deleteTempFile(fileId: string): Promise<void> {
  if (fileId.includes('/') || fileId.includes('..')) return
  const path = join(mediaDir(), fileId)
  try { await unlink(path) } catch {}
}

export async function cleanOldTempFiles(): Promise<void> {
  try {
    const dir = mediaDir()
    const files = await readdir(dir)
    const now = Date.now()
    await Promise.all(
      files.map(async (file) => {
        const path = join(dir, file)
        try {
          const s = await stat(path)
          if (now - s.mtimeMs > MAX_AGE_MS) {
            await unlink(path)
          }
        } catch {}
      }),
    )
  } catch {}
}

let cleanupStarted = false
export function startCleanupTimer() {
  if (cleanupStarted) return
  cleanupStarted = true
  setInterval(cleanOldTempFiles, 60_000)
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
  }
  return map[mime] ?? ''
}

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
  }
  return map[ext] ?? 'application/octet-stream'
}
