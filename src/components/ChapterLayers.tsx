import { ArrowDown, ArrowUpRight, Phone } from 'lucide-react'

import { chapters } from '@/data/chapters'
import { credentials, seals, services, site } from '@/data/site'
import CredentialMark from '@/components/CredentialMark'
import MapPanel from '@/components/MapPanel'
import { Layer, Marker, Reveal } from '@/components/Layer'

/* ------------------------------------------------------------------ atoms */

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="display text-balance text-[clamp(1.85rem,4.4vw,3.5rem)]">
    {children}
  </h2>
)

const Body = ({ children }: { children: React.ReactNode }) => (
  <p className="max-w-[38ch] text-[clamp(0.92rem,1.32vw,1.06rem)] font-light leading-[1.62] text-bone/70">
    {children}
  </p>
)

export function Cta({
  href,
  children,
  variant = 'solid',
  className = '',
}: {
  href: string
  children: React.ReactNode
  variant?: 'solid' | 'ghost'
  className?: string
}) {
  const base =
    'group pointer-events-auto relative inline-flex items-center gap-3 overflow-hidden px-6 py-4 eyebrow transition-colors duration-500 sm:px-8'
  const skin =
    variant === 'solid'
      ? 'bg-bone text-ink hover:text-bone'
      : 'border border-bone/25 text-bone hover:text-ink'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={base + ' ' + skin + ' ' + className}
    >
      <span
        aria-hidden
        className={
          'absolute inset-0 origin-bottom scale-y-0 transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100 ' +
          (variant === 'solid' ? 'bg-ink' : 'bg-bone')
        }
      />
      <span className="relative">{children}</span>
      <ArrowUpRight
        className="relative h-4 w-4 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
        strokeWidth={1.5}
      />
    </a>
  )
}

/* ------------------------------------------------------------- 01 the house */

function ChHouse() {
  return (
    <Layer index={0} place="bottom-left" width="max-w-[min(38rem,92vw)]" openAt={0.62}>
      <Reveal order={0} dy={10} className="eyebrow mb-7 text-bone/55">
        {site.city}, {site.state}
      </Reveal>

      <Reveal order={1} dy={34} blur>
        <h1 className="display text-[clamp(2.1rem,5.2vw,4.05rem)]">
          Everything you love
          <br />
          lives under <span className="accent text-brass">one roof</span>.
        </h1>
      </Reveal>

      <Reveal order={2} dy={18} className="mt-7">
        <p className="max-w-[36ch] text-sm font-light leading-relaxed text-bone/70">
          Roofing, gutters and exteriors, built for the weather that actually
          shows up in {site.city}.
        </p>
      </Reveal>

      <Reveal order={3} dy={14} className="mt-9 flex items-center gap-3">
        <ArrowDown className="h-3.5 w-3.5 animate-bounce text-brass" strokeWidth={1.5} />
        <span className="eyebrow text-bone/50">Scroll to begin the film</span>
      </Reveal>
    </Layer>
  )
}

/* ------------------------------------------------------------ 02 the reveal */

function ChReveal() {
  const c = chapters[1]
  return (
    <Layer index={1} place="top-right" width="max-w-[min(40rem,92vw)]">
      <div className="pt-[max(4rem,6svh)]">
        <Marker num={c.num} label={c.label} order={0} align="right" />
        <Reveal order={1} dy={28} blur>
          <H>
            We start where
            <br />
            nobody looks.
          </H>
        </Reveal>
        <Reveal order={3} dy={18} className="mt-7 flex justify-end">
          <Body>
            Decking, underlayment, ventilation, flashing. The layers you will
            never see are the ones that decide how long the layer you do see
            lasts.
          </Body>
        </Reveal>
      </div>
    </Layer>
  )
}

/* ----------------------------------------------------------- 03 the rebuild */

function ChRebuild() {
  const c = chapters[2]
  return (
    <Layer index={2} place="bottom-left" width="max-w-[min(42rem,92vw)]">
      <Marker num={c.num} label={c.label} order={0} />
      <Reveal order={1} dy={28} blur>
        <H>Rebuilt to the deck.</H>
      </Reveal>
      <Reveal order={3} dy={18} className="mt-7">
        <Body>
          Not a surface repair dressed up as a roof. Every course set to the
          manufacturer's specification — which is the only condition under which
          a manufacturer's warranty means anything at all.
        </Body>
      </Reveal>
    </Layer>
  )
}

/* ---------------------------------------------------------- 04 the exterior */

