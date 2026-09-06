/**
 * A certification mark, presented bare.
 *
 * No plate, no border, no tinted panel behind it — the marks sit directly on
 * the film. `scale` is optical: a square badge at the same height as a wide
 * wordmark reads as much larger than it is, so each is sized by eye.
 */
export default function CredentialMark({
  src,
  alt,
  scale = 1,
  base = '3.2rem',
  className = '',
}: {
  src: string
  alt: string
  scale?: number
  /** nominal height before the optical adjustment */
  base?: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={'w-auto max-w-full object-contain ' + className}
      style={{
        height: `calc(clamp(2.75rem, 9vw, ${base}) * ${scale})`,
      }}
    />
  )
}
