import type Vips from 'wasm-vips'
import { processTemplateEffect, type EffectRuntime } from './templateEffects'

export type EffectParams = Record<string, string | number | boolean>

export interface ProcessedImage {
  data: Uint8Array
  mimeType: string
  extension: string
}

function numberParam(params: EffectParams, name: string, fallback: number) {
  const value = Number(params[name] ?? fallback)
  if (!Number.isFinite(value)) throw new Error(`“${name}” must be a number.`)
  return value
}

function outputFormat(mimeType: string) {
  if (mimeType === 'image/gif') return { extension: '.gif', mimeType }
  if (mimeType === 'image/webp') return { extension: '.webp', mimeType }
  if (mimeType === 'image/jpeg') return { extension: '.jpg', mimeType }
  return { extension: '.png', mimeType: 'image/png' }
}

export function processEffect(
  vips: typeof Vips,
  input: Uint8Array,
  effect: string,
  params: EffectParams,
  mimeType: string,
  runtime?: EffectRuntime,
): ProcessedImage {
  const images: Vips.Image[] = []
  const keep = (image: Vips.Image) => {
    images.push(image)
    return image
  }

  try {
    const source = keep(vips.Image.newFromBuffer(input, '', { access: 'sequential', fail_on: 'error' }))
    let output: Vips.Image
    let format = outputFormat(mimeType)

    const template = processTemplateEffect(vips, source, effect, params, runtime, keep)
    if (template) output = template
    else switch (effect) {
      case 'blur':
        output = keep(source.gaussblur(5))
        break
      case 'sharpen':
        output = keep(source.sharpen({ sigma: 3 }))
        break
      case 'flip':
        output = keep(source.flipVer())
        break
      case 'flop':
        output = keep(source.flipHor())
        break
      case 'invert': {
        const alpha = source.hasAlpha() ? keep(source.extractBand(source.bands - 1)) : null
        const colors = source.hasAlpha() ? keep(source.extractBand(0, { n: source.bands - 1 })) : source
        const inverted = keep(colors.invert())
        output = alpha ? keep(inverted.bandjoin(alpha)) : inverted
        break
      }
      case 'grayscale':
        output = keep(source.colourspace('b-w'))
        break
      case 'sepia': {
        const rgb = keep(source.colourspace('srgb').extractBand(0, { n: 3 }))
        const matrix = keep(vips.Image.newMatrix(3, 3, [
          0.3588, 0.7044, 0.1368,
          0.2990, 0.5870, 0.1140,
          0.2392, 0.4696, 0.0912,
        ]))
        const sepia = keep(rgb.recomb(matrix))
        const alpha = source.hasAlpha() ? keep(source.extractBand(source.bands - 1)) : null
        output = alpha ? keep(sepia.bandjoin(alpha)) : sepia
        break
      }
      case 'hue': {
        const srgb = keep(source.colourspace('srgb'))
        const alpha = srgb.hasAlpha() ? keep(srgb.extractBand(srgb.bands - 1)) : null
        const rgb = alpha ? keep(srgb.extractBand(0, { n: srgb.bands - 1 })) : srgb
        const lch = keep(rgb.colourspace('lch'))
        const shiftedLch = keep(lch.add([0, 0, numberParam(params, 'shift', 90)]))
        const shifted = keep(shiftedLch.colourspace('srgb'))
        output = alpha ? keep(shifted.bandjoin(alpha)) : shifted
        break
      }
      case 'deepfry': {
        const contrasted = keep(source.multiply(1.3))
        const darkened = keep(contrasted.subtract(76.5))
        const fried = keep(darkened.multiply(1.5))
        const jpeg = fried.writeToBuffer('.jpg', { Q: 1, strip: true })
        output = keep(vips.Image.newFromBuffer(jpeg))
        break
      }
      case 'jpeg':
        format = { extension: '.jpg', mimeType: 'image/jpeg' }
        output = source
        break
      case 'pixelate': {
        const tiny = keep(source.resize(0.1))
        output = keep(tiny.resize(10, { kernel: 'nearest' }))
        break
      }
      case 'stretch':
        output = keep(source.resize(512 / source.width, { vscale: 512 / source.height }))
        break
      case 'wide':
        output = keep(source.resize(Math.max(0.1, numberParam(params, 'amount', 2)), { vscale: 1 }))
        break
      case 'rotate':
        output = keep(source.rotate(numberParam(params, 'angle', 90)))
        break
      case 'crop': {
        const size = Math.min(source.width, source.height)
        output = keep(source.smartcrop(size, size, { interesting: 'centre' }))
        break
      }
      case 'tile': {
        const tiled = keep(source.replicate(5, 5))
        const scale = Math.min(1, 800 / tiled.width, 800 / tiled.height)
        output = scale < 1 ? keep(tiled.resize(scale)) : tiled
        break
      }
      default: throw new Error(`Unsupported effect: ${effect}`)
    }

    const options = effect === 'jpeg'
      ? { Q: Math.max(1, Math.min(100, numberParam(params, 'quality', 8))), strip: true }
      : format.extension === '.gif' ? { reoptimise: true } : {}
    const data = output.writeToBuffer(format.extension, options)
    return { data, mimeType: format.mimeType, extension: format.extension.slice(1) }
  } finally {
    for (const image of images.reverse()) {
      if (!image.isDeleted()) image.delete()
    }
  }
}
