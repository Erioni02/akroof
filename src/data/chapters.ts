/**
 * The film is 30.000s @ 30fps. These in/out points were read off the source
 * footage frame by frame — hard cuts land at 4.000s, 19.633s and 23.133s.
 *
 * `weight` is the share of the scroll track a chapter occupies. It is
 * deliberately NOT proportional to its duration: the credential wall is only
 * 1.3s of footage but needs room to be read, while the storm holds itself.
 */
export type Chapter = {
  id: string
  index: number
  /** roman-ish label shown in the rail */
  num: string
  label: string
  /** video in/out in seconds */
  in: number
  out: number
  /** scroll share */
  weight: number
  /** how the footage itself is treated behind the type */
  treatment: 'clear' | 'atmosphere'
}

const raw: Omit<Chapter, 'index'>[] = [
  { id: 'home',      num: '01', label: 'The House',     in: 0.0,    out: 2.10,   weight: 1.30, treatment: 'clear' },
  { id: 'reveal',    num: '02', label: 'The Reveal',    in: 2.10,   out: 4.10,   weight: 1.05, treatment: 'clear' },
  { id: 'rebuild',   num: '03', label: 'The Rebuild',   in: 4.10,   out: 6.10,   weight: 1.05, treatment: 'clear' },
  { id: 'exterior',  num: '04', label: 'The Exterior',  in: 6.10,   out: 10.20,  weight: 1.60, treatment: 'clear' },
  { id: 'storm',     num: '05', label: 'The Storm',     in: 10.20,  out: 13.00,  weight: 1.05, treatment: 'clear' },
  { id: 'proof',     num: '06', label: 'The Proof',     in: 13.00,  out: 19.633, weight: 1.55, treatment: 'clear' },
  { id: 'standard',  num: '07', label: 'The Standard',  in: 19.633, out: 21.90,  weight: 1.25, treatment: 'atmosphere' },
  { id: 'certified', num: '08', label: 'Credentials',   in: 21.90,  out: 23.133, weight: 1.20, treatment: 'atmosphere' },
  { id: 'territory', num: '09', label: 'The Territory', in: 23.133, out: 25.35,  weight: 1.20, treatment: 'atmosphere' },
  { id: 'return',    num: '10', label: 'The Return',    in: 25.35,  out: 27.30,  weight: 0.95, treatment: 'clear' },
  { id: 'hero',      num: '11', label: 'AK',            in: 27.30,  out: 29.94,  weight: 1.60, treatment: 'clear' },
]

export const chapters: Chapter[] = raw.map((c, index) => ({ ...c, index }))

const total = chapters.reduce((s, c) => s + c.weight, 0)

/** cumulative scroll boundaries, 0..1 */
export const bounds: { start: number; end: number }[] = (() => {
  let acc = 0
  return chapters.map((c) => {
    const start = acc / total
    acc += c.weight
    return { start, end: acc / total }
  })
})()

/** Map scroll progress 0..1 → video time in seconds (piecewise linear). */
export function progressToTime(p: number): number {
  const x = p <= 0 ? 0 : p >= 1 ? 1 : p
  for (let i = 0; i < chapters.length; i++) {
    const b = bounds[i]
    if (x <= b.end || i === chapters.length - 1) {
      const local = (x - b.start) / (b.end - b.start)
      const c = chapters[i]
      return c.in + (c.out - c.in) * Math.min(1, Math.max(0, local))
    }
  }
  return 0
}

/** Local 0..1 progress inside a chapter, un-clamped so layers can pre/post roll. */
export function localProgress(p: number, i: number): number {
  const b = bounds[i]
  return (p - b.start) / (b.end - b.start)
}

export function chapterAt(p: number): number {
  for (let i = 0; i < bounds.length; i++) {
    if (p < bounds[i].end) return i
  }
  return bounds.length - 1
}

export const VIDEO_DURATION = 29.95
