import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const source = join(root, '..', 'node_modules', 'wasm-vips', 'lib')
const destination = join(root, '..', 'public', 'wasm-vips')
const files = ['vips-es6.js', 'vips.wasm', 'vips-heif.wasm', 'vips-jxl.wasm']

await mkdir(destination, { recursive: true })
await Promise.all(files.map(file => cp(join(source, file), join(destination, file))))
