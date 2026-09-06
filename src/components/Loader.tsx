import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

import { film } from '@/lib/filmStore'
import { site } from '@/data/site'

const LINE_OUT = 620
const LINE_STAGGER = 60
const CURTAIN_DELAY = 260
const CURTAIN_OUT = 900

/** never hold the curtain longer than this waiting for the bar to catch up */
const SETTLE_CAP = 900

/**
 * The title card. It holds the page until the film can be scrubbed, then lifts
 * like a shutter.
 *
 * The bar reports real bytes (see FilmStage), and it always finishes: when the
 * film becomes ready the bar runs to 100 and only then does the curtain move.
 * An earlier version lifted the moment the video reported "playable", which
 * left the bar stranded around 15% and made the whole thing look fake.
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
  const pctRef = useRef<HTMLSpanElement>(null)
  const [leaving, setLeaving] = useState(false)

  const doneRef = useRef(false)
  doneRef.current = done
  const startedExit = useRef(false)

  // The bar reads straight from the store, so this component renders twice in
  // its whole life — once on mount, once when it starts leaving.
  useLayoutEffect(() => {
    let shown = 0
    let target = 0
    let readyAt = 0
    let lastPrinted = -1

    const unsubscribe = film.subscribeLoad((p) => {
      target = p
    })

    const tick = () => {
      // ease harder as it approaches, so the last stretch does not crawl
      shown += (target - shown) * (doneRef.current ? 0.16 : 0.07)
      if (target - shown < 0.4) shown = target

      if (barRef.current) {
        barRef.current.style.transform = 'scaleX(' + (shown / 100).toFixed(4) + ')'
      }
      if (pctRef.current) {
        const n = Math.min(100, Math.floor(shown))
        if (n !== lastPrinted) {
          lastPrinted = n
          pctRef.current.textContent = String(n)
        }
      }

      // hand over only once the bar has actually finished — or given up waiting
      if (doneRef.current && !startedExit.current) {
        if (!readyAt) readyAt = performance.now()
        const settled = shown >= 99.4
        const waited = performance.now() - readyAt > SETTLE_CAP
        if (settled || waited) {
          startedExit.current = true
          setLeaving(true)
        }
      }
    }

    gsap.ticker.add(tick)
    return () => {
      unsubscribe()
      gsap.ticker.remove(tick)
    }
  }, [])

  useEffect(() => {
    if (!leaving) return
    const finish = window.setTimeout(onExit, CURTAIN_DELAY + CURTAIN_OUT + 60)
    return () => clearTimeout(finish)
  }, [leaving, onExit])

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-between bg-ink px-[var(--edge)] py-[max(2rem,7svh)]"
      style={{
        clipPath: leaving ? 'inset(0% 0% 100% 0%)' : 'inset(0% 0% 0% 0%)',
        transition: `clip-path ${CURTAIN_OUT}ms cubic-bezier(0.76, 0, 0.24, 1) ${CURTAIN_DELAY}ms`,
      }}
    >
      <Line leaving={leaving} i={0}>
        <p className="eyebrow text-bone/45">
          {site.city}, {site.state}
        </p>
      </Line>

      <div>
        <Line leaving={leaving} i={1}>
          <h1 className="display text-[clamp(2rem,7vw,4.6rem)] text-bone">
            AK Roofing <span className="font-light text-bone/45">&amp;</span> Gutters
          </h1>
        </Line>

        <div className="mt-8 flex items-end justify-between gap-6 sm:gap-10">
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
            <span className="eyebrow flex items-baseline gap-3 whitespace-nowrap text-bone/45">
              <span className="hidden xs:inline">Loading the film</span>
              <span className="inline-flex justify-end tabular-nums text-bone/85 [min-width:2.6ch]">
                <span ref={pctRef}>0</span>
              </span>
              <span className="text-bone/45">%</span>
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
