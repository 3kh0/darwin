/**
 * Optional API key authentication.
 * Set API_KEYS=key1,key2 in environment to enforce bearer token auth.
 * If API_KEYS is empty or unset, all requests are allowed (dev mode).
 */

import type { H3Event } from 'h3'

function getKeys(): string[] {
  const config = useRuntimeConfig()
  const raw = config.apiKeys || ''
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

export function requireApiKey(event: H3Event): void {
  const keys = getKeys()
  if (keys.length === 0) return

  const auth = getRequestHeader(event, 'authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''

  if (!keys.includes(token)) {
    throw createError({ statusCode: 401 })
  }
}
