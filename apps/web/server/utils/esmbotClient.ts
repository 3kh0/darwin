/**
 * esmBot binary WebSocket protocol client.
 *
 * Protocol reference: https://github.com/esmBot/esmBot/blob/master/src/api/IMPLEMENTATION.md
 *
 * Opcodes (all messages are binary):
 *   Rerror = 0x01  server → client: error
 *   Tqueue = 0x02  client → server: queue job
 *   Rqueue = 0x03  server → client: job queued
 *   Tcancel= 0x04  client → server: cancel job
 *   Rcancel= 0x05  server → client: cancelled
 *   Twait  = 0x06  client → server: wait for job completion
 *   Rwait  = 0x07  server → client: job done, fetch via HTTP
 *   Rinit  = 0x08  server → client: sent on connect (formats/state)
 *   Rsent  = 0x09  server → client: job posted to Discord
 *   Rclose = 0xff  server → client: server closing
 *
 * Rinit layout:   [0x08][4-byte pad][uint16LE jobCount][JSON]
 * Tqueue layout:  [0x02][uint16LE tag][int64LE id][JSON job]
 * Twait layout:   [0x06][uint16LE tag][uint64LE id]
 * Rqueue layout:  [0x03][uint16LE tag]
 * Rwait layout:   [0x07][uint16LE tag]
 * Rerror layout:  [0x01][uint16LE tag][string]
 */

import WebSocket from 'ws'

const Rerror = 0x01
const Tqueue = 0x02
const Rqueue = 0x03
const Twait  = 0x06
const Rwait  = 0x07
const Rinit  = 0x08
const Rsent  = 0x09
const Rclose = 0xff

export interface MediaFormats {
  image?: { [cmd: string]: string[] }
}

export interface JobInput {
  path: string
  spoiler?: boolean
}

export interface JobRequest {
  cmd: string
  inputs: JobInput[]
  params: Record<string, string | number | boolean>
}

export interface JobResult {
  jobId: bigint
  buffer: Buffer
  contentType: string
}

// ── Tag counter (per-process, wraps at 16 bits) ────────────────────────────
let tagCounter = 0
function nextTag(): Buffer {
  const tag = Buffer.alloc(2)
  tag.writeUInt16LE(tagCounter & 0xffff)
  tagCounter = (tagCounter + 1) & 0xffff
  return tag
}

// ── Job ID generation (positive, fits int64) ──────────────────────────────
export function generateJobId(): bigint {
  // Stay within safe JS integer range (< 2^53) to avoid BigInt64 sign issues
  const lo = Math.floor(Math.random() * 0xffffffff)
  const hi = Math.floor(Math.random() * 0x1fffff)
  return BigInt(hi) * BigInt(0x100000000) + BigInt(lo >>> 0)
}

// ── Low-level connection helpers ──────────────────────────────────────────

function getConfig() {
  const config = useRuntimeConfig()
  return {
    wsUrl: config.esmbotWsUrl || 'ws://localhost:3762/sock',
    httpUrl: config.esmbotHttpUrl || 'http://localhost:3762',
    pass: config.esmbotPass || '',
  }
}

function openSocket(): Promise<WebSocket> {
  const { wsUrl, pass } = getConfig()
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {}
    if (pass) headers['authentication'] = pass

    const ws = new WebSocket(wsUrl, { headers })
    ws.binaryType = 'nodebuffer'
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function readRinit(ws: WebSocket, timeoutMs = 10_000): Promise<MediaFormats> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('Timeout waiting for Rinit from esmBot'))
    }, timeoutMs)

    ws.once('message', (raw: unknown) => {
      clearTimeout(timer)
      const data = raw as Buffer
      const opcode = data.readUint8(0)
      if (opcode !== Rinit) {
        reject(new Error(`Expected Rinit (0x08), got 0x${opcode.toString(16)}`))
        return
      }
      // Layout: [0x08][4 pad bytes][uint16LE count][JSON]
      try {
        const formats = JSON.parse(data.subarray(7).toString()) as MediaFormats
        resolve(formats)
      } catch (e) {
        reject(new Error(`Failed to parse Rinit JSON: ${e}`))
      }
    })

    ws.once('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

function waitForMessage(
  ws: WebSocket,
  matchTag: Buffer,
  timeoutMs: number,
): Promise<{ opcode: number; payload: Buffer }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler)
      reject(new Error('Timeout waiting for esmBot response'))
    }, timeoutMs)

    function handler(raw: unknown) {
      const data = raw as Buffer
      if (!(data instanceof Buffer) || data.length < 3) return
      const opcode = data.readUint8(0)
      const msgTag = data.subarray(1, 3)

      if (opcode === Rclose) {
        clearTimeout(timer)
        ws.off('message', handler)
        reject(new Error('esmBot closed connection'))
        return
      }

      if (!msgTag.equals(matchTag)) return

      clearTimeout(timer)
      ws.off('message', handler)
      resolve({ opcode, payload: data.subarray(3) })
    }

    ws.on('message', handler)
  })
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch available effects from esmBot by reading the Rinit packet.
 * Returns the list of effect names and the full formats map.
 */
