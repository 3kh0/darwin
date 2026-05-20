import { describe, it, expect } from 'vitest'
import { createJob, getJob, updateJob } from '../../server/utils/jobStore'

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

describe('jobStore', () => {
  it('creates a job with queued status and correct fields', () => {
    const id = uid()
    const job = createJob(id, 'blur')
    expect(job.id).toBe(id)
    expect(job.effect).toBe('blur')
    expect(job.status).toBe('queued')
    expect(typeof job.createdAt).toBe('number')
    expect(job.createdAt).toBeLessThanOrEqual(Date.now())
  })

  it('retrieves a created job by id', () => {
    const id = uid()
    createJob(id, 'caption')
    const job = getJob(id)
    expect(job).toBeDefined()
    expect(job?.id).toBe(id)
    expect(job?.effect).toBe('caption')
    expect(job?.status).toBe('queued')
  })

  it('returns undefined for an unknown id', () => {
    expect(getJob('no-such-job-xxxxxxxxxxx')).toBeUndefined()
  })

  it('updates job status to processing', () => {
    const id = uid()
    createJob(id, 'flip')
    updateJob(id, { status: 'processing' })
    expect(getJob(id)?.status).toBe('processing')
  })

  it('updates job to done with binary output and contentType', () => {
    const id = uid()
    createJob(id, 'blur')
    const output = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    updateJob(id, { status: 'done', output, contentType: 'image/png' })
    const job = getJob(id)
    expect(job?.status).toBe('done')
    expect(job?.output?.equals(output)).toBe(true)
    expect(job?.contentType).toBe('image/png')
  })

  it('updates job to error with message', () => {
    const id = uid()
    createJob(id, 'caption')
    updateJob(id, { status: 'error', error: 'esmbot unreachable' })
    const job = getJob(id)
    expect(job?.status).toBe('error')
    expect(job?.error).toBe('esmbot unreachable')
  })

  it('silently ignores updateJob for a nonexistent id', () => {
    expect(() => updateJob('ghost-id-xxxxxxxx', { status: 'done' })).not.toThrow()
  })

  it('preserves untouched fields during partial update', () => {
    const id = uid()
    createJob(id, 'mirror')
    updateJob(id, { status: 'processing' })
    updateJob(id, { status: 'done', contentType: 'image/gif' })
    const job = getJob(id)
    expect(job?.effect).toBe('mirror')
    expect(job?.status).toBe('done')
    expect(job?.contentType).toBe('image/gif')
  })
})
