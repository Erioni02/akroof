import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { bounds, progressToTime } from '@/data/chapters'
import { film } from '@/lib/filmStore'
import { FrameBank, paintCover } from '@/lib/mp4Decoder'
import { clamp, damp, easeInOutQuad, prefersReducedMotion, range } from '@/lib/motion'
import { createSlowScroll } from '@/lib/slowScroll'

gsap.registerPlugin(ScrollTrigger)

/**
 * Length of the scroll track.
 *
 * This is the film's playback speed: the whole 30s runs across
 * TRACK - 100svh of scrolling, so a longer track means fewer video frames per
 * wheel notch and a visibly smoother scrub.
 *
 * At 1150svh on an 810px viewport that was ~4.7px of scroll per video frame,
 * about 21 frames per wheel notch. Useful bounds: below ~2px/frame the film
 * races ahead of the scroll, and above ~6px/frame it starts to visibly step
 * between notches.
 *
 * ── WHY THIS IS 2800 ───────────────────────────────────────────────────────
 * Two reasons, and the pacing one came second.
 *
 * It is the only effective control over scrub stutter, because it sets how many
 * video frames a given flick demands per second. The frame bank decodes this
 * stream at ~350 frames/sec; at 1150svh a one-second flick asked for roughly
 * 800, so the picture froze for up to a second and then snapped. No amount of
 * queue or cache tuning fixed that — the demand was simply above the supply.
 * (Measured: a shallower queue, hysteresis on the fast/slow switch, capping
 * keyframe reach and reordering eviction all made no reliable difference.)
 *
 * Then it was lengthened for feel, twice. At 4000svh the 30s film takes roughly
 * 33 500px of scrolling — about 19px per video frame — so an unhurried read
 * runs it at roughly 0.7x. Below real time the footage stops reading as
 * playback and starts reading as a held, deliberate shot, which is the whole
 * point of scrubbing a film rather than playing one.
 *
 * ── DIALLING THIS ──────────────────────────────────────────────────────────
 * This constant IS the pacing. Measured on a 1440x860 viewport, at a calm
 * ~800px/s scroll:
 *
 *     2800svh   ~25 000px   ~30s   1.0x, real time
 *     3400svh   ~29 000px   ~36s   0.85x
 *     4000svh   ~33 500px   ~42s   0.7x   <- here
 *     5000svh   ~42 000px   ~52s   0.57x, very slow
 *
 * Raising it costs nothing in responsiveness — it only makes each pixel of
 * scroll worth less film. The real limit is patience: everything below the
 * film still has to be reachable.
 *
 * This is well past the ~6px/frame the note above warns about. That bound
 * predates the velocity cap below; with the playhead speed-limited and damped,
 * a wheel notch now advances ~8 frames smoothly rather than stepping.
 */
const TRACK = 'h-[4000svh]'

/**
 * Cap for the fallback progress source. The video element's buffered range is
 * only used when the frame bank is not running; it must not reach 100 on its
 * own, because "playable" arrives long before the film is actually ready.
 */
const DOWNLOAD_SHARE = 88

