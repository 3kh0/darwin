import { describe, it, expect, afterEach } from 'vitest'
import { storeTempFile, readTempFile, deleteTempFile } from '../../server/utils/tempFiles'

describe('tempFiles', () => {
  const stored: string[] = []

  afterEach(async () => {
    for (const id of stored.splice(0)) {
      await deleteTempFile(id)
    }
  })

  describe('storeTempFile', () => {
    it('returns a UUID-based .png ID for image/png', async () => {
      const id = await storeTempFile(Buffer.from('png'), 'image/png')
      stored.push(id)
      expect(id).toMatch(/^[0-9a-f-]{36}\.png$/)
    })

    it('assigns .jpg extension for image/jpeg', async () => {
      const id = await storeTempFile(Buffer.from('jpeg'), 'image/jpeg')
      stored.push(id)
      expect(id).toMatch(/\.jpg$/)
    })

    it('assigns .gif extension for image/gif', async () => {
      const id = await storeTempFile(Buffer.from('gif'), 'image/gif')
      stored.push(id)
      expect(id).toMatch(/\.gif$/)
    })

    it('assigns .webp extension for image/webp', async () => {
      const id = await storeTempFile(Buffer.from('webp'), 'image/webp')
      stored.push(id)
      expect(id).toMatch(/\.webp$/)
    })

    it('assigns .avif extension for image/avif', async () => {
      const id = await storeTempFile(Buffer.from('avif'), 'image/avif')
      stored.push(id)
      expect(id).toMatch(/\.avif$/)
    })

    it('assigns no extension for an unrecognized MIME type', async () => {
      const id = await storeTempFile(Buffer.from('data'), 'application/octet-stream')
      stored.push(id)
      expect(id).not.toContain('.')
    })
  })

  describe('readTempFile', () => {
    it('reads back the exact bytes that were stored', async () => {
      const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const id = await storeTempFile(data, 'image/png')
      stored.push(id)
      const result = await readTempFile(id)
      expect(result).not.toBeNull()
      expect(result!.data).toEqual(data)
    })

    it('returns the MIME type inferred from the file extension', async () => {
      const id = await storeTempFile(Buffer.from('gif'), 'image/gif')
      stored.push(id)
      expect((await readTempFile(id))!.mimeType).toBe('image/gif')
    })

    it('returns application/octet-stream for an unrecognized extension', async () => {
      const id = await storeTempFile(Buffer.from('data'), 'application/octet-stream')
      stored.push(id)
      expect((await readTempFile(id))!.mimeType).toBe('application/octet-stream')
    })

    it('returns null for a file that does not exist', async () => {
      expect(await readTempFile('no-such-file.png')).toBeNull()
    })

    it('blocks path traversal with ../', async () => {
      expect(await readTempFile('../../../etc/passwd')).toBeNull()
    })

    it('blocks IDs containing a forward slash', async () => {
      expect(await readTempFile('sub/file.png')).toBeNull()
    })

    it('blocks IDs containing a null byte', async () => {
      expect(await readTempFile('file\0.png')).toBeNull()
    })
  })

  describe('deleteTempFile', () => {
    it('removes the file so readTempFile returns null afterwards', async () => {
      const id = await storeTempFile(Buffer.from('delete-me'), 'image/png')
      await deleteTempFile(id)
      expect(await readTempFile(id)).toBeNull()
    })

    it('does not throw for a file that does not exist', async () => {
      await expect(deleteTempFile('ghost.png')).resolves.toBeUndefined()
    })

    it('silently ignores IDs containing ../', async () => {
      await expect(deleteTempFile('../secret')).resolves.toBeUndefined()
    })
  })
})
