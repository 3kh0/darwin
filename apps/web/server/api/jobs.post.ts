import { randomUUID } from 'node:crypto'

const MAX_FILE_SIZE = 40 * 1024 * 1024
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
    throw createError({ statusCode: 400, statusMessage: 'need multipart/form-data' })
  }

  const field = (name: string) =>
    formData.find((f) => f.name === name)?.data.toString().trim() ?? ''

  const effect = field('effect')
  const imageUrl = field('imageUrl')
  const paramsRaw = field('params')
  const fileField = formData.find((f) => f.name === 'file' && f.filename)

  if (!effect) throw createError({ statusCode: 400, statusMessage: 'no effect' })
  if (!fileField && !imageUrl) throw createError({ statusCode: 400, statusMessage: 'no file' })

  let params: Record<string, string | number | boolean> = {}
  if (paramsRaw) {
    try { params = JSON.parse(paramsRaw) } catch {
      throw createError({ statusCode: 400, statusMessage: 'bad json' })
    }
  }

  const jobId = `job_${randomUUID().replace(/-/g, '')}`
  const jobEntry = createJob(jobId, effect)

  // Process async — don't await
  ;(async () => {
    updateJob(jobId, { status: 'processing' })
    let tempFileId: string | null = null
    try {
      let inputPath: string

      if (fileField) {
        const mime = fileField.type ?? ''
        if (!ALLOWED_TYPES.has(mime)) throw new Error(`unknown MIME ${mime}`)
        if (fileField.data.length > MAX_FILE_SIZE) throw new Error('fat ass')
        tempFileId = await storeTempFile(fileField.data, mime)
        inputPath = buildMediaUrl(tempFileId, 10 * 60 * 1000)
      } else {
        if (!/^https?:\/\//i.test(imageUrl)) throw new Error('bad url')
        inputPath = imageUrl
      }

      const result = await processJob({
        cmd: effect,
        inputs: [{ path: inputPath, spoiler: false }],
        params,
      })

      if (tempFileId) await deleteTempFile(tempFileId)
      updateJob(jobId, { status: 'done', output: result.buffer, contentType: result.contentType })
    } catch (e: unknown) {
      if (tempFileId) await deleteTempFile(tempFileId)
      updateJob(jobId, { status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  })()

  setResponseStatus(event, 202)
  return { id: jobEntry.id, status: jobEntry.status }
})
