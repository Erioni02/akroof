/**
 * Frame-accurate scrubbing pipeline.
 *
 * mp4box parses the sample table so we know the exact CTS and sync flag of every
 * frame; WebCodecs decodes them.
 *
 * The important property is that **painting never waits for decoding**.
 *
 * An earlier version awaited the frame it wanted before drawing it. That looks
 * correct and behaves terribly: a decode is tens of milliseconds, so during a
 * scrub the great majority of animation frames arrived to find a decode already
 * in flight and simply dropped. The result was a slideshow at ~17fps.
 *
 * So the two jobs are split:
 *
 *  - `render()` is synchronous and always cheap. It paints the best frame it
 *    already has — the exact one if it is decoded, otherwise the nearest — and
 *    returns. It cannot stall a frame.
 *  - `pump()` runs independently, streaming a window of frames around the
 *    playhead into a cache. Chunks are submitted in long continuous runs, which
 *    is what hardware decoders are fast at; feeding them one frame at a time and
 *    waiting is what makes them slow.
 *
 * The picture is therefore always live, and detail fills in behind the playhead
 * within a frame or two. Everything is best-effort: if any of it fails the
 * caller falls back to seeking a plain <video> element.
 */

type Sample = {
  time: number
  isSync: boolean
  chunk: EncodedVideoChunk
}

/**
 * Overall load progress, 0..1, across every phase that has to finish before
 * the film can be scrubbed. The phases are weighted below; reporting only the
 * download would leave the bar parked while the sample table is parsed and the
 * decoder is chosen, which reads as a hang.
 */
export type LoadProgress = (fraction: number) => void

/** byte-level progress of the file download itself */
type ByteProgress = (loaded: number, total: number) => void

const PHASE_DOWNLOAD = 0.9
const PHASE_PARSE = 0.96
const PHASE_PICK = 0.99

/**
 * Frames per decoder trial. Enough to expose a decoder that stalls (the wedge
 * this guards against appears above five chunks) without making the benchmark
 * itself a noticeable part of the load.
 */
const BENCH_FRAMES = 14

/** decoded frames held at once (~2.2MB each at 1600x900, ~0.9MB on mobile) */
const MAX_FRAMES = 44
/** how far ahead of the playhead to keep decoding */
const AHEAD = 26
/** how far behind to keep, so small backward moves stay instant */
const BEHIND = 8
/** stop feeding the decoder past this backlog; it is already busy */
const QUEUE_LIMIT = 32
/** above this scrub speed (frames per animation frame) switch to keyframes */
const FAST_SPEED = 3
/** nominal GOP length, used only to size how far ahead keyframes are fetched */
const GOP_GUESS = 5

export class FrameBank {
  private samples: Sample[]
  private config: VideoDecoderConfig

  /** index of the sync sample at or before frame i */
  private syncOf: Int32Array
  /** every sync sample index, in order */
  private syncList: Int32Array
  /** which entry of syncList covers frame i */
  private gopOf: Int32Array

  private decoder: VideoDecoder | null = null
  /** frame indices awaiting output, in submission order */
  private queue: number[] = []

  private frames = new Map<number, VideoFrame>()
  /** frame indices submitted but not yet returned */
  private queued = new Set<number>()

  private target = 0
  private speed = 0
  private dir = 1

  private painted = -1
  private disposed = false

  /** watchdog state: a decoder that stops draining gets replaced */
  private lastQueueLen = 0
  private stalledFor = 0

  readonly width: number
  readonly height: number

