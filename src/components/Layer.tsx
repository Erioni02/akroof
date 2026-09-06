import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

import { localProgress } from '@/data/chapters'
import { film } from '@/lib/filmStore'
import { envelope, prefersReducedMotion, staggered } from '@/lib/motion'

type Reg = { el: HTMLElement; order: number; dy: number; blur: boolean }
type Register = (reg: Reg) => () => void

const LayerCtx = createContext<Register | null>(null)

/** entrance lead, in chapter-progress units */
const LEAD = 0.13

/** where the type sits in the frame — chosen per chapter against the footage */
export type Place =
  | 'top-left'
  | 'top-right'
  | 'mid-left'
  | 'mid-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'

const placement: Record<Place, string> = {
  'top-left': 'items-start justify-start text-left',
  'top-right': 'items-start justify-end text-right',
  'mid-left': 'items-center justify-start text-left',
  'mid-right': 'items-center justify-end text-right',
  center: 'items-center justify-center text-center',
  'bottom-left': 'items-end justify-start text-left',
  'bottom-right': 'items-end justify-end text-right',
  'bottom-center': 'items-end justify-center text-center',
}

type LayerProps = {
  /** chapter index this layer belongs to */
  index: number
  place?: Place
  /** narrower measure for long body copy */
  width?: string
  className?: string
  children: ReactNode
  /** slow the drift for layers that should feel anchored */
  drift?: number
  /**
   * Floor for the stagger clock. The opening chapter sits at scroll zero, so
   * its type must already be composed when the curtain lifts; children never
   * un-reveal, the layer's own opacity handles the exit.
   */
  openAt?: number
}

/**
 * One chapter's UI. Subscribes straight to the scroll store and writes styles
 * in the ticker — no React render happens while you scroll.
 */
export function Layer({
  index,
  place = 'bottom-left',
  width = 'max-w-[min(46rem,92vw)]',
  className = '',
  drift = 1,
  openAt = 0,
  children,
}: LayerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const regs = useRef<Reg[]>([])

  const register = useMemo<Register>(
    () => (reg) => {
      regs.current.push(reg)
      regs.current.sort((a, b) => a.order - b.order)
      return () => {
        regs.current = regs.current.filter((r) => r !== reg)
      }
    },
    [],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduced = prefersReducedMotion()

    let visible = true
    return film.subscribe((p) => {
      // LEAD pulls the entrance forward so a chapter's type has already
      // resolved by the time its footage is on screen — and so the very first
      // frame of the film is legible at rest, before anyone has scrolled.
      const t = localProgress(p, index) + LEAD
      const env = envelope(t)

      const show = env.o > 0.004
      if (show !== visible) {
        visible = show
        root.style.visibility = show ? 'visible' : 'hidden'
      }
      if (!show) return

      root.style.opacity = env.o.toFixed(3)
      root.style.transform = reduced
        ? 'none'
        : 'translate3d(0,' + (env.y * drift).toFixed(2) + 'px,0)'

      const st = t > openAt ? t : openAt
      for (const r of regs.current) {
        const s = staggered(st, r.order)
        r.el.style.opacity = s.toFixed(3)
        if (reduced) continue
        r.el.style.transform = 'translate3d(0,' + ((1 - s) * r.dy).toFixed(2) + 'px,0)'
        if (r.blur) {
          const b = (1 - s) * 5
          r.el.style.filter = b > 0.05 ? 'blur(' + b.toFixed(2) + 'px)' : 'none'
        }
      }
    })
  }, [index, drift, openAt])

  return (
    <LayerCtx.Provider value={register}>
      <div ref={rootRef} className="layer" style={{ opacity: 0 }}>
        <div className={'layer-inner flex ' + placement[place]}>
          <div
            className={
              'w-full py-[max(6.5rem,14svh)] ' + width + ' ' + className
            }
          >
            {children}
          </div>
        </div>
      </div>
    </LayerCtx.Provider>
  )
}

type RevealProps = {
  order?: number
  dy?: number
  blur?: boolean
  as?: 'div' | 'p' | 'h2' | 'h3' | 'span' | 'ul' | 'li'
  className?: string
  children: ReactNode
  style?: React.CSSProperties
}

/** A single staggered element inside a Layer. */
export function Reveal({
  order = 0,
  dy = 22,
  blur = false,
  as: Tag = 'div',
  className = '',
  style,
  children,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const register = useContext(LayerCtx)

  useLayoutEffect(() => {
    if (!ref.current || !register) return
    return register({ el: ref.current, order, dy, blur })
  }, [register, order, dy, blur])

  return (
    // @ts-expect-error – polymorphic ref
    <Tag ref={ref} className={className} style={{ opacity: 0, ...style }}>
      {children}
    </Tag>
  )
}

/** The chapter marker: number, hairline, name. Used identically all film long. */
export function Marker({
  num,
  label,
  order = 0,
  align = 'left',
}: {
  num: string
  label: string
  order?: number
  align?: 'left' | 'right'
}) {
  return (
    <Reveal order={order} dy={12} className="mb-6 sm:mb-8">
      <span
        className={
          'eyebrow inline-flex items-center gap-4 text-bone/55 ' +
          (align === 'right' ? 'flex-row-reverse' : '')
        }
      >
        <span className="text-brass">{num}</span>
        <span className="h-px w-10 bg-bone/25 sm:w-16" />
        <span>{label}</span>
      </span>
    </Reveal>
  )
}
