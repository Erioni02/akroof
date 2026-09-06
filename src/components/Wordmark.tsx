import { site } from '@/data/site'

export default function Wordmark({
  size = 'sm',
  className = '',
}: {
  size?: 'sm' | 'lg'
  className?: string
}) {
  const mark = size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'

  return (
    <span className={'flex items-center gap-3 ' + className}>
      <img
        src="/brand/ak-logo.png"
        alt=""
        aria-hidden="true"
        width={100}
        height={100}
        className={'shrink-0 object-contain ' + mark}
      />
      <span className="flex flex-col leading-none">
        <span
          className={
            'font-medium tracking-tight text-bone ' +
            (size === 'lg' ? 'text-lg' : 'text-[0.9rem]')
          }
        >
          Roofing
          <span className="mx-1 font-light text-bone/50">&amp;</span>
          Gutters
        </span>
        <span className="mt-1.5 eyebrow text-[0.5rem] text-bone/45">
          {site.city}, {site.stateAbbr}
        </span>
      </span>
    </span>
  )
}
