import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

import { film } from '@/lib/filmStore'
import { site } from '@/data/site'

const LINE_OUT = 620
const LINE_STAGGER = 60
const CURTAIN_DELAY = 260
const CURTAIN_OUT = 900

/**
 * The title card. It holds the page until the film has enough data to be
 * scrubbed, then lifts like a shutter.
 *
 * The exit is plain CSS rather than GSAP on purpose: this component is the one
 * thing on the page that must never be able to get stuck.
 */
export default function Loader({
  done,
  onExit,
}: {
  done: boolean
  onExit: () => void
}) {
  const barRef = useRef<HTMLSpanElement>(null)
  const [leaving, setLeaving] = useState(false)

  // The bar reads straight from the store, so this component renders twice in
  // its whole life — once on mount, once when it starts leaving.
  useLayoutEffect(() => {
    let shown = 0
    let target = 0
    const unsubscribe = film.subscribeLoad((p) => {
      target = p
    })
    const tick = () => {
      shown += (target - shown) * 0.07
      if (barRef.current) {
        barRef.current.style.transform = 'scaleX(' + (shown / 100).toFixed(4) + ')'
      }
    }
    gsap.ticker.add(tick)
    return () => {
      unsubscribe()
      gsap.ticker.remove(tick)
    }
  }, [])

  useEffect(() => {
    if (!done) return
    const start = window.setTimeout(() => setLeaving(true), 320)
    const finish = window.setTimeout(
      onExit,
      320 + CURTAIN_DELAY + CURTAIN_OUT + 60,
    )
    return () => {
      clearTimeout(start)
      clearTimeout(finish)
    }
  }, [done, onExit])

  const lines = [
    <p key="place" className="eyebrow text-bone/45">
      {site.city}, {site.state}
    </p>,
  ]

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-between bg-ink px-[var(--edge)] py-[max(2rem,7svh)]"
      style={{
        clipPath: leaving ? 'inset(0% 0% 100% 0%)' : 'inset(0% 0% 0% 0%)',
        transition: `clip-path ${CURTAIN_OUT}ms cubic-bezier(0.76, 0, 0.24, 1) ${CURTAIN_DELAY}ms`,
      }}
    >
      <Line leaving={leaving} i={0}>
        {lines[0]}
      </Line>

      <div>
        <Line leaving={leaving} i={1}>
          <h1 className="display text-[clamp(2rem,7vw,4.6rem)] text-bone">
            AK Roofing <span className="font-light text-bone/45">&amp;</span> Gutters
          </h1>
        </Line>

        <div className="mt-8 flex items-end justify-between gap-8">
          <Line leaving={leaving} i={2} className="min-w-0 flex-1">
            <span className="block h-px w-full bg-bone/15">
              <span
                ref={barRef}
                className="block h-full origin-left bg-brass"
                style={{ transform: 'scaleX(0)' }}
              />
            </span>
          </Line>
          <Line leaving={leaving} i={3} className="shrink-0">
            <span className="eyebrow block whitespace-nowrap text-bone/45">
              Loading the film
            </span>
          </Line>
        </div>
      </div>
    </div>
  )
}

function Line({
  leaving,
  i,
  className = '',
  children,
}: {
  leaving: boolean
  i: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={'overflow-hidden ' + className}>
      <div
        style={{
          transform: leaving ? 'translateY(-118%)' : 'translateY(0)',
          opacity: leaving ? 0 : 1,
          transition:
            `transform ${LINE_OUT}ms cubic-bezier(0.7, 0, 0.84, 0) ${i * LINE_STAGGER}ms,` +
            `opacity ${LINE_OUT}ms linear ${i * LINE_STAGGER}ms`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
