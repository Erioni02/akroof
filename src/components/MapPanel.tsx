import { map, site } from '@/data/site'
import { useActiveChapter } from '@/hooks/useActiveChapter'

/**
 * The Oakbrook Terrace listing.
 *
 * Three deliberate constraints:
 *
 *  - It mounts only once the film reaches the credentials passage. Google Maps
 *    is a third-party frame; loading it at page load would cost the opening
 *    scroll and phone home before the visitor has asked to see a map.
 *  - The frame is `pointer-events: none`. A live map inside a scroll-driven
 *    film would swallow the wheel and zoom instead of scrolling, so the whole
 *    panel is a single link out to the real listing.
 *  - Nothing is drawn over the lower strip. Google's attribution lives there
 *    and has to stay legible; the address sits in the column beside the map
 *    rather than on top of it.
 */
export default function MapPanel() {
  const active = useActiveChapter()
  // once armed it stays mounted: remounting would reload the frame
  const armed = active >= 6

  return (
    <a
      href={map.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group pointer-events-auto relative block aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[5/4]"
      aria-label={
        'Open ' + site.name + ', ' + site.address.locality + ', on Google Maps'
      }
    >
      {armed && (
        <iframe
          src={map.embed}
          title={site.name + ' location'}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          style={{
            // Google only serves the light map to unauthenticated embeds; this
            // is the standard inversion that puts it in the film's register.
            filter:
              'invert(0.94) hue-rotate(180deg) saturate(0.5) brightness(0.92) contrast(0.95)',
          }}
        />
      )}

      {/* keeps the panel inside the grade, and lifts on hover */}
      <span
        aria-hidden
        className="absolute inset-0 bg-ink/20 transition-colors duration-500 group-hover:bg-ink/0"
      />
    </a>
  )
}