/**
 * The film, served from Cloudinary rather than from `public/`.
 *
 * Two things make this faster than self-hosting, and both matter to the scrub:
 * the file arrives from a CDN edge instead of the origin, and it is returned
 * `immutable, max-age=30d`, so a repeat visitor pays nothing for it at all. The
 * frame bank cannot start decoding until the whole file is down, so
 * time-to-download IS time-to-smooth.
 *
 * Both URLs must keep these four properties, or the stage silently degrades:
 *
 *   Access-Control-Allow-Origin  the frame bank `fetch`es the bytes itself, and
 *                                the <video> is drawn into a canvas — without
 *                                CORS the fetch fails and the canvas taints
 *   Content-Length (exposed)     the loading bar reports real byte progress
 *   Accept-Ranges: bytes         the <video> fallback can seek
 *   video/mp4, H.264 (avc1)      the decoder parses MP4 and feeds WebCodecs.
 *                                Do NOT add `f_auto` — it may serve VP9/AV1 in
 *                                a WebM container, which this parser cannot read
 *
 * MOBILE is a Cloudinary transform of the same master, not a second upload:
 * 1280x720 @ 9.4 Mbps is 33.6 MB, which is a punishing download on a phone and
 * more pixels than a phone can show.
 *
 * ── `ki_0.084` IS LOAD-BEARING. DO NOT REMOVE IT TO SAVE BYTES. ─────────────
 * The master is encoded for scrubbing: a keyframe every 5 frames (359 of them
 * in 1797). Nothing about a Cloudinary transform preserves that — re-encoding
 * defaults to a keyframe roughly every 250 frames, and the derivative came back
 * with SEVEN.
 *
 * That is catastrophic here rather than merely suboptimal, because the decoder
 * submits whole GOPs: one `decodeRun` on a 250-frame GOP queues 250 decodes,
 * four runs a tick. Measured on the 7-keyframe build, a fast flick drove the
 * decode queue to 839 frames against a limit of 32, and the picture froze for
 * 15-17 animation frames while the decoder chewed through work for positions
 * the playhead had long since passed.
 *
 * `ki_0.084` (5 frames at 60fps) restores a 5.0-frame GOP, matching the master.
 * It costs real bytes — dense keyframes are expensive, 7.9 MB becomes 11.1 MB —
 * and that is simply the price of a scrubbable file. It is still a third
 * smaller than the 18 MB mobile cut it replaced, at 720x404 instead of 720p,
 * which is also meaningfully cheaper to decode on a phone.
 *
 * The first request for a derivative generates it (~9s) and every request after
 * that is served from cache.
 */
const CLOUDINARY = 'https://res.cloudinary.com/jzxdwuyw/video/upload'
const FILM = 'v1789764984/ak-film.mp4'

/**
 * Full-quality master. Swapping in `q_auto:good/` here takes it from 33.6 MB to
 * 8.8 MB — a much faster start, at some cost in fidelity on a large display.
 */
const DESKTOP_SRC = `${CLOUDINARY}/${FILM}`
const MOBILE_SRC = `${CLOUDINARY}/w_720,c_limit,q_auto:good,ki_0.084/${FILM}`

/** chapters 07–09 are the graphic passage: the footage becomes light, not text */
const ATMOS_IN = bounds[6].start
const ATMOS_OUT = bounds[8].end

type Props = {
  children: ReactNode
  onReady: () => void
}

