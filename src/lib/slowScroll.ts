/**
 * A speed limit on the page itself.
 *
 * Every earlier attempt at a cinematic pace slowed the FILM while the page kept
 * moving at whatever speed the wheel asked for. That decouples the two, and the
 * decoupling is what produced every bug: the page arrived at the footer with the
 * film unfinished, and the film went on travelling after the gesture stopped.
 *
 * So the limit belongs on the scroll, not the playhead. With the page itself
 * unable to move faster than `MAX_PX_PER_SEC`, the film can stay tied to scroll
 * position 1:1 — and then it cannot be skipped, cannot run on, and cannot be
 * asked to decode faster than it can (a capped scroll demands ~46 frames/sec
 * against the ~350 the decoder sustains).
 *
 * ── HOW IT BEHAVES ─────────────────────────────────────────────────────────
 * Wheel input accumulates into a target and the page eases toward it at the
 * cap. Input beyond `LEAD` px ahead of the current position is DISCARDED rather
 * than queued — that is the part that prevents run-on. Spinning the wheel
 * harder does not buy you more distance; it just keeps the page moving at the
 * cap for as long as you keep spinning.
 *
 * LEAD is therefore a coast budget, not a buffer to be generous with: it is
 * exactly how far the page can still travel after your hand stops, and at 240px
 * against an 850px/sec cap that is ~0.28s. Two wheel notches still queue
 * normally, so ordinary scrolling never feels swallowed; only a flick is
 * truncated, which is the entire point.
 *
 * ── WHAT IS DELIBERATELY LEFT ALONE ────────────────────────────────────────
 * TOUCH. Intercepting `touchmove` means reimplementing momentum, rubber-banding
 * and overscroll, and doing it worse than the platform does. Phones keep native
 * scrolling; the long track is what paces them.
 *
 * REDUCED MOTION. Anyone who has asked for less motion gets the untouched
 * native scroll — hijacking the page is exactly what that setting is about.
 *
 * External scrolls (dragging the scrollbar, an anchor jump, find-in-page) are
 * detected and handed back to rather than fought.
 */

type Options = {
  /** Ceiling on page velocity, px/sec. */
  maxPxPerSec?: number
  /** How far input may queue ahead of the page before it is discarded. */
  lead?: number
}

export type SlowScroll = { destroy: () => void; tick: (deltaMs: number) => void }

export function createSlowScroll(opts: Options = {}): SlowScroll | null {
  if (typeof window === 'undefined') return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  const MAX = opts.maxPxPerSec ?? 850
  const LEAD = opts.lead ?? 240

  const limit = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

  let target = window.scrollY
  /** Where our own last write left the page, so we can spot outside changes. */
  let expected = window.scrollY
  let active = false

  /** Adopt the page's position — used on any scroll we did not perform. */
  const resync = () => {
    target = window.scrollY
    expected = window.scrollY
  }

  const push = (delta: number) => {
    // Something else moved the page since our last write; take it as the truth.
    if (Math.abs(window.scrollY - expected) > 2) resync()

    const cur = window.scrollY
    target = clamp(target + delta, 0, limit())
    // Discard anything beyond LEAD. This is what stops a hard flick banking
    // distance that keeps spending itself after the hand has stopped.
    target = clamp(target, cur - LEAD, cur + LEAD)
    active = true
  }

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return // pinch-zoom
    e.preventDefault()
    // deltaMode 1 is lines, 2 is pages; normalise both to pixels.
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
    push(e.deltaY * scale)
  }

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
    if (t?.isContentEditable) return

    const page = window.innerHeight * 0.85
    const line = window.innerHeight * 0.12
    let d: number | null = null

    if (e.key === 'PageDown') d = page
    else if (e.key === 'PageUp') d = -page
    else if (e.key === 'ArrowDown') d = line
    else if (e.key === 'ArrowUp') d = -line
    else if (e.key === ' ' && !e.shiftKey) d = page
    else if (e.key === ' ' && e.shiftKey) d = -page
    // Home and End are an explicit "take me there", not a scroll gesture, so
    // they bypass the speed limit entirely and jump. Capping them would mean a
    // 40-second journey to the footer, and truncating them (which LEAD does to
    // everything else) means the key appears to do nothing at all — both read as
    // broken. Skipping the film is a legitimate choice when it is asked for
    // this deliberately.
    else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      window.scrollTo(0, e.key === 'Home' ? 0 : limit())
      resync()
      active = false
      return
    }

    if (d === null) return
    e.preventDefault()
    push(d)
  }

  // A scroll we did not cause (scrollbar drag, anchor, find-in-page) should not
  // be fought — adopt it and carry on from there.
  const onScroll = () => {
    if (!active && Math.abs(window.scrollY - expected) > 2) resync()
  }

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll, { passive: true })

  /** Driven from the existing gsap ticker so the page has exactly one clock. */
  const tick = (deltaMs: number) => {
    if (!active) return
    const dt = Math.min(deltaMs, 50) / 1000

    if (Math.abs(window.scrollY - expected) > 2) {
      resync()
      active = false
      return
    }

    const cur = window.scrollY
    const diff = target - cur
    if (Math.abs(diff) < 0.5) {
      active = false
      return
    }

    const cap = MAX * dt
    const step = diff > cap ? cap : diff < -cap ? -cap : diff
    window.scrollTo(0, cur + step)
    expected = window.scrollY
  }

  return {
    tick,
    destroy() {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    },
  }
}
