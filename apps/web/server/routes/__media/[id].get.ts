export default defineEventHandler(async (event) => {
  const fileId = getRouterParam(event, 'id') ?? ''
  const token = getQuery(event).token as string | undefined

  if (!token) {
    throw createError({ statusCode: 403, statusMessage: 'no token' })
  }

  if (!verifyMediaToken(fileId, token)) {
    throw createError({ statusCode: 403, statusMessage: 'bad token' })
  }

  const file = await readTempFile(fileId)
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }

  setResponseHeader(event, 'Content-Type', file.mimeType)
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache')
  setResponseHeader(event, 'Content-Length', file.data.length.toString())

  return file.data
})
