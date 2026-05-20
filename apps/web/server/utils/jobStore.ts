export type JobStatus = 'queued' | 'processing' | 'done' | 'error'

export interface JobEntry {
  id: string
  effect: string
  status: JobStatus
  output?: Buffer
  contentType?: string
  error?: string
  createdAt: number
}

const store = new Map<string, JobEntry>()
const JOB_TTL_MS = 15 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [id, job] of store) {
    if (now - job.createdAt > JOB_TTL_MS) store.delete(id)
  }
}, 60_000)

export function createJob(id: string, effect: string): JobEntry {
  const entry: JobEntry = { id, effect, status: 'queued', createdAt: Date.now() }
  store.set(id, entry)
  return entry
}

export function getJob(id: string): JobEntry | undefined {
  return store.get(id)
}

export function updateJob(id: string, patch: Partial<JobEntry>): void {
  const job = store.get(id)
  if (job) store.set(id, { ...job, ...patch })
}