export default function FilmStage({ children, onReady }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [usingCanvas, setUsingCanvas] = useState(false)
  useEffect(() => {
    const track = trackRef.current
    const video = videoRef.current
    const canvas = canvasRef.current
    const media = mediaRef.current
    if (!track || !video || !canvas || !media) return

    film.track = track
    const reduced = prefersReducedMotion()

    // dev-only handle for stepping through chapters without scrolling
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__film = film

    /* ---------------------------------------------------------------- source */

    const isSmall = window.matchMedia('(max-width: 900px)').matches
    const src = isSmall ? MOBILE_SRC : DESKTOP_SRC
    video.src = src

    /* ------------------------------------------------------------ ready gate */

    // The loading bar reports the download that actually has to finish, in
    // bytes — not the video element's buffered seconds, which reach "playable"
    // after a fraction of the file and made the bar lift at around 15%.
    //
    // Byte progress fills 0-92%. The last 8% belongs to parsing the sample
    // table and decoding the first frames, which is real work with no progress
    // of its own; reserving a slice for it is honest and stops the bar sitting
    // at 100% while the film is still not ready.
    let revealed = false
    const reveal = () => {
      if (revealed) return
      revealed = true
      film.setLoad(100)
      onReady()
    }

    const onProgress = () => {
      if (!video.duration) return
      const buffered = video.buffered.length
        ? video.buffered.end(video.buffered.length - 1) / video.duration
        : 0
      film.setLoad(clamp(buffered) * DOWNLOAD_SHARE)
    }

    video.addEventListener('progress', onProgress)
    video.addEventListener('loadeddata', onProgress)

    // If the frame bank cannot be built we still have a usable site, so fall
    // back to revealing as soon as the video can be scrubbed.
    let bankFailed = false
    const revealIfNoBank = () => {
      if (bankFailed) reveal()
    }
    // `loadeddata` as well as `canplay`: with preload="metadata" on a slow
    // connection the element can sit at HAVE_CURRENT_DATA for a long time and
    // never announce `canplay`. That is already enough to scrub, so if the
    // frame bank has failed there is no reason to hold the curtain — otherwise
    // those visitors would wait out the full 18s safety timeout staring at a
    // title card behind a site that was ready to use.
    video.addEventListener('canplay', revealIfNoBank)
    video.addEventListener('loadeddata', revealIfNoBank)

    // never let a stalled network hold the site hostage
    const safety = window.setTimeout(reveal, 18000)

    /* ------------------------------------------------------- canvas sizing */

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })

    /* ------------------------------------------------------------- scrubbing */

    let bank: FrameBank | null = null
    let cancelled = false
    let lastSeek = -1
    let forceRedraw = false

    // Progressive enhancement: the <video> scrubs the moment it has data, and
    // the decoded frame bank quietly takes over once it has finished parsing.
    FrameBank.load(src, (fraction) => film.setLoad(fraction * 100))
      .then((b) => {
        if (cancelled) {
          b.dispose()
          return
        }
        bank = b
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__bank = b
        sizeCanvas()
        b.invalidate()
        forceRedraw = true
        setUsingCanvas(true)
        reveal()
      })
      .catch(() => {
        // stay on the <video> path — identical behaviour, coarser frames
        bankFailed = true
        if (video.readyState >= 3) reveal()
      })

    const renderAt = (time: number) => {
      if (bank && ctx) {
        // The decoder has failed too often to be worth another rebuild. Hand
        // back to the <video> element: coarser frames, but it cannot wedge, and
        // a slightly softer scrub beats a rhythm of hitches.
        if (bank.exhausted) {
          bank.dispose()
          bank = null
          setUsingCanvas(false)
        } else {
          if (forceRedraw) {
            forceRedraw = false
            bank.invalidate()
          }
          bank.render(ctx, time)
          return
        }
      }
      // <video> fallback. Seeking a video element is genuinely expensive — the
      // browser decodes from the nearest keyframe each time — so this path is
      // throttled twice: never stack a seek on an unfinished one, and never ask
      // for a position less than a 30th of a second from the last. Past that,
      // extra seeks cost decode work for a difference nobody can see.
      if (video.readyState < 2) return
      if (video.seeking) return
      if (Math.abs(time - lastSeek) < 1 / 30) return
      lastSeek = time
      try {
        video.currentTime = time
      } catch {
        /* seek before metadata — the next tick will retry */
      }
    }

    /* -------------------------------------------------------------- treatment */

    // A CSS filter on a full-screen element is a full-screen GPU pass on every
    // composited frame — even `blur(0px)`. So the grade is baked into the canvas
    // draw instead, and `filter` is only ever set while the graphic passage of
    // chapters 07-09 actually needs a blur. The rest of the film pays nothing.
    let lastAtmos = -1
    const applyTreatment = (p: number) => {
      const t =
        easeInOutQuad(range(p, ATMOS_IN - 0.018, ATMOS_IN + 0.055)) *
        (1 - easeInOutQuad(range(p, ATMOS_OUT - 0.05, ATMOS_OUT + 0.012)))

      if (Math.abs(t - lastAtmos) < 0.004) return
      const wasOff = lastAtmos <= 0
      lastAtmos = t

      if (t <= 0) {
        if (!wasOff) {
          media.style.filter = ''
          media.style.willChange = ''
          media.style.transform = 'scale(1.015)'
        }
        return
      }

      if (wasOff) media.style.willChange = 'filter, transform'
      media.style.filter =
        'blur(' + ((reduced ? 10 : 19) * t).toFixed(1) + 'px) brightness(' +
        (1 - 0.44 * t).toFixed(3) + ')'
      media.style.transform = 'scale(' + (1.015 + 0.085 * t).toFixed(4) + ')'
    }

    /* ------------------------------------------------------------ scroll bind */

    // The page's own speed limit. Everything downstream — the film, the chapter
    // layers, the grade — simply follows scroll position, so capping the page
    // paces the whole experience at once.
    const slow = createSlowScroll()

    const trigger = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        film.raw = self.progress
      },
    })

    // Damped follow so the film never snaps between frames, even on a
    // trackpad flick or a jump-to-chapter.
    // `moved` throttles the expensive half — notifying eleven chapter layers and
    // touching the grade. The film itself is always given a chance to render,
    // even when the playhead is still: that is what lets the decoder keep
    // filling in behind a scrub and land on the exact frame once you stop.
    const present = (p: number, moved: boolean) => {
      film.emit(p, moved)
      if (moved) applyTreatment(p)
      renderAt(progressToTime(p))
    }

    let lastPresented = -1
    const tick = (_t: number, deltaMs: number) => {
      // Advance the page first: the film reads scroll position, so doing this
      // after would hand it last frame's position and reintroduce a one-frame
      // lag between the page and the picture.
      slow?.tick(deltaMs)

      const dt = Math.min(deltaMs, 50) / 1000
      // Damping that scales with the size of the gap.
      //
      // A fixed 0.26 is right for ordinary scrolling — it smooths the quantised
      // step of a wheel notch into a continuous move. But it is a fixed
      // FRACTION, so a big jump (End, dragging the scrollbar, a hard flick)
      // takes just as many frames to close as a small one, and the film is still
      // catching up when the page has already arrived. Measured on an instant
      // jump to the bottom: the footer appeared with the film at 0.91, so the
      // last 9% was never seen.
      //
      // Scaling the factor up with the gap fixes that without touching normal
      // scrolling: below ~8% of the film nothing changes, and beyond it the
      // playhead closes hard enough to arrive with the page.
      const gap = Math.abs(film.raw - film.smooth)
      const factor = 0.26 + 0.54 * Math.min(1, gap / 0.08)
      const k = reduced ? 1 : damp(factor, dt)

      // The playhead follows scroll 1:1, damped but NOT speed-limited.
      //
      // An earlier version capped how fast the film could travel. It felt
      // wonderful on a hard flick — the footage slowed to a crawl instead of
      // lurching — but capping the film while the PAGE kept moving at full speed
      // decoupled the two, and that produced two bugs that were really one bug:
      //
      //   · the page reached the end of the track, the sticky stage unpinned and
      //     the footer arrived while the film was still mid-way, so the rest of
      //     the film was simply skipped
      //   · the film went on travelling after the gesture stopped, because it
      //     was still working through a backlog the scrollbar had already spent
      //
      // Both are impossible while the film is tied to scroll position: reaching
      // the footer now REQUIRES having scrolled through the whole film, and a
      // playhead that only moves when scroll moves cannot run on. The slow,
      // cinematic feel comes from TRACK length instead, which buys the same
      // thing without ever letting the two drift apart.
      const next = reduced ? film.raw : film.smooth + (film.raw - film.smooth) * k

      const settled = Math.abs(film.raw - next) < 0.00002
      const p = settled ? film.raw : next

      // one video frame is ~1/1800 of the track; below that the UI has nothing
      // new to say, though the film still gets its render call
      const moved = Math.abs(p - lastPresented) >= 0.0002 || forceRedraw
      if (moved) lastPresented = p
      present(p, moved)
    }
    gsap.ticker.add(tick)

    if (new URLSearchParams(location.search).has('debug')) {
      const NEWLINE = String.fromCharCode(10)
      const el = document.createElement('div')
      el.style.cssText =
        'position:fixed;left:10px;bottom:10px;z-index:99999;font:11px/1.55 ui-monospace,monospace;' +
        'color:#F3F0E9;background:rgba(6,8,11,.86);padding:9px 12px;white-space:pre;' +
        'pointer-events:none;border:1px solid rgba(243,240,233,.18)'
      document.body.appendChild(el)

      let frames = 0
      let slow = 0
      let last = performance.now()
      let fps = 0
      let acc = 0

      const probe = () => {
        const now = performance.now()
        const dt = now - last
        last = now
        frames++
        acc += dt
        if (dt > 34) slow++
        if (acc >= 500) {
          fps = Math.round((frames / acc) * 1000)
          frames = 0
          acc = 0
        }
        const st = bank ? bank.stats() : null
        const lines = [
          'fps          ' + fps,
          'slow frames  ' + slow,
          'source       ' + (bank ? 'frame bank' : 'video element'),
        ]
        if (st) {
          lines.push('decoder      ' + st.path)
          lines.push('rebuilds     ' + st.rebuilds)
          lines.push('cached       ' + st.cached)
          lines.push('in flight    ' + st.inFlight + ' (pending ' + st.pending + ')')
          lines.push('worst hold   ' + st.worstHoldFrames + ' frames')
        }
        lines.push('progress     ' + (film.smooth * 100).toFixed(1) + '%')
        el.textContent = lines.join(NEWLINE)
      }
      gsap.ticker.add(probe)
    }

    if (import.meta.env.DEV) {
      // jump straight to a progress value without waiting for the damping loop
      ;(window as unknown as Record<string, unknown>).__seek = (p: number) => {
        film.raw = p
        present(p, true)
      }
    }

    /* ----------------------------------------------------------------- resize */

    // The canvas backing store follows the element's real box. A ResizeObserver
    // (rather than a window listener) means it is also correct on first layout,
    // on orientation change, and when the URL bar collapses on mobile.
    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      // Never allocate more pixels than the footage actually carries: past the
      // source width the extra fill rate buys nothing but costs every frame.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const srcW = bank ? bank.width : 1600
      const cap = Math.min(dpr, Math.max(1, srcW / rect.width))
      const w = Math.round(rect.width * cap)
      const h = Math.round(rect.height * cap)
      if (canvas.width === w && canvas.height === h) return

      canvas.width = w
      canvas.height = h
      bank?.invalidate()
      forceRedraw = true
    }

    const ro = new ResizeObserver(sizeCanvas)
    ro.observe(canvas)
    sizeCanvas()

    const onResize = () => ScrollTrigger.refresh()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    // Paint the current <video> frame into the canvas the moment it is sized,
    // so the handover to the frame bank has no empty first frame.
    const onSeeked = () => {
      if (!bank && ctx && video.readyState >= 2) paintCover(ctx, video)
    }
    video.addEventListener('seeked', onSeeked)

    return () => {
      cancelled = true
      ro.disconnect()
      clearTimeout(safety)
      gsap.ticker.remove(tick)
      slow?.destroy()
      trigger.kill()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('loadeddata', onProgress)
      video.removeEventListener('canplay', revealIfNoBank)
      video.removeEventListener('loadeddata', revealIfNoBank)
      video.removeEventListener('seeked', onSeeked)
      bank?.dispose()
      film.track = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={trackRef} className={'relative w-full ' + TRACK}>
      <div
        ref={stageRef}
        className="sticky top-0 h-[100svh] w-full overflow-hidden bg-ink"
      >
        {/* ---- the film ------------------------------------------------- */}
        <div
          ref={mediaRef}
          className="absolute inset-0 gpu"
          style={{ transform: 'scale(1.015)' }}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: usingCanvas ? 0 : 1 }}
            // Required now the film is cross-origin. `paintCover` draws this
            // element into the canvas to cover the handover to the frame bank,
            // and without an anonymous CORS request that draw taints the canvas
            // and throws a SecurityError — which would break the very fallback
            // that exists to keep the site usable when the decoder fails.
            crossOrigin="anonymous"
            muted
            playsInline
            // `metadata`, NOT `auto`. The frame bank fetches this same file in
            // full, and a media element's cache is separate from the fetch
            // cache in Chrome — so `auto` downloaded all 33.6 MB twice, 67 MB
            // total, with the two transfers competing for bandwidth. Since the
            // scrub only becomes smooth once the bank has the whole file, that
            // eager preload was directly delaying the thing it was meant to
            // cover for. With `metadata` the element pulls only enough to be
            // seekable and then range-requests as it goes, which is all the
            // stopgap path ever needed.
            preload="metadata"
            controls={false}
            disablePictureInPicture
            tabIndex={-1}
            aria-hidden="true"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full transition-opacity duration-700"
            style={{ opacity: usingCanvas ? 1 : 0 }}
            aria-hidden="true"
          />
        </div>

        {/* ---- grade ------------------------------------------------------
             A flat tint plus a vignette, as static layers. This is the same
             look the CSS `filter` gave the video, without asking the GPU to
             re-run a full-screen filter pass on every frame of the scrub. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'rgba(6,8,11,0.11)' }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(130% 96% at 50% 42%, rgba(6,8,11,0) 42%, rgba(6,8,11,0.55) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[34%]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(6,8,11,0.78) 0%, rgba(6,8,11,0.4) 38%, rgba(6,8,11,0) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%]"
          style={{
            background:
              'linear-gradient(to top, rgba(6,8,11,0.88) 0%, rgba(6,8,11,0.66) 22%, rgba(6,8,11,0.32) 52%, rgba(6,8,11,0) 100%)',
          }}
        />
        <Grain />

        {/* ---- chapter layers -------------------------------------------- */}
        {children}
      </div>
    </div>
  )
}

/** 35mm-ish grain. Keeps the flat renders from looking like CGI. */
function Grain() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
      }}
    />
  )
}