  private constructor(
    samples: Sample[],
    config: VideoDecoderConfig,
    width: number,
    height: number,
  ) {
    this.samples = samples
    this.config = config
    this.width = width
    this.height = height

    this.syncOf = new Int32Array(samples.length)
    this.gopOf = new Int32Array(samples.length)

    const syncs: number[] = []
    let key = 0
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].isSync) {
        key = i
        syncs.push(i)
      }
      this.syncOf[i] = key
      this.gopOf[i] = Math.max(0, syncs.length - 1)
    }
    this.syncList = Int32Array.from(syncs.length ? syncs : [0])
  }

  static supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'VideoDecoder' in window &&
      'EncodedVideoChunk' in window
    )
  }

  /** Skip the bank where the memory or the data plan cannot justify it. */
  static worthwhile(): boolean {
    const nav = navigator as Navigator & {
      deviceMemory?: number
      connection?: { saveData?: boolean }
    }
    if (nav.connection?.saveData) return false
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false
    return true
  }

  static async load(url: string, onProgress?: LoadProgress): Promise<FrameBank> {
    if (!FrameBank.supported()) throw new Error('WebCodecs unavailable')
    if (!FrameBank.worthwhile()) throw new Error('frame bank not worthwhile here')

    const report = onProgress ?? (() => {})

    const mod: any = await import('mp4box')
    const MP4Box: any = mod.default ?? mod
    const buffer = await fetchBuffer(url, (loaded, total) => {
      if (total > 0) report((loaded / total) * PHASE_DOWNLOAD)
    })
    report(PHASE_DOWNLOAD)

    const bank = await new Promise<FrameBank>((resolve, reject) => {
      const file = MP4Box.createFile()
      let settled = false

      const fail = (e: unknown) => {
        if (settled) return
        settled = true
        reject(e instanceof Error ? e : new Error(String(e)))
      }
      const timer = setTimeout(() => fail(new Error('mp4box parse timeout')), 25000)

      file.onError = fail

      file.onReady = (info: any) => {
        try {
          const track = info.videoTracks && info.videoTracks[0]
          if (!track) throw new Error('no video track')

          const config: VideoDecoderConfig = {
            codec: track.codec,
            codedWidth: track.video.width,
            codedHeight: track.video.height,
            description: avccDescription(MP4Box, file, track.id),
            optimizeForLatency: true,
          }

          const collected: Sample[] = []

          file.onSamples = (_id: number, _user: unknown, samples: any[]) => {
            for (const s of samples) {
              collected.push({
                time: s.cts / s.timescale,
                isSync: !!s.is_sync,
                chunk: new EncodedVideoChunk({
                  type: s.is_sync ? 'key' : 'delta',
                  timestamp: Math.round((s.cts / s.timescale) * 1e6),
                  duration: Math.round((s.duration / s.timescale) * 1e6),
                  data: s.data,
                }),
              })
            }

            report(
              PHASE_DOWNLOAD +
                (PHASE_PARSE - PHASE_DOWNLOAD) *
                  Math.min(1, collected.length / Math.max(1, track.nb_samples)),
            )

            if (collected.length >= track.nb_samples && !settled) {
              settled = true
              clearTimeout(timer)
              file.stop()
              resolve(
                new FrameBank(collected, config, track.video.width, track.video.height),
              )
            }
          }

          file.setExtractionOptions(track.id, null, { nbSamples: 256 })
          file.start()
        } catch (e) {
          fail(e)
        }
      }

      const ab = buffer as ArrayBuffer & { fileStart?: number }
      ab.fileStart = 0
      file.appendBuffer(ab)
      file.flush()
    })

    await bank.prime(report)
    report(1)
    return bank
  }

  get frameCount(): number {
    return this.samples.length
  }

  /** Forget what is on the canvas — after a resize the same frame must repaint. */
  invalidate(): void {
    this.painted = -1
  }

  /**
   * Pick the decode path by measuring it.
   *
   * "prefer-hardware" is the obvious choice and is often wrong: on machines
   * without real GPU video decode — VMs, remote desktops, some laptops on
   * battery — the hardware path can be many times slower than software, and in
   * the worst case stops draining its queue altogether. Guessing either way
   * strands somebody, so we time a short run through each and keep the winner.
   * It costs a few hundred milliseconds, behind the loading screen.
   */
  private async chooseConfig(report: LoadProgress): Promise<void> {
    const candidates: VideoDecoderConfig[] = [
      { ...this.config, hardwareAcceleration: 'prefer-hardware' },
      { ...this.config, hardwareAcceleration: 'prefer-software' },
    ]

    let best: VideoDecoderConfig | null = null
    let bestMs = Infinity

    for (let i = 0; i < candidates.length; i++) {
      const ms = await timeDecode(candidates[i], this.samples, BENCH_FRAMES)
      if (ms < bestMs) {
        bestMs = ms
        best = candidates[i]
      }
      report(
        PHASE_PARSE +
          ((PHASE_PICK - PHASE_PARSE) * (i + 1)) / candidates.length,
      )
    }

    if (best && bestMs < Infinity) this.config = best
    // if both failed, keep the neutral config and let prime() surface the error
  }

  /** Decode the opening run now, so a broken config fails here not mid-scroll. */
  private async prime(report: LoadProgress): Promise<void> {
    await this.chooseConfig(report)
    this.target = 0
    for (let g = 0; g < Math.min(6, this.syncList.length); g++) this.decodeRun(g)

    const deadline = Date.now() + 6000
    while (!this.frames.has(0)) {
      if (Date.now() > deadline) throw new Error('decoder produced no frames')
      await new Promise((r) => setTimeout(r, 16))
    }
  }

  private getDecoder(): VideoDecoder {
    if (this.decoder && this.decoder.state === 'configured') return this.decoder

    const dec = new VideoDecoder({
      output: (f) => {
        const idx = this.queue.shift()
        if (idx === undefined || this.disposed) {
          f.close()
          return
        }
        this.queued.delete(idx)
        const old = this.frames.get(idx)
        if (old) old.close()
        this.frames.set(idx, f)
      },
      error: () => {
        this.decoder = null
        this.queue.length = 0
        this.queued.clear()
      },
    })
    dec.configure(this.config)
    this.decoder = dec
    return dec
  }

  private indexForTime(t: number): number {
    const s = this.samples
    let lo = 0
    let hi = s.length - 1
    let best = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (s[mid].time <= t) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best
  }

  /**
   * Paint the best frame available for `time` and return. Never awaits, never
   * throws — the worst case is that the previous frame stays up for a beat.
   */
  render(ctx: CanvasRenderingContext2D, time: number): void {
    if (this.disposed) return

    const i = this.indexForTime(time)
    const jump = i - this.target
    if (jump !== 0) this.dir = jump > 0 ? 1 : -1
    this.speed = this.speed * 0.7 + Math.abs(jump) * 0.3
    this.target = i

    const pick = this.bestAvailable(i)
    if (pick >= 0 && pick !== this.painted) {
      const frame = this.frames.get(pick)
      if (frame) {
        paintCover(ctx, frame)
        this.painted = pick
      }
    }

    this.pump()
  }

  /** The exact frame if we have it, else the closest decoded one nearby. */
  private bestAvailable(i: number): number {
    if (this.frames.has(i)) return i
    for (let d = 1; d <= 24; d++) {
      if (this.frames.has(i - d)) return i - d
      if (this.frames.has(i + d)) return i + d
    }
    return this.painted
  }

  /** Range of frames covered by GOP `g`. */
  private gopRange(g: number): [number, number] {
    const start = this.syncList[g]
    const end =
      g + 1 < this.syncList.length ? this.syncList[g + 1] : this.samples.length
    return [start, end]
  }

  /**
   * Submit a whole GOP, contiguously from its keyframe.
   *
   * Runs are never submitted partially, and one already in flight is left
   * alone. A delta frame only decodes correctly when the frames before it went
   * through the same decoder in order, so cherry-picking just the missing
   * frames out of a run would quietly produce corrupt pictures.
   */
  private decodeRun(g: number): boolean {
    if (g < 0 || g >= this.syncList.length) return false
    const [start, end] = this.gopRange(g)
    if (this.queued.has(start)) return false

    let missing = false
    for (let j = start; j < end; j++) {
      if (!this.frames.has(j)) {
        missing = true
        break
      }
    }
    if (!missing) return false

    return this.push(start, end)
  }

  /** Submit only a GOP keyframe — one decode instead of the whole run. */
  private decodeKey(g: number): boolean {
    if (g < 0 || g >= this.syncList.length) return false
    const start = this.syncList[g]
    if (this.frames.has(start) || this.queued.has(start)) return false
    return this.push(start, start + 1)
  }

  private push(start: number, end: number): boolean {
    let dec: VideoDecoder
    try {
      dec = this.getDecoder()
    } catch {
      return false
    }
    try {
      for (let j = start; j < end; j++) {
        dec.decode(this.samples[j].chunk)
        this.queue.push(j)
        this.queued.add(j)
      }
    } catch {
      this.dropDecoder()
      return false
    }
    return true
  }

  /**
   * Keep decoded frames available around the playhead.
   *
   * Synchronous and bounded: `render` re-arms it every animation frame, so
   * there is no reason to loop here — looping is what made an earlier version
   * thrash, rebuilding the decoder several times a second while the playhead
   * outran its own streamed window.
   *
   * Two modes. At a readable scroll pace it decodes complete GOPs around the
   * playhead, so every frame is exact. Scrolling faster than the decoder can
   * follow, it switches to keyframes only, spread along the direction of
   * travel: a fifth of the work, and at that speed nobody can tell which of
   * five frames they were given. The moment the scrub settles, full runs
   * resume and the picture lands on the exact frame.
   */
  private pump(): void {
    if (this.disposed) return

    // the decoder is already holding as much as it can usefully chew
    if (this.queue.length > QUEUE_LIMIT) {
      // ...unless it has stopped chewing. Some decoders wedge; rebuild rather
      // than wait forever on a queue that will never drain.
      if (this.queue.length >= this.lastQueueLen) this.stalledFor++
      else this.stalledFor = 0
      this.lastQueueLen = this.queue.length

      if (this.stalledFor > 45) {
        this.stalledFor = 0
        this.dropDecoder()
      }
      return
    }
    this.stalledFor = 0
    this.lastQueueLen = this.queue.length

    this.trim()

    const i = this.target
    const here = this.gopOf[i]

    if (this.speed > FAST_SPEED) {
      // sparse keyframes, biased the way the scroll is travelling
      const reach = Math.max(4, Math.ceil((this.speed * 20) / GOP_GUESS))
      let issued = 0
      for (let k = 0; k <= reach && issued < 6; k++) {
        if (this.decodeKey(here + this.dir * k)) issued++
      }
      return
    }

    // Exact frames. The run under the playhead goes first — decoding in
    // positional order would put a couple of GOPs the reader has already passed
    // ahead of the one they are actually looking at, and at ~4ms a frame that
    // is the difference between landing on the exact frame in one tick or five.
    const ahead = Math.ceil(AHEAD / GOP_GUESS)
    const behind = Math.ceil(BEHIND / GOP_GUESS)
    let issued = 0
    if (this.decodeRun(here)) issued++
    for (let k = 1; k <= Math.max(ahead, behind) && issued < 4; k++) {
      if (k <= ahead && issued < 4 && this.decodeRun(here + this.dir * k)) issued++
      if (k <= behind && issued < 4 && this.decodeRun(here - this.dir * k)) issued++
    }
  }

  /** Tear down the decoder; the next submission builds a fresh one. */
  private dropDecoder(): void {
    try {
      if (this.decoder && this.decoder.state !== 'closed') this.decoder.close()
    } catch {
      /* already gone */
    }
    this.decoder = null
    this.queue.length = 0
    this.queued.clear()
  }

  /** Drop whatever is furthest from the playhead. */
  private trim(): void {
    if (this.frames.size <= MAX_FRAMES) return
    const keys = [...this.frames.keys()].sort(
      (a, b) => Math.abs(b - this.target) - Math.abs(a - this.target),
    )
    for (const k of keys) {
      if (this.frames.size <= MAX_FRAMES) break
      if (k === this.painted) continue
      this.frames.get(k)!.close()
      this.frames.delete(k)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const f of this.frames.values()) f.close()
    this.frames.clear()
    this.queue.length = 0
    this.dropDecoder()
    this.samples = []
  }
}

