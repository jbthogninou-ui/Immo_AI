import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { PropertyImage } from '@/types'

/**
 * Galerie photo d'un bien.
 * Mosaïque asymétrique sur grand écran, carrousel sur mobile,
 * visionneuse plein écran pilotable au clavier.
 */
export function PropertyGallery({ images, title }: { images: PropertyImage[]; title: string }) {
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  const next = useCallback(() => setIndex((value) => (value + 1) % images.length), [images.length])
  const previous = useCallback(
    () => setIndex((value) => (value - 1 + images.length) % images.length),
    [images.length],
  )

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false)
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') previous()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox, next, previous])

  if (!images.length) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-brand-gradient">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-brass-300">
          Photos à venir
        </p>
      </div>
    )
  }

  const [main, ...rest] = images

  return (
    <>
      {/* --------------------------- Mosaïque --------------------------- */}
      <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
        <button
          type="button"
          onClick={() => { setIndex(0); setLightbox(true) }}
          className="group relative col-span-2 row-span-2 aspect-[4/3] overflow-hidden rounded-2xl bg-lagoon-800 md:aspect-auto"
        >
          <img
            src={main.url}
            alt={`${title} — ${main.caption ?? 'vue principale'}`}
            className="h-full w-full object-cover transition-transform duration-700 ease-swift group-hover:scale-105"
          />
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-ink/70 px-2.5 py-1.5 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-white backdrop-blur">
            <Expand className="h-3.5 w-3.5" />
            {images.length} photos
          </span>
        </button>

        {rest.slice(0, 4).map((image, position) => (
          <button
            key={image.id}
            type="button"
            onClick={() => { setIndex(position + 1); setLightbox(true) }}
            className="group relative hidden aspect-[4/3] overflow-hidden rounded-xl bg-lagoon-800 md:block"
          >
            <img
              src={image.thumbnail_url ?? image.url}
              alt={`${title} — ${image.caption ?? `vue ${position + 2}`}`}
              className="h-full w-full object-cover transition-transform duration-700 ease-swift group-hover:scale-105"
            />
            {position === 3 && images.length > 5 && (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/60 font-display text-xl font-semibold text-white backdrop-blur-sm">
                +{images.length - 5}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* -------------------------- Visionneuse ------------------------- */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex flex-col bg-ink/96 backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-white/60">
                {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
                {images[index]?.caption && <span className="ml-3 text-white/40">{images[index].caption}</span>}
              </span>
              <button
                onClick={() => setLightbox(false)}
                aria-label="Fermer la galerie"
                className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
              <button
                onClick={previous}
                aria-label="Photo précédente"
                className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <AnimatePresence mode="wait">
                <motion.img
                  key={images[index].id}
                  src={images[index].url}
                  alt={images[index].caption ?? title}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="max-h-full max-w-5xl rounded-xl object-contain"
                />
              </AnimatePresence>

              <button
                onClick={next}
                aria-label="Photo suivante"
                className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-5">
              {images.map((image, position) => (
                <button
                  key={image.id}
                  onClick={() => setIndex(position)}
                  className={cn(
                    'h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-all duration-200',
                    position === index ? 'ring-2 ring-brass-500' : 'opacity-50 hover:opacity-90',
                  )}
                >
                  <img src={image.thumbnail_url ?? image.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