function ChExterior() {
  const c = chapters[3]
  return (
    <Layer index={3} place="mid-right" width="max-w-[min(34rem,92vw)]">
      <Marker num={c.num} label={c.label} order={0} align="right" />
      <Reveal order={1} dy={26} blur>
        <h2 className="display text-balance text-[clamp(1.9rem,5vw,3.6rem)]">
          A roof is half
          <br />
          the <span className="accent text-brass">envelope</span>.
        </h2>
      </Reveal>

      <ul className="mt-9 border-t border-bone/12">
        {services.map((s, i) => (
          <Reveal
            key={s.name}
            as="li"
            order={2 + i * 0.55}
            dy={16}
            className="flex items-baseline justify-end gap-5 border-b border-bone/12 py-[0.72rem]"
          >
            <span className="eyebrow text-brass/80">{s.n}</span>
            <span className="text-[clamp(1rem,1.9vw,1.35rem)] font-light tracking-tight">
              {s.name}
            </span>
          </Reveal>
        ))}
      </ul>
    </Layer>
  )
}

/* ------------------------------------------------------------- 05 the storm */

function ChStorm() {
  const c = chapters[4]
  return (
    <Layer index={4} place="top-left" width="max-w-[min(44rem,92vw)]">
      <div className="pt-[max(4rem,6svh)]">
        <Marker num={c.num} label={c.label} order={0} />
        <Reveal order={1} dy={30} blur>
          <H>
            Illinois does not
            <br />
            negotiate.
          </H>
        </Reveal>
        <Reveal order={3} dy={18} className="mt-7">
          <Body>
            Wind, hail, freeze and thaw arrive on their own schedule. A roof is
            never judged on the day it is finished. It is judged on the worst
            night of the year.
          </Body>
        </Reveal>
      </div>
    </Layer>
  )
}

/* ------------------------------------------------------------- 06 the proof */

function ChProof() {
  const c = chapters[5]
  return (
    <Layer index={5} place="bottom-right" width="max-w-[min(42rem,92vw)]">
      <Marker num={c.num} label={c.label} order={0} align="right" />
      <Reveal order={1} dy={28} blur>
        <H>
          Water has one job.
          <br />
          We give it <span className="accent text-brass">one path</span>.
        </H>
      </Reveal>
      <Reveal order={3} dy={18} className="mt-7 flex justify-end">
        <Body>
          Roof, gutters, soffit and fascia are one water system. Installed
          together, they carry a storm off the house and away from the
          foundation — instead of into it.
        </Body>
      </Reveal>
      <Reveal
        order={5}
        dy={14}
        className="mt-8 flex items-center justify-end gap-4"
      >
        <span className="h-px w-12 bg-brass/50" />
        <span className="eyebrow text-brass">100% Guarantee</span>
      </Reveal>
    </Layer>
  )
}

/* ---------------------------------------------------------- 07 the standard */

function ChStandard() {
  const c = chapters[6]
  return (
    <Layer index={6} place="center" width="max-w-[min(58rem,94vw)]" drift={0.6}>
      <div className="flex flex-col items-center">
        <Marker num={c.num} label={c.label} order={0} />
        <Reveal order={1} dy={26} blur>
          <h2 className="display text-balance text-[clamp(2rem,5.6vw,4.4rem)]">
            Licensed. Insured. Bonded.
          </h2>
        </Reveal>

        <div className="mt-11 flex flex-wrap items-center justify-center gap-x-10 gap-y-8 sm:gap-x-16">
          {seals.map((seal, i) => (
            <Reveal key={seal.src} order={2.4 + i * 0.6} dy={18}>
              <CredentialMark
                src={seal.src}
                alt={seal.name}
                scale={seal.scale}
                base="5.6rem"
              />
            </Reveal>
          ))}
        </div>

        <Reveal order={4} dy={12} className="mt-11">
          <p className="eyebrow text-bone/45">
            Illinois Roofing License
            <span className="mx-3 text-brass">·</span>
            <span className="text-bone/85">{site.license}</span>
          </p>
        </Reveal>
      </div>
    </Layer>
  )
}

/* -------------------------------------------------------- 08 credentials */

function ChCertified() {
  const c = chapters[7]
  return (
    <Layer index={7} place="center" width="max-w-[min(66rem,94vw)]" drift={0.6}>
      <div className="flex flex-col items-center">
        <Marker num={c.num} label={c.label} order={0} />
        <Reveal order={1} dy={24} blur>
          <h2 className="display text-balance text-[clamp(1.8rem,4.8vw,3.6rem)]">
            Manufacturer-certified installers.
          </h2>
        </Reveal>

        <ul className="mt-12 grid w-full grid-cols-2 gap-x-8 gap-y-11 sm:gap-x-12 lg:grid-cols-4">
          {credentials.map((cr, i) => (
            <Reveal
              key={cr.name}
              as="li"
              order={2.4 + i * 0.6}
              dy={18}
              className="flex flex-col items-center gap-4 text-center"
            >
              <span className="flex h-[clamp(3rem,7.4vw,4.6rem)] items-center justify-center">
                <CredentialMark
                  src={cr.src}
                  alt={cr.name}
                  scale={cr.scale}
                  base="3.4rem"
                />
              </span>
              <span className="eyebrow text-[0.55rem] text-brass/85">
                {cr.qualifier}
              </span>
            </Reveal>
          ))}
        </ul>

        <Reveal order={5.4} dy={12} className="mt-11">
          <p className="max-w-[46ch] text-center text-xs font-light leading-relaxed text-bone/45">
            Certifications are granted by the manufacturer, not claimed by the
            contractor. They are what allow the full factory warranty to be
            written on your roof.
          </p>
        </Reveal>
      </div>
    </Layer>
  )
}

