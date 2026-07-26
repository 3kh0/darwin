interface WorkerSuccess {
  id: number
  data: Uint8Array
  mimeType: string
  extension: string
}

interface WorkerFailure {
  id: number
  error: string
}

type WorkerResponse = WorkerSuccess | WorkerFailure

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, {
  resolve: (result: WorkerSuccess) => void
  reject: (error: Error) => void
}>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('../workers/esmbot.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const job = pending.get(data.id)
    if (!job) return
    pending.delete(data.id)
    if ('error' in data) job.reject(new Error(data.error))
    else job.resolve(data)
  }
  worker.onerror = (event) => {
    const error = new Error(event.message || 'The WebAssembly worker crashed.')
    for (const job of pending.values()) job.reject(error)
    pending.clear()
  }
  return worker
}

export async function processImageLocally(
  file: File,
  effect: string,
  params: Record<string, string | number | boolean>,
) {
  const id = ++nextId
  const input = await file.arrayBuffer()
  const result = new Promise<WorkerSuccess>((resolve, reject) => pending.set(id, { resolve, reject }))
  getWorker().postMessage({ id, effect, input, mimeType: file.type, params: { ...params } }, [input])
  return result
}