export async function getEffects(): Promise<{ effects: string[]; formats: MediaFormats }> {
  const ws = await openSocket()
  try {
    const formats = await readRinit(ws)
    const effects = Object.keys(formats.image ?? {}).sort()
    return { effects, formats }
  } finally {
    ws.close()
  }
}

/**
 * Queue a job, wait for completion, and return the raw output buffer.
 */
export async function processJob(job: JobRequest, timeoutMs = 120_000): Promise<JobResult> {
  const { httpUrl, pass } = getConfig()
  const ws = await openSocket()

  try {
    await readRinit(ws)

    const jobId = generateJobId()
    const queueTag = nextTag()

    // Build Tqueue message: [0x02][tag:2][id:int64LE:8][JSON]
    const idBuf = Buffer.alloc(8)
    idBuf.writeBigInt64LE(jobId)
    const jobJson = Buffer.from(JSON.stringify({ ...job, id: jobId.toString() }))
    const tqueue = Buffer.concat([Buffer.from([Tqueue]), queueTag, idBuf, jobJson])
    ws.send(tqueue)

    // Wait for Rqueue
    const rqueue = await waitForMessage(ws, queueTag, 15_000)
    if (rqueue.opcode !== Rqueue) {
      const msg = rqueue.payload.toString()
      throw new Error(`Expected Rqueue, got 0x${rqueue.opcode.toString(16)}: ${msg}`)
    }

    // Send Twait: [0x06][tag:2][id:uint64LE:8]
    const waitTag = nextTag()
    const waitIdBuf = Buffer.alloc(8)
    waitIdBuf.writeBigUInt64LE(jobId)
    const twait = Buffer.concat([Buffer.from([Twait]), waitTag, waitIdBuf])
    ws.send(twait)

    // Wait for Rwait or error
    const rwait = await waitForMessage(ws, waitTag, timeoutMs)

    if (rwait.opcode === Rerror) {
      throw new Error(`esmBot job failed: ${rwait.payload.toString()}`)
    }
    if (rwait.opcode === Rsent) {
      // Job was auto-posted to Discord; shouldn't happen in our setup
      throw new Error('esmBot sent result to Discord instead of caching it')
    }
    if (rwait.opcode !== Rwait) {
      throw new Error(`Unexpected opcode 0x${rwait.opcode.toString(16)} from esmBot`)
    }

    // Fetch the binary output from esmBot HTTP
    const mediaHeaders: Record<string, string> = {}
    if (pass) mediaHeaders['authentication'] = pass
    const resp = await fetch(`${httpUrl}/media?id=${jobId}`, { headers: mediaHeaders })
    if (!resp.ok) {
      throw new Error(`esmBot /media returned ${resp.status} ${resp.statusText}`)
    }

    const buffer = Buffer.from(await resp.arrayBuffer())
    const contentType = resp.headers.get('content-type') ?? 'application/octet-stream'

    return { jobId, buffer, contentType }
  } finally {
    try { ws.close() } catch {}
  }
}

/**
 * Check how many jobs esmBot is currently running.
 */
export async function getRunningJobCount(): Promise<number> {
  const { httpUrl, pass } = getConfig()
  const headers: Record<string, string> = {}
  if (pass) headers['authentication'] = pass
  const resp = await fetch(`${httpUrl}/count`, { headers })
  if (!resp.ok) throw new Error(`esmBot /count returned ${resp.status}`)
  const text = await resp.text()
  return parseInt(text.trim(), 10) || 0
}
