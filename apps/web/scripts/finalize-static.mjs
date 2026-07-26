import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(appRoot, '.output', 'public')

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  }))
  return nested.flat()
}

const files = (await walk(output))
  .filter(path => !path.endsWith(`${sep}sw.js`) && !path.endsWith(`${sep}_headers`))
  .sort()
const assets = ['/', ...files.map(path => `/${relative(output, path).split(sep).join('/')}`)]
const hash = createHash('sha256')
for (const file of files) hash.update(await readFile(file))

const serviceWorkerPath = join(output, 'sw.js')
let serviceWorker = await readFile(serviceWorkerPath, 'utf8')
serviceWorker = serviceWorker
  .replace("darwin-wasm-dev", `darwin-${hash.digest('hex').slice(0, 12)}`)
  .replace(/\/\* __PRECACHE__ \*\/ \[[\s\S]*?\n\]/, `/* __PRECACHE__ */ ${JSON.stringify(assets, null, 2)}`)
await writeFile(serviceWorkerPath, serviceWorker)
