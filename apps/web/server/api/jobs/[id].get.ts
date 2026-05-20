export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const job = getJob(id)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Job not found' })

  return {
    id: job.id,
    effect: job.effect,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
  }
})
