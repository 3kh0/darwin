/// <reference lib="webworker" />

import Vips from 'wasm-vips'
import { processEffect, type EffectParams } from '~/utils/esmbotProcessor'
import { templateAssets, type EffectRuntime, type TextRasterOptions } from '~/utils/templateEffects'

interface ProcessRequest {
  id: number
  effect: string
  input: ArrayBuffer
  mimeType: string
  params: EffectParams
}

const moduleUrl = '/wasm-vips/'
const vipsPromise = Vips({
  locateFile: file => `${moduleUrl}${file}`,
  mainScriptUrlOrBlob: `${moduleUrl}vips-es6.js`,
  printErr: message => console.warn(`[wasm-vips] ${message}`),
}).then((vips) => {
  vips.Cache.max(0)
  vips.blockUntrusted(true)
  return vips
})

const root = '/esmbot/'
const assets = new Map<string, Uint8Array>()
const fontFiles: Record<string, string> = {
  Futura: 'caption.otf', Helvetica: 'caption2.ttf', Roboto: 'reddit.ttf', Ubuntu: 'Ubuntu.ttf',
  Circular: 'Circular.ttf', Upright: 'whisper.otf', Impact: 'caption.otf', 'Times New Roman': 'Ubuntu.ttf',
}
const fontsPromise = Promise.all(Object.entries(fontFiles).map(async ([family, file]) => {
  const font = new FontFace(family, `url(${root}fonts/${file})`)
  await font.load()
  ;(self as typeof self & { fonts: FontFaceSet }).fonts.add(font)
}))

async function loadAssets(paths: string[]) {
  await Promise.all(paths.map(async (path) => {
    if (assets.has(path)) return
    const response = await fetch(`${root}${path}`)
    if (!response.ok) throw new Error(`Missing esmBot asset: ${path}`)
    assets.set(path, new Uint8Array(await response.arrayBuffer()))
  }))
}

function renderText({
  text, width, size, family = 'Helvetica', weight = '400', color = '#111', background,
  align = 'left', padding = 0, stroke, strokeWidth = 0,
}: TextRasterOptions) {
  const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(width)), 1)
  let context = canvas.getContext('2d')!
  const font = `${weight} ${Math.max(10, size)}px "${family}"`
  context.font = font
  const limit = Math.max(1, width - padding * 2)
  const lines: string[] = []
  for (const paragraph of (text || ' ').split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (line && context.measureText(next).width > limit) { lines.push(line); line = word }
      else line = next
    }
    lines.push(line || ' ')
  }
  const lineHeight = size * 1.15
  canvas.height = Math.max(1, Math.ceil(lines.length * lineHeight + padding * 2 + strokeWidth * 2))
  context = canvas.getContext('2d')!
  context.font = font
  context.textAlign = align
  context.textBaseline = 'middle'
  context.lineJoin = 'round'
  if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height) }
  lines.forEach((line, index) => {
    const x = align === 'center' ? canvas.width / 2 : padding
    const y = padding + strokeWidth + lineHeight * (index + 0.5)
    if (stroke && strokeWidth) { context.strokeStyle = stroke; context.lineWidth = strokeWidth * 2; context.strokeText(line, x, y, limit) }
    context.fillStyle = color
    context.fillText(line, x, y, limit)
  })
  return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height }
}

const runtime: EffectRuntime = {
  asset(path) {
    const data = assets.get(path)
    if (!data) throw new Error(`esmBot asset was not loaded: ${path}`)
    return data
  },
  text: renderText,
}

self.onmessage = async ({ data: request }: MessageEvent<ProcessRequest>) => {
  try {
    const paths = templateAssets(request.effect, request.params)
    const [vips] = await Promise.all([vipsPromise, fontsPromise, loadAssets(paths)])
    const result = processEffect(
      vips, new Uint8Array(request.input), request.effect, request.params, request.mimeType, runtime,
    )
    self.postMessage({ id: request.id, ...result }, { transfer: [result.data.buffer] })
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export {}
