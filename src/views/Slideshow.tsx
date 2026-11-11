import { useEffect, useRef, useState } from 'preact/hooks'
import { settings } from '../applet'
import { trackDisplay, type Slide } from '../flyo'
import { Video } from './Video'

interface Props {
  slides: Slide[]
}

/**
 * Shows the slides full screen, one after the other, endlessly.
 *
 * - An image stays for its duration, a video until it ends (the timer is only
 *   a safety net, settings.videoSafetyTimeout).
 * - Every slide is opaque and stacked, the active one on top. On a change the
 *   next slide is already there underneath, the outgoing one is lifted above
 *   it and slides out to the left (.slide-out in src/styles.css). Nothing
 *   fades in, so a paused video below can never shine through.
 * - A video slide leaves with a hard cut: video decoders on TVs do not paint
 *   a <video> that moves or fades reliably.
 * - Each display is counted in the Flyo metrics (trackDisplay).
 */
export function Slideshow({ slides }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const leavingTimer = useRef<number | undefined>(undefined)
  const activeRef = useRef(activeIndex)
  activeRef.current = activeIndex

  function next() {
    if (slides.length < 2) {
      return
    }
    const current = activeRef.current
    window.clearTimeout(leavingTimer.current)
    if (slides[current].type === 'video') {
      setLeavingIndex(null)
    } else {
      setLeavingIndex(current)
      leavingTimer.current = window.setTimeout(() => setLeavingIndex(null), settings.transitionDuration)
    }
    setActiveIndex((current + 1) % slides.length)
  }

  // count the display and start the timer of the current slide
  useEffect(() => {
    const slide = slides[activeIndex]
    if (!slide) {
      return
    }
    trackDisplay(slide.metric)
    const delay = slide.type === 'video' ? Math.max(slide.duration, settings.videoSafetyTimeout) : slide.duration
    timer.current = window.setTimeout(next, delay)
    return () => window.clearTimeout(timer.current)
  }, [activeIndex, slides])

  useEffect(() => () => window.clearTimeout(leavingTimer.current), [])

  return (
    <div class="relative h-full w-full overflow-hidden bg-black">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          class={
            'absolute top-0 left-0 h-full w-full ' +
            (index === leavingIndex ? 'z-30 slide-out' : index === activeIndex ? 'z-20' : 'z-10')
          }
        >
          <SlideView
            slide={slide}
            isActive={index === activeIndex}
            loop={slides.length === 1}
            onVideoEnded={() => {
              if (index === activeRef.current) {
                window.clearTimeout(timer.current)
                next()
              }
            }}
          />
        </div>
      ))}
    </div>
  )
}

interface SlideProps {
  slide: Slide
  isActive: boolean
  loop: boolean
  onVideoEnded: () => void
}

/**
 * One slide: image or video with teaser and title at the bottom, or (entry
 * without image) a text slide on a neutral background. QR code on the right.
 */
function SlideView({ slide, isActive, loop, onVideoEnded }: SlideProps) {
  if (slide.type === 'text') {
    return (
      <div class="relative flex h-full w-full items-center bg-gray-900 px-[8vw]">
        <div class="max-w-[70vw]">
          {slide.teaser && (
            <div class="mb-[2vw] font-sans text-[2.4vw] leading-snug text-gray-300">{slide.teaser}</div>
          )}
          {slide.title && (
            <div class={'font-sans font-bold leading-tight text-white ' + titleSize(slide.title)}>{slide.title}</div>
          )}
        </div>
        {slide.qrcode && <QrCode src={slide.qrcode} />}
      </div>
    )
  }

  return (
    <div class="relative h-full w-full overflow-hidden bg-black">
      {slide.type === 'video' ? (
        <Video filePath={slide.filePath} url={slide.url} isActive={isActive} loop={loop} onEnded={onVideoEnded} />
      ) : (
        <img class="h-full w-full object-cover" src={slide.filePath} alt="" />
      )}

      {(slide.teaser || slide.title) && (
        <div class="caption absolute bottom-0 left-0 w-full px-[4vw] pb-[3.5vw] pt-[10vw]">
          {slide.teaser && (
            <div class="mb-[0.8vw] font-sans text-[1.8vw] font-bold uppercase tracking-wide text-white">
              {slide.teaser}
            </div>
          )}
          {slide.title && (
            <div class={'max-w-[72vw] font-sans font-bold leading-tight text-white ' + titleSize(slide.title)}>
              {slide.title}
            </div>
          )}
        </div>
      )}

      {slide.qrcode && <QrCode src={slide.qrcode} />}
    </div>
  )
}

function QrCode({ src }: { src: string }) {
  return (
    <div class="absolute bottom-[3vw] right-[3vw] w-[9vw] rounded bg-white p-[0.6vw]">
      <img class="block w-full" src={src} alt="" />
    </div>
  )
}

// long titles get smaller instead of covering the whole screen
function titleSize(title: string): string {
  if (title.length > 60) return 'text-[2.6vw]'
  if (title.length > 35) return 'text-[3.4vw]'
  return 'text-[4.4vw]'
}
