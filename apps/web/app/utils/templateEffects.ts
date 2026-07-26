import type Vips from 'wasm-vips'
import type { EffectParams } from './esmbotProcessor'

export interface TextRasterOptions {
  text: string
  width: number
  size: number
  family?: string
  weight?: string
  color?: string
  background?: string
  align?: 'left' | 'center'
  padding?: number
  stroke?: string
  strokeWidth?: number
}

export interface EffectRuntime {
  asset(path: string): Uint8Array
  text(options: TextRasterOptions): { data: Uint8ClampedArray; width: number; height: number }
}

type Keep = (image: Vips.Image) => Vips.Image

const p = (params: EffectParams, name: string, fallback = '') => String(params[name] ?? fallback)

const watermarks: Record<string, { file: string; gravity: number; resize?: boolean; append?: boolean; yscale?: number }> = {
  '9gag': { file: '9gag.png', gravity: 6 },
  avs4you: { file: 'avs4you.png', gravity: 5, resize: true },
  bandicam: { file: 'bandicam.png', gravity: 2, resize: true },
  deviantart: { file: 'deviantart.png', gravity: 5, resize: true },
  funky: { file: 'funky.png', gravity: 3, resize: true },
  hypercam: { file: 'hypercam.png', gravity: 1, resize: true },
  ifunny: { file: 'ifunny.png', gravity: 8, resize: true, append: true },
  kinemaster: { file: 'kinemaster.png', gravity: 3, resize: true },
  memecenter: { file: 'memecenter.png', gravity: 9 },
  powerdirector: { file: 'powerdirector.png', gravity: 9, resize: true },
  shutterstock: { file: 'shutterstock.png', gravity: 5, resize: true },
  speechbubble: { file: 'speechbubble.png', gravity: 2, resize: true, yscale: 0.2 },
  vignette: { file: 'vignette.png', gravity: 1, resize: true, yscale: 1 },
}

function flagFile(flag: string) {
  const special: Record<string, string> = {
    '🏴‍☠️': 'pirateflag.png', '🏳️‍🌈': 'rainbowflag.png', '🏁': 'checkeredflag.png', '🏳️‍⚧️': 'transflag.png',
  }
  if (special[flag]) return special[flag]
  const code = [...flag].map(char => (char.codePointAt(0) ?? 0) - 127397)
  return code.length === 2 && code.every(value => value >= 65 && value <= 90)
    ? `region-flags/png/${String.fromCodePoint(...code)}.png`
    : 'region-flags/png/US.png'
}

export function templateAssets(effect: string, params: EffectParams) {
  if (watermarks[effect]) return [`images/${watermarks[effect].file}`]
  if (effect === 'flag') return [`images/${flagFile(p(params, 'flag', '🇺🇸'))}`]
  if (effect === 'gamexplain') return ['images/gamexplain.png']
  if (effect === 'scott') return ['images/scott.png']
  if (effect === 'reddit') return ['images/reddit.png']
  if (effect === 'spotify') return ['images/spotify.png']
  if (effect === 'uncanny') return [`images/uncanny/${p(params, 'phase', 'normal')}.png`]
  return []
}

function textImage(vips: typeof Vips, runtime: EffectRuntime, keep: Keep, options: TextRasterOptions) {
  const raster = runtime.text(options)
  const memory = keep(vips.Image.newFromMemory(
    Uint8Array.from(raster.data), raster.width, raster.height, 4, vips.BandFormat.uchar,
  ))
  return keep(memory.copy({ interpretation: 'srgb' }))
}

function asset(vips: typeof Vips, runtime: EffectRuntime, keep: Keep, path: string) {
  const decoded = keep(vips.Image.newFromBuffer(runtime.asset(path)))
  return keep(decoded.colourspace('srgb'))
}

function rgba(image: Vips.Image, keep: Keep) {
  return image.hasAlpha() ? image : keep(image.bandjoin(255))
}

function overlay(base: Vips.Image, top: Vips.Image, keep: Keep, x = 0, y = 0) {
  return keep(base.composite2(top, 'over', { x, y }))
}

function watermark(vips: typeof Vips, source: Vips.Image, effect: string, runtime: EffectRuntime, keep: Keep) {
  const config = watermarks[effect]!
  let mark = rgba(asset(vips, runtime, keep, `images/${config.file}`), keep)
  if (config.resize) {
    const scale = config.append
      ? source.width / mark.width
      : config.yscale ? source.width / mark.width : source.height / mark.height
    mark = keep(mark.resize(scale, config.yscale ? { vscale: source.height * config.yscale / mark.height } : {}))
  }
  if (config.append) return keep(source.join(mark, 'vertical', { expand: true }))

  const col = config.gravity % 3 || 3
  const row = Math.ceil(config.gravity / 3)
  const x = col === 1 ? 0 : col === 2 ? (source.width - mark.width) / 2 : source.width - mark.width
  const y = row === 1 ? 0 : row === 2 ? (source.height - mark.height) / 2 : source.height - mark.height
  return overlay(source, mark, keep, Math.round(x), Math.round(y))
}

