import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Facebook, Instagram, Linkedin, Phone, X } from 'lucide-react'

import { bounds } from '@/data/chapters'
import { film } from '@/lib/filmStore'
import { site } from '@/data/site'
import { Cta } from '@/components/ChapterLayers'
import Wordmark from '@/components/Wordmark'

const CLOSE_MS = 620

export const menuLinks = [
  { label: 'The Rebuild', chapter: 2 },
  { label: 'Services', chapter: 3 },
  { label: 'The Storm', chapter: 4 },
  { label: 'The Standard', chapter: 6 },
  { label: 'Credentials', chapter: 7 },
  { label: 'Service Area', chapter: 8 },
] as const

const socials = [
  { Icon: Instagram, href: site.social.instagram, label: 'Instagram' },
  { Icon: Facebook, href: site.social.facebook, label: 'Facebook' },
  { Icon: Linkedin, href: site.social.linkedin, label: 'LinkedIn' },
]

export default function MobileMenu({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>('[data-menu-item]')

      const tl = gsap.timeline({ paused: true })
      tl.fromTo(
          panelRef.current,
          { clipPath: 'inset(0% 0% 100% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 0.78,
            ease: 'expo.inOut',
          },
        )
        .fromTo(
          items,
          { yPercent: 118, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.72,
            stagger: 0.055,
            ease: 'expo.out',
          },
          '-=0.42',
        )
        .fromTo(
          '[data-menu-tail]',
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'expo.out' },
          '-=0.42',
        )

      tlRef.current = tl
    }, rootRef)

    return () => ctx.revert()
  }, [])

  // Visibility is React state on a timer, never a GSAP callback: a missed
  // callback would leave a full-screen overlay swallowing every click.
  useEffect(() => {
    const tl = tlRef.current

    if (open) {
      setMounted(true)
      tl?.timeScale(1).play()
      document.body.dataset.locked = 'true'
      return
    }

    tl?.timeScale(1.7).reverse()
    document.body.dataset.locked = 'false'
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => () => {
    document.body.dataset.locked = 'false'
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const go = (chapter: number) => {
    onClose()
    // let the panel start closing before the page moves underneath it
    window.setTimeout(() => film.scrollToChapter(chapter, bounds), 340)
  }

  return (
    <div
      ref={rootRef}
      id="menu"
      aria-hidden={!open}
      className="fixed inset-0 z-[60] lg:hidden"
      style={{
        visibility: mounted ? 'visible' : 'hidden',
        pointerEvents: mounted ? 'auto' : 'none',
      }}
    >
      <div
        ref={panelRef}
        className="flex h-full w-full flex-col bg-ink"
        style={{ clipPath: 'inset(0% 0% 100% 0%)' }}
      >
        <div className="flex items-center justify-between px-[var(--edge)] pt-7">
          <Wordmark />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-11 w-11 place-items-center border border-bone/20 text-bone transition-colors hover:border-bone/50"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col justify-center px-[var(--edge)]">
          <ul>
            {menuLinks.map((l, i) => (
              <li key={l.label} className="overflow-hidden">
                <button
                  data-menu-item
                  type="button"
                  onClick={() => go(l.chapter)}
                  className="flex w-full items-baseline gap-5 py-[0.55rem] text-left"
                >
                  <span className="eyebrow w-6 text-[0.55rem] text-brass/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="display text-[clamp(2rem,10vw,3.2rem)] text-bone">
                    {l.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-[var(--edge)] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div data-menu-tail className="mb-6 h-px w-full rule" />

          <div data-menu-tail className="mb-7 flex flex-col gap-3">
            <Cta href={site.quoteUrl} className="justify-center">
              Request a Free Quote
            </Cta>
            <Cta href={site.financingUrl} variant="ghost" className="justify-center">
              Financing Available
            </Cta>
          </div>

          <div
            data-menu-tail
            className="flex items-center justify-between gap-4"
          >
            <a
              href={site.phoneHref}
              className="inline-flex items-center gap-2.5 text-bone/75"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="text-sm font-light tracking-wide">{site.phone}</span>
            </a>
            <div className="flex items-center gap-1">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center text-bone/55 transition-colors hover:text-bone"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
