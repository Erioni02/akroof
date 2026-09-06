import { useLayoutEffect, useRef, useState } from 'react'
import { Menu, Phone } from 'lucide-react'

import { bounds } from '@/data/chapters'
import { film } from '@/lib/filmStore'
import { range } from '@/lib/motion'
import { site } from '@/data/site'
import MobileMenu, { menuLinks } from '@/components/MobileMenu'
import Wordmark from '@/components/Wordmark'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const barRef = useRef<HTMLSpanElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    return film.subscribe((p) => {
      if (barRef.current) {
        barRef.current.style.transform = 'scaleX(' + p.toFixed(4) + ')'
      }
      // The header belongs to the film. Once the film has run out it retires
      // rather than floating over the footer, which carries its own wordmark,
      // both calls to action and the phone number.
      if (headerRef.current) {
        const o = 1 - range(p, 0.972, 0.999)
        headerRef.current.style.opacity = o.toFixed(3)
        headerRef.current.style.visibility = o < 0.02 ? 'hidden' : 'visible'
      }
    })
  }, [])

  return (
    <>
      <header
        ref={headerRef}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 transition-opacity duration-300"
      >
        {/* film progress — one hairline, the only chrome that is always on */}
        <span className="absolute inset-x-0 top-0 block h-px bg-bone/10">
          <span
            ref={barRef}
            className="block h-full origin-left bg-brass"
            style={{ transform: 'scaleX(0)' }}
          />
        </span>

        <div className="flex items-start justify-between px-[var(--edge)] pt-6 sm:pt-7">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="pointer-events-auto"
            aria-label={site.name + ' — back to start'}
          >
            <Wordmark />
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="pointer-events-auto hidden items-center gap-7 pr-4 lg:flex">
              {menuLinks.slice(1, 5).map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => film.scrollToChapter(l.chapter, bounds)}
                  className="eyebrow link-underline text-bone/60 transition-colors hover:text-bone"
                >
                  {l.label}
                </button>
              ))}
            </nav>

            <a
              href={site.phoneHref}
              className="pointer-events-auto hidden items-center gap-2.5 border border-bone/20 px-4 py-3 text-bone/80 transition-colors hover:border-bone/45 hover:text-bone sm:inline-flex"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="eyebrow">{site.phone}</span>
            </a>

            <a
              href={site.quoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto hidden bg-bone px-5 py-3 eyebrow text-ink transition-colors duration-500 hover:bg-brass sm:inline-block"
            >
              Free Quote
            </a>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="menu"
              className="pointer-events-auto grid h-11 w-11 place-items-center border border-bone/20 text-bone transition-colors hover:border-bone/50 lg:hidden"
            >
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  )
}
