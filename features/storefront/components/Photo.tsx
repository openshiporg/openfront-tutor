'use client'
/* eslint-disable @next/next/no-img-element -- tutor images are arbitrary addresses the tutor typed; next/image needs a fixed host list. */
import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { cx } from './ui'

/**
 * A photo from the tutor's own record. With no address it draws a finished
 * paper panel (soft wash and a line mark) instead of a stock picture.
 */
export function Photo({ src, alt, className, imgClassName, label, tone = 'blush' }: { src: string | null | undefined; alt: string; className?: string; imgClassName?: string; label?: string; tone?: 'blush' | 'navy' }) {
  const [broken, setBroken] = useState(false)
  if (src && !broken) return <img src={src} alt={alt} className={cx('size-full object-cover', imgClassName, className)} loading="lazy" onError={() => setBroken(true)} />
  return (
    <div className={cx('relative flex size-full items-center justify-center overflow-hidden', tone === 'navy' ? 'bg-ink text-white/80' : 'bg-[radial-gradient(120%_90%_at_20%_10%,#fbf3ec_0%,#f2e2da_55%,#ead3cc_100%)] text-wine', className)} role="img" aria-label={alt}>
      <svg aria-hidden viewBox="0 0 200 200" className="absolute inset-0 size-full opacity-[0.10]" preserveAspectRatio="xMidYMid slice">
        <defs><pattern id="ruled" width="200" height="16" patternUnits="userSpaceOnUse"><path d="M0 15.5h200" stroke="currentColor" strokeWidth="1" /></pattern></defs>
        <rect width="200" height="200" fill="url(#ruled)" />
      </svg>
      {label ? (
        <span className="relative font-display text-[clamp(40px,8vw,88px)] font-semibold italic leading-none opacity-80">{label}</span>
      ) : (
        <BookOpen className="relative size-1/4 opacity-70" strokeWidth={1.4} aria-hidden />
      )}
    </div>
  )
}
