/// <reference lib="webworker" />
/**
 * Web Worker d'encodage MP3 via lamejs.
 *
 * lamejs est synchrone et CPU-lourd : l'isoler dans un worker évite de
 * freezer l'UI pendant l'encodage d'une émission de plusieurs minutes.
 */
import { Mp3Encoder } from '@breezystack/lamejs'

const ctx = self as unknown as DedicatedWorkerGlobalScope

interface EncodeRequest {
  channels: Float32Array[]
  sampleRate: number
  bitrate: number
}

type EncodeResponse =
  | { type: 'progress'; value: number }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }

const BLOCK_SIZE = 1152 // taille de frame MP3

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

ctx.onmessage = (event: MessageEvent<EncodeRequest>) => {
  try {
    const { channels, sampleRate, bitrate } = event.data
    const numChannels = Math.min(channels.length, 2)
    const encoder = new Mp3Encoder(numChannels, sampleRate, bitrate)

    const left = floatToInt16(channels[0])
    const right = numChannels > 1 ? floatToInt16(channels[1]) : null

    const chunks: Uint8Array[] = []
    let total = 0
    const totalSamples = left.length

    for (let i = 0; i < totalSamples; i += BLOCK_SIZE) {
      const leftChunk = left.subarray(i, i + BLOCK_SIZE)
      const mp3buf = right
        ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + BLOCK_SIZE))
        : encoder.encodeBuffer(leftChunk)
      if (mp3buf.length > 0) {
        chunks.push(mp3buf)
        total += mp3buf.length
      }
      if ((i / BLOCK_SIZE) % 256 === 0) {
        const progress: EncodeResponse = { type: 'progress', value: i / totalSamples }
        ctx.postMessage(progress)
      }
    }

    const end = encoder.flush()
    if (end.length > 0) {
      chunks.push(end)
      total += end.length
    }

    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }

    const done: EncodeResponse = { type: 'done', buffer: out.buffer }
    ctx.postMessage(done, [out.buffer])
  } catch (err) {
    const error: EncodeResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    ctx.postMessage(error)
  }
}
