/**
 * Encodage MP3 côté main thread : délègue au Web Worker lamejs.
 * Défaut 320 kbps (compat Open Radio + RCA + Transistor).
 */

interface WorkerProgress { type: 'progress'; value: number }
interface WorkerDone { type: 'done'; buffer: ArrayBuffer }
interface WorkerError { type: 'error'; message: string }
type WorkerResponse = WorkerProgress | WorkerDone | WorkerError

export function audioBufferToMp3(
  buffer: AudioBuffer,
  bitrate = 320,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), {
      type: 'module',
    })

    // Copies autonomes des canaux (transférables vers le worker).
    const channels: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(new Float32Array(buffer.getChannelData(c)))
    }
    const transfer = channels.map((c) => c.buffer)

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        onProgress?.(msg.value)
        return
      }
      if (msg.type === 'done') {
        worker.terminate()
        resolve(new Blob([msg.buffer], { type: 'audio/mpeg' }))
        return
      }
      worker.terminate()
      reject(new Error(msg.message))
    }

    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Erreur du worker MP3'))
    }

    worker.postMessage(
      { channels, sampleRate: buffer.sampleRate, bitrate },
      transfer,
    )
  })
}
