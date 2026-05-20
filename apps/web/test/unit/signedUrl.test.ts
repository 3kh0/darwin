// @vitest-environment nuxt
// useRuntimeConfig requires a Nuxt app instance, so run in the nuxt environment.
// In tests it reads defaults from nuxt.config.ts (mediaSecret, appPublicUrl).
import { describe, it, expect } from 'vitest'
import { signMediaToken, verifyMediaToken, buildMediaUrl } from '../../server/utils/signedUrl'

describe('signMediaToken', () => {
  it('returns an <expiresAt>.<64-char-hex-hmac> string', () => {
    const token = signMediaToken('abc.png')
    const [ts, hmac] = token.split('.')
    expect(Number(ts)).toBeGreaterThan(Date.now() - 1000)
    expect(hmac).toMatch(/^[0-9a-f]{64}$/)
  })

  it('sets expiry roughly at now + TTL', () => {
    const before = Date.now()
    const token = signMediaToken('x.png', 60_000)
    const expiresAt = parseInt(token.split('.')[0])
    expect(expiresAt).toBeGreaterThanOrEqual(before + 59_000)
    expect(expiresAt).toBeLessThanOrEqual(before + 61_000)
  })

  it('produces different tokens for different file IDs', () => {
    expect(signMediaToken('a.png')).not.toBe(signMediaToken('b.png'))
  })
})

describe('verifyMediaToken', () => {
  it('accepts a freshly-signed token for the correct file ID', () => {
    const token = signMediaToken('img.png')
    expect(verifyMediaToken('img.png', token)).toBe(true)
  })

  it('rejects a token signed for a different file ID', () => {
    const token = signMediaToken('img.png')
    expect(verifyMediaToken('other.png', token)).toBe(false)
  })

  it('rejects an already-expired token', () => {
    const token = signMediaToken('img.png', -1000)
    expect(verifyMediaToken('img.png', token)).toBe(false)
  })

  it('rejects a token with no dot separator', () => {
    expect(verifyMediaToken('img.png', 'nodot')).toBe(false)
  })

  it('rejects a token with a non-numeric expiry field', () => {
    expect(verifyMediaToken('img.png', 'notanumber.deadbeef')).toBe(false)
  })

  it('rejects a token with a tampered HMAC', () => {
    const token = signMediaToken('img.png')
    const tampered = token.slice(0, -8) + '00000000'
    expect(verifyMediaToken('img.png', tampered)).toBe(false)
  })

  it('rejects a token whose HMAC has wrong length', () => {
    const [ts] = signMediaToken('img.png').split('.')
    expect(verifyMediaToken('img.png', `${ts}.abc`)).toBe(false)
  })
})

describe('buildMediaUrl', () => {
  it('includes the file ID in the path', () => {
    expect(buildMediaUrl('photo.png')).toContain('/__media/photo.png')
  })

  it('includes a URL-encoded token query parameter', () => {
    expect(buildMediaUrl('photo.png')).toContain('?token=')
  })

  it('uses the configured appPublicUrl as the base', () => {
    expect(buildMediaUrl('photo.png').startsWith('http://localhost:3000')).toBe(true)
  })

  it('produces a URL whose token passes verifyMediaToken', () => {
    const fileId = 'round-trip.jpg'
    const url = buildMediaUrl(fileId)
    const tokenParam = new URL(url).searchParams.get('token')!
    expect(verifyMediaToken(fileId, tokenParam)).toBe(true)
  })
})