/* --------------------------------------------------------- 09 the territory */

function ChTerritory() {
  const c = chapters[8]
  return (
    <Layer index={8} place="center" width="max-w-[min(72rem,94vw)]" drift={0.7}>
      <div className="grid items-center gap-7 sm:gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
        <div className="text-left">
          <Marker num={c.num} label={c.label} order={0} />
          <Reveal order={1} dy={26} blur>
            <h2 className="display text-balance text-[clamp(1.85rem,4.4vw,3.5rem)]">
              {site.city},
              <br />
              and the streets around it.
            </h2>
          </Reveal>

          <dl className="mt-7 grid grid-cols-2 gap-x-7 gap-y-6 sm:mt-9 sm:gap-y-8 sm:gap-x-10">
            <Reveal order={2.6} dy={16} className="col-span-2 sm:col-span-1">
              <dt className="eyebrow mb-3 text-brass/80">Address</dt>
              <dd className="text-[0.95rem] font-light leading-relaxed text-bone/85">
                {site.address.street}
                <br />
                {site.address.locality}
              </dd>
            </Reveal>
            <Reveal order={3.1} dy={16}>
              <dt className="eyebrow mb-3 text-brass/80">Hours</dt>
              <dd className="text-[0.95rem] font-light leading-relaxed text-bone/85">
                Monday – Saturday
                <br />
                7:00 AM – 6:00 PM
              </dd>
            </Reveal>
            <Reveal order={3.6} dy={16}>
              <dt className="eyebrow mb-3 text-brass/80">Telephone</dt>
              <dd>
                <a
                  href={site.phoneHref}
                  className="pointer-events-auto text-[0.95rem] font-light leading-relaxed text-bone/85 transition-colors hover:text-bone"
                >
                  {site.phone}
                </a>
              </dd>
            </Reveal>
          </dl>
        </div>

        <Reveal order={4.2} dy={22}>
          <MapPanel />
        </Reveal>
      </div>
    </Layer>
  )
}

/* ------------------------------------------------------------ 10 the return */

function ChReturn() {
  const c = chapters[9]
  return (
    <Layer index={9} place="bottom-right" width="max-w-[min(38rem,92vw)]">
      <Marker num={c.num} label={c.label} order={0} align="right" />
      <Reveal order={1} dy={26} blur>
        <H>
          Then you forget
          <br />
          it is <span className="accent text-brass">there</span>.
        </H>
      </Reveal>
      <Reveal order={3} dy={16} className="mt-6">
        <p className="text-sm font-light text-bone/60">Which is the entire point.</p>
      </Reveal>
    </Layer>
  )
}

/* -------------------------------------------------------------- 11 the hero */

function ChHero() {
  return (
    <Layer index={10} place="center" width="max-w-[min(60rem,94vw)]" drift={0.5}>
      <div className="flex flex-col items-center">
        <Reveal order={0} dy={14} className="eyebrow mb-8 text-bone/50">
          Est. in {site.city}, {site.stateAbbr}
        </Reveal>

        <Reveal order={0.8} dy={30} blur>
          <h2 className="display text-balance text-[clamp(2.4rem,7.4vw,6.2rem)]">
            Let's start with
            <br />
            your <span className="accent text-brass">roof</span>.
          </h2>
        </Reveal>

        <Reveal order={2.6} dy={20} className="mt-10 flex flex-wrap justify-center gap-3">
          <Cta href={site.quoteUrl}>Request a Free Quote</Cta>
          <Cta href={site.financingUrl} variant="ghost">
            Financing Available
          </Cta>
        </Reveal>

        <Reveal order={4} dy={14} className="mt-9">
          <a
            href={site.phoneHref}
            className="pointer-events-auto inline-flex items-center gap-3 text-bone/65 transition-colors hover:text-bone"
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="text-[0.95rem] font-light tracking-wide">
              {site.phone}
            </span>
          </a>
        </Reveal>
      </div>
    </Layer>
  )
}

/* ---------------------------------------------------------------- assembly */

export default function ChapterLayers() {
  return (
    <>
      <ChHouse />
      <ChReveal />
      <ChRebuild />
      <ChExterior />
      <ChStorm />
      <ChProof />
      <ChStandard />
      <ChCertified />
      <ChTerritory />
      <ChReturn />
      <ChHero />
    </>
  )
}
