import { chapterAt } from '@/data/chapters'

type Listener = (p: number) => void

/**
 * A single imperative source of truth for scroll position.
 *
 * Layers subscribe and write styles directly in the ticker — React never
 * re-renders per frame. Only the active chapter index, which changes a handful
 * of times per visit, is exposed as reactive state for the navigation.
 */
class FilmStore {
  /** raw scroll progress from ScrollTrigger, 0..1 */
  raw = 0
  /** damped progress that actually drives the film, 0..1 */
  smooth = 0

  private listeners = new Set<Listener>()
  private chapterListeners = new Set<() => void>()
  private loadListeners = new Set<Listener>()

  /** 0..100, buffered share of the film — kept out of React so the loader
   *  never re-renders (and never stomps on GSAP's inline styles) mid-animation */
  loadPct = 0

  setLoad(pct: number) {
    if (pct <= this.loadPct) return
    this.loadPct = pct
    for (const fn of this.loadListeners) fn(pct)
  }

  subscribeLoad(fn: Listener) {
    this.loadListeners.add(fn)
    fn(this.loadPct)
    return () => {
      this.loadListeners.delete(fn)
    }
  }

  private _active = 0
  /** the scroll track element, set by FilmStage */
  track: HTMLElement | null = null

  emit(p: number) {
    this.smooth = p
    for (const fn of this.listeners) fn(p)

    const next = chapterAt(p)
    if (next !== this._active) {
      this._active = next
      for (const fn of this.chapterListeners) fn()
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.smooth)
    return () => {
      this.listeners.delete(fn)
    }
  }

  subscribeChapter = (fn: () => void) => {
    this.chapterListeners.add(fn)
    return () => {
      this.chapterListeners.delete(fn)
    }
  }

  getActive = () => this._active

  /** scroll so that chapter `i` sits at the start of its own scroll window */
  scrollToChapter(i: number, boundsList: { start: number }[]) {
    const track = this.track
    if (!track) return
    const top = track.offsetTop
    const distance = track.offsetHeight - window.innerHeight
    // a nudge past the boundary so the chapter's type has begun to resolve
    const target = top + distance * (boundsList[i].start + 0.012)
    window.scrollTo({ top: target, behavior: 'smooth' })
  }
}

export const film = new FilmStore()
