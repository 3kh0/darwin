const MAX_FILE_SIZE = 40 * 1024 * 1024 // 40 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
])

export default defineEventHandler(async (event) => {
  requireApiKey(event)
  startCleanupTimer()

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'expect multipart/form-data' })
  }

  const field = (name: string) =>
    formData.find((f) => f.name === name)?.data.toString().trim() ?? ''

  const effect = field('effect')
  const imageUrl = field('imageUrl')
  const paramsRaw = field('params')
  const fileField = formData.find((f) => f.name === 'file' && f.filename)

  if (!effect) {
    throw createError({ statusCode: 400, statusMessage: 'no effect' })
  }
  if (!fileField && !imageUrl) {
    throw createError({ statusCode: 400, statusMessage: 'no file' })
  }

  let params: Record<string, string | number | boolean> = {}
  if (paramsRaw) {
    try { params = JSON.parse(paramsRaw) } catch {
      throw createError({ statusCode: 400, statusMessage: 'bad json' })
    }
  }

  let inputPath: string
  let tempFileId: string | null = null

  if (fileField) {
    const data = fileField.data
    const mime = fileField.type ?? ''

    if (!ALLOWED_TYPES.has(mime)) {
      throw createError({ statusCode: 422, statusMessage: `unkwnon MIME ${mime}` })
    }
    if (data.length > MAX_FILE_SIZE) {
      throw createError({ statusCode: 413, statusMessage: 'fat ass' })
    }

    tempFileId = await storeTempFile(data, mime)
    // Build a signed, expiring public URL for esmBot to fetch
    inputPath = buildMediaUrl(tempFileId, 10 * 60 * 1000)
  } else {
    if (!/^https?:\/\//i.test(imageUrl)) {
      throw createError({ statusCode: 400, statusMessage: 'bad url' })
    }
    inputPath = imageUrl
  }

  let result
  try {
    result = await processJob({
      cmd: effect,
      inputs: [{ path: inputPath, spoiler: false }],
      params,
    })
  } catch (e: unknown) {
    if (tempFileId) await deleteTempFile(tempFileId)
    const msg = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 500, statusMessage: `esmBot error: ${msg}` })
  }

  // Clean up upload after esmBot fetched it
  if (tempFileId) await deleteTempFile(tempFileId)

  setResponseHeader(event, 'Content-Type', result.contentType)
  setResponseHeader(event, 'X-Effect', effect)
  setResponseHeader(event, 'X-Job-Id', result.jobId.toString())
  setResponseHeader(event, 'Cache-Control', 'no-store')

  return result.buffer
})
