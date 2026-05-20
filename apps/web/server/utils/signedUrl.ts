import { createHmac, timingSafeEqual } from 'node:crypto'

function getSecret(): string {
  const config = useRuntimeConfig()
  return config.mediaSecret || 'dev-media-secret'
}

export function signMediaToken(fileId: string, ttlMs = 5 * 60 * 1000): string {
  const expiresAt = Date.now() + ttlMs
  const payload = `${fileId}:${expiresAt}`
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('hex')
  return `${expiresAt}.${hmac}`
}

export function verifyMediaToken(fileId: string, token: string): boolean {
  const dot = token.indexOf('.')
  if (dot === -1) return false
  const expiresAt = parseInt(token.slice(0, dot), 10)
  const provided = token.slice(dot + 1)

  if (isNaN(expiresAt) || Date.now() > expiresAt) return false

  const payload = `${fileId}:${expiresAt}`
  const expected = createHmac('sha256', getSecret()).update(payload).digest('hex')

  try {
    const a = Buffer.from(provided, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function buildMediaUrl(fileId: string, ttlMs?: number): string {
  const config = useRuntimeConfig()
  const base = (config.appPublicUrl || 'http://localhost:3000').replace(/\/$/, '')
  const token = signMediaToken(fileId, ttlMs)
  return `${base}/__media/${fileId}?token=${encodeURIComponent(token)}`
}
