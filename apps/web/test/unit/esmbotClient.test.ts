import { describe, it, expect } from 'vitest'
import { generateJobId } from '../../server/utils/esmbotClient'

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)

describe('generateJobId', () => {
  it('returns a bigint', () => {
    expect(typeof generateJobId()).toBe('bigint')
  })

  it('returns a positive value', () => {
    expect(generateJobId()).toBeGreaterThan(0n)
  })

  it('stays within safe JS integer range (< 2^53)', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateJobId()).toBeLessThanOrEqual(MAX_SAFE)
    }
  })

  it('produces distinct IDs across many calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateJobId()))
    // Allow for a tiny theoretical collision chance
    expect(ids.size).toBeGreaterThan(190)
  })
})