/**
 * Time decoding `n` frames from the head of the file with a given config.
 * Returns Infinity if the config is unsupported, errors, or wedges.
 */
async function timeDecode(
  config: VideoDecoderConfig,
  samples: { chunk: EncodedVideoChunk }[],
  n: number,
): Promise<number> {
  try {
    const support = await VideoDecoder.isConfigSupported(config)
    if (!support.supported) return Infinity
  } catch {
    return Infinity
  }

  const count = Math.min(n, samples.length)
  const frames: VideoFrame[] = []
  let decoder: VideoDecoder | null = null

  const cleanup = () => {
    for (const f of frames) f.close()
    frames.length = 0
    try {
      if (decoder && decoder.state !== 'closed') decoder.close()
    } catch {
      /* already gone */
    }
  }

  try {
    const t0 = performance.now()
    const ms = await Promise.race([
      (async () => {
        decoder = new VideoDecoder({
          output: (f) => frames.push(f),
          error: () => {},
        })
        decoder.configure(config)
        for (let i = 0; i < count; i++) decoder.decode(samples[i].chunk)
        await decoder.flush()
        return performance.now() - t0
      })(),
      // a decoder that cannot manage this is not the one we want anyway
      new Promise<number>((r) => setTimeout(() => r(Infinity), 1500)),
    ])

    // a decoder that returned nothing is no use however fast it claims to be
    if (frames.length < count) return Infinity
    return ms
  } catch {
    return Infinity
  } finally {
    cleanup()
  }
}

