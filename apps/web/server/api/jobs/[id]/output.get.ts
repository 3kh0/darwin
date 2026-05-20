export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const job = getJob(id)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'not found' })
  if (job.status === 'queued' || job.status === 'processing') {
    throw createError({ statusCode: 202, statusMessage: 'still processing' })
  }
  if (job.status === 'error') {
    throw createError({ statusCode: 500, statusMessage: job.error ?? 'failed' })
  }
  if (!job.output) throw createError({ statusCode: 404, statusMessage: 'no output' })

  setResponseHeader(event, 'Content-Type', job.contentType ?? 'application/octet-stream')
  setResponseHeader(event, 'X-Effect', job.effect)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  return job.output
})