export function processTemplateEffect(
  vips: typeof Vips,
  source: Vips.Image,
  effect: string,
  params: EffectParams,
  runtime: EffectRuntime | undefined,
  keep: Keep,
) {
  if (!runtime) return null
  const input = rgba(keep(source.colourspace('srgb')), keep)
  const caption = p(params, 'caption')

  if (watermarks[effect]) return watermark(vips, input, effect, runtime, keep)
  if (effect === 'flag') {
    let flag = rgba(asset(vips, runtime, keep, `images/${flagFile(p(params, 'flag', '🇺🇸'))}`), keep)
    flag = keep(flag.resize(input.width / flag.width, { vscale: input.height / flag.height }))
    flag = keep(flag.multiply([1, 1, 1, 0.5]))
    return overlay(input, flag, keep)
  }
  if (effect === 'caption' || effect === 'caption2') {
    const label = textImage(vips, runtime, keep, {
      text: caption, width: input.width, size: Math.max(18, input.width / (effect === 'caption' ? 10 : 13)),
      family: effect === 'caption' ? 'Futura' : 'Helvetica', weight: effect === 'caption' ? '700' : '400',
      color: '#111', background: '#fff', align: effect === 'caption' ? 'center' : 'left', padding: input.width / 25,
    })
    const top = effect === 'caption' || params.top === true
    return keep((top ? label : input).join(top ? input : label, 'vertical', { expand: true, background: 0xffffff }))
  }
  if (effect === 'meme') {
    let out = input
    const draw = (text: string, y: 'top' | 'bottom') => {
      if (!text) return
      const label = textImage(vips, runtime, keep, {
        text: text.toUpperCase(), width: input.width, size: Math.max(24, input.width / 9), family: 'Impact',
        weight: '900', color: '#fff', align: 'center', padding: input.width / 40,
        stroke: '#000', strokeWidth: Math.max(2, input.width / 180),
      })
      out = overlay(out, label, keep, 0, y === 'top' ? 0 : input.height - label.height)
    }
    draw(p(params, 'topText'), 'top'); draw(p(params, 'bottomText'), 'bottom')
    return out
  }
  if (effect === 'motivate') {
    const border = Math.max(3, input.width / 65)
    const framed = keep(input.embed(border, border, input.width + border * 2, input.height + border * 2, { extend: 'white' }))
    const poster = keep(framed.embed(border * 2, border * 2, framed.width + border * 4, framed.height + border * 4, { extend: 'black' }))
    const label = textImage(vips, runtime, keep, {
      text: [p(params, 'topText'), p(params, 'bottomText')].filter(Boolean).join('\n'), width: poster.width,
      size: Math.max(20, input.width / 8), family: 'Times New Roman', color: '#fff', background: '#000',
      align: 'center', padding: input.width / 30,
    })
    return keep(poster.join(label, 'vertical', { expand: true, background: 0 }))
  }
  if (effect === 'snapchat' || effect === 'whisper') {
    const label = textImage(vips, runtime, keep, {
      text: caption, width: input.width, size: Math.max(18, input.width / (effect === 'whisper' ? 6 : 20)),
      family: effect === 'whisper' ? 'Upright' : 'Helvetica', color: '#fff',
      background: effect === 'snapchat' ? '#000000b2' : undefined, align: 'center', padding: input.width / 40,
      stroke: effect === 'whisper' ? '#000' : undefined, strokeWidth: effect === 'whisper' ? input.width / 100 : 0,
    })
    return overlay(input, label, keep, 0, Math.round((input.height - label.height) * (effect === 'snapchat' ? 0.565 : 0.5)))
  }
  if (effect === 'reddit' || effect === 'spotify') {
    let header = rgba(asset(vips, runtime, keep, `images/${effect}.png`), keep)
    const label = textImage(vips, runtime, keep, {
      text: effect === 'reddit' ? `Posted in r/${caption || 'memes'}` : caption,
      width: header.width, size: effect === 'reddit' ? 62 : 78,
      family: effect === 'reddit' ? 'Roboto' : 'Circular', weight: '700',
      color: effect === 'reddit' ? '#fff' : '#000', align: 'center', padding: 28,
    })
    header = overlay(header, label, keep, 0, Math.max(0, (header.height - label.height) / 2))
    header = keep(header.resize(input.width / header.width))
    return keep((effect === 'spotify' ? header : input).join(effect === 'spotify' ? input : header, 'vertical', { expand: true }))
  }
  if (effect === 'gamexplain') {
    const frame = rgba(asset(vips, runtime, keep, 'images/gamexplain.png'), keep)
    const fitted = keep(input.resize(1181 / input.width, { vscale: 571 / input.height }))
    const base = keep(fitted.embed(10, 92, 1200, 675, { extend: 'white' }))
    return overlay(base, frame, keep)
  }
  if (effect === 'scott') {
    const frame = rgba(asset(vips, runtime, keep, 'images/scott.png'), keep)
    const fitted = keep(input.resize(415 / input.width, { vscale: 234 / input.height }))
    return overlay(frame, fitted, keep, 127, 181)
  }
  if (effect === 'uncanny') {
    const black = keep(vips.Image.black(1280, 720, { bands: 3 }))
    let base = keep(black.bandjoin(255))
    base = keep(base.copy({ interpretation: 'srgb' }))
    const phase = rgba(asset(vips, runtime, keep, `images/uncanny/${p(params, 'phase', 'normal')}.png`), keep)
    base = overlay(base, phase, keep, 0, 130)
    for (const [text, x, color] of [[caption, 0, '#fff'], [p(params, 'caption2'), 640, '#f33']] as const) {
      if (!text) continue
      const label = textImage(vips, runtime, keep, { text, width: 640, size: 72, family: 'Helvetica', weight: '700', color, background: '#000', align: 'center', padding: 20 })
      base = overlay(base, label, keep, x, 0)
    }
    let fitted = keep(input.resize(690 / input.width))
    if (fitted.height > 590) fitted = keep(fitted.resize(590 / fitted.height))
    return overlay(base, fitted, keep, Math.round(935 - fitted.width / 2), Math.round(425 - fitted.height / 2))
  }
  return null
}
