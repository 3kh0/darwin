import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import Vips from 'wasm-vips'
import { effects } from '../../app/utils/effects'
import { processEffect } from '../../app/utils/esmbotProcessor'
import type { EffectRuntime } from '../../app/utils/templateEffects'

let vips: Awaited<ReturnType<typeof Vips>>
let input: Uint8Array
const runtime: EffectRuntime = {
  asset: path => readFileSync(new URL(`../../public/esmbot/${path}`, import.meta.url)),
  text: ({ width, size, padding = 0, background }) => {
    const height = Math.max(1, Math.ceil(size * 1.2 + padding * 2))
    const data = new Uint8ClampedArray(Math.ceil(width) * height * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = background ? 255 : 0
      data[i + 3] = background ? 255 : 0
    }
    return { data, width: Math.ceil(width), height }
  },
}

beforeAll(async () => {
  vips = await Vips({ dynamicLibraries: [] })
  const image = vips.Image.black(8, 6, { bands: 3 }).add([40, 100, 180])
  input = image.writeToBuffer('.png')
  image.delete()
})

afterAll(() => vips.shutdown())

describe('browser esmBot processor', () => {
  for (const effect of effects) {
    it(`processes ${effect.id}`, () => {
      const result = processEffect(vips, input, effect.id, effect.defaults ?? {}, 'image/png', runtime)
      expect(result.data.byteLength).toBeGreaterThan(20)
      expect(result.mimeType).toMatch(/^image\//)
    })
  }

  it('rejects unknown effects', () => {
    expect(() => processEffect(vips, input, 'unknown', {}, 'image/png')).toThrow('Unsupported effect')
  })
})
