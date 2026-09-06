import { Facebook, Instagram, Linkedin } from 'lucide-react'

import { credentials, seals, services, site, standards } from '@/data/site'
import CredentialMark from '@/components/CredentialMark'
import { Cta } from '@/components/ChapterLayers'
import Wordmark from '@/components/Wordmark'

const socials = [
  { Icon: Instagram, href: site.social.instagram, label: 'Instagram' },
  { Icon: Facebook, href: site.social.facebook, label: 'Facebook' },
  { Icon: Linkedin, href: site.social.linkedin, label: 'LinkedIn' },
]

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-bone/12 bg-ink px-[var(--edge)] pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-20 sm:pt-28">
      <div className="mx-auto max-w-[86rem]">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div>
            <Wordmark size="lg" />
            <p className="mt-8 max-w-[36ch] text-[clamp(1.15rem,2.4vw,1.6rem)] font-light leading-[1.35] tracking-tight text-bone/85">
              {site.descriptor} serving {site.city}, {site.state} and the
              surrounding area.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Cta href={site.quoteUrl}>Request a Free Quote</Cta>
              <Cta href={site.financingUrl} variant="ghost">
                Financing Available
              </Cta>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <h3 className="eyebrow mb-5 text-brass/80">Services</h3>
              <ul className="space-y-2.5">
                {services.map((s) => (
                  <li key={s.name} className="text-sm font-light text-bone/70">
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="eyebrow mb-5 text-brass/80">Credentials</h3>
              <ul className="space-y-2.5">
                {standards.map((s) => (
                  <li key={s} className="text-sm font-light text-bone/70">
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h3 className="eyebrow mb-5 text-brass/80">Contact</h3>
              <address className="space-y-2.5 not-italic">
                <p className="text-sm font-light text-bone/70">
                  {site.address.street}
                  <br />
                  {site.address.locality}
                </p>
                <p>
                  <a
                    href={site.phoneHref}
                    className="link-underline text-sm font-light text-bone/85"
                  >
                    {site.phone}
                  </a>
                </p>
                <p className="pt-1 text-sm font-light leading-relaxed text-bone/55">
                  {site.hours}
                </p>
              </address>

              <div className="mt-6 flex items-center gap-1">
                {socials.map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid h-10 w-10 place-items-center text-bone/50 transition-colors hover:text-bone"
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-x-10 gap-y-7 border-t border-bone/12 pt-10 sm:mt-20">
          {[...credentials, ...seals].map((m) => (
            <CredentialMark
              key={m.src}
              src={m.src}
              alt={m.name}
              scale={m.scale}
              base="2.5rem"
              className="opacity-70 transition-opacity duration-500 hover:opacity-100"
            />
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-bone/12 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="eyebrow text-bone/35">
            © {new Date().getFullYear()} {site.name}
          </p>
          <p className="eyebrow text-bone/35">
            License
            <span className="mx-2 text-brass/70">·</span>
            {site.license}
          </p>
        </div>
      </div>
    </footer>
  )
}
