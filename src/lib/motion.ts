export const clamp = (v: number, min = 0, max = 1) =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** map v from [a,b] to [0,1], clamped */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a))

/** frame-rate independent damping factor */
export const damp = (factor: number, dt: number) =>
  1 - Math.pow(1 - factor, dt * 60)

export const easeOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)

export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)

export const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

/**
 * The shared entrance/exit envelope every chapter layer rides.
 * `t` is un-clamped local chapter progress, so layers pre-roll and post-roll
 * slightly past their own chapter for a soft cross-dissolve at the seam.
 */
export type Envelope = { o: number; y: number; blur: number }

export function envelope(t: number, opts?: { in?: number; out?: number }): Envelope {
  const inEnd = opts?.in ?? 0.2
  const outStart = opts?.out ?? 0.78

  const rise = easeOutQuint(range(t, -0.06, inEnd))
  const fall = 1 - easeInOutQuad(range(t, outStart, 1.06))
  const o = rise * fall

  // travel up through the whole chapter, so type drifts like a camera move
  const y = lerp(26, -26, clamp(t, -0.1, 1.1))
  const blur = (1 - rise) * 7 + (1 - fall) * 5

  return { o, y, blur }
}

/** per-item stagger inside a layer */
export function staggered(t: number, i: number, step = 0.045, span = 0.16) {
  return easeOutExpo(range(t, i * step, i * step + span))
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