/** object-fit: cover, on a 2D canvas. */
export function paintCover(
  ctx: CanvasRenderingContext2D,
  src: VideoFrame | HTMLVideoElement,
): void {
  const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.displayWidth
  const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.displayHeight
  if (!sw || !sh) return

  const cw = ctx.canvas.width
  const ch = ctx.canvas.height
  const scale = Math.max(cw / sw, ch / sh)
  const w = sw * scale
  const h = sh * scale
  ctx.drawImage(src, (cw - w) / 2, (ch - h) / 2, w, h)
}

function avccDescription(MP4Box: any, file: any, trackId: number): Uint8Array {
  const trak = file.getTrackById(trackId)
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C
    if (box) {
      const stream = new MP4Box.DataStream(
        undefined,
        0,
        MP4Box.DataStream.BIG_ENDIAN,
      )
      box.write(stream)
      return new Uint8Array(stream.buffer, 8) // strip the 8-byte box header
    }
  }
  throw new Error('no codec description in stsd')
}

/** One download per URL, no matter how many times the stage remounts. */
const inflight = new Map<string, Promise<ArrayBuffer>>()

function fetchBuffer(url: string, onProgress?: ByteProgress) {
  let p = inflight.get(url)
  if (!p) {
    p = download(url, onProgress)
    inflight.set(url, p)
  }
  return p
}

async function download(url: string, onProgress?: ByteProgress) {
  // The <video> element is already pulling this file. Prefer the HTTP cache so
  // the frame bank costs no second download on a properly cached host.
  const res = await fetch(url, { cache: 'force-cache' })
  if (!res.ok || !res.body) throw new Error('fetch failed: ' + res.status)

  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let loaded = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    parts.push(value)
    loaded += value.byteLength
    if (onProgress) onProgress(loaded, total)
  }

  const out = new Uint8Array(loaded)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.byteLength
  }
  return out.buffer
}
