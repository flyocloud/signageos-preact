import { useEffect, useRef, useState } from 'preact/hooks'
import { log } from '../sos'

interface Props {
  /** local path from the offline cache */
  filePath: string
  /** original URL, only for the logs */
  url: string
  isActive: boolean
  /** a playlist with a single video loops it instead of ending */
  loop: boolean
  /** the video ended or failed, the slideshow moves on */
  onEnded: () => void
}

/**
 * Plays a cached video muted and full screen, once per turn.
 *
 * Learnings from production screens (Tizen and other embedded webviews):
 * - The cached file is read once and played from a blob: URL. The cache's
 *   service worker answers Range requests with a full 200, which makes
 *   Safari-based webviews freeze a few frames in. If reading the blob fails,
 *   the cached path is played directly.
 * - play() is only called once the video reports `canplay`, otherwise it can
 *   fail silently.
 * - Never put the <video> on its own GPU layer (translateZ(0), will-change):
 *   on Tizen it then renders behind the page. Never fade or move it either,
 *   a video slide leaves with a hard cut (see Slideshow.tsx).
 * - Every video stays in memory as a blob while the applet runs, keep the
 *   files reasonably small.
 */
export function Video({ filePath, url, isActive, loop, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  // the event handlers read the latest props through refs
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // read the cached file into a blob, once
  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    fetch(filePath)
      .then((response) => {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status)
        }
        return response.blob()
      })
      .then((blob) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob)
          setSrc(objectUrl)
        }
      })
      .catch(() => {
        // not an error yet: the cached path itself usually plays fine
        if (!cancelled) {
          setSrc(filePath)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [filePath])

  // play when the slide becomes active, rewind when it is left
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) {
      return
    }

    if (!isActive) {
      video.pause()
      video.currentTime = 0
      return
    }

    const play = () => {
      video.currentTime = 0
      const result = video.play()
      if (result && typeof result.then === 'function') {
        result.catch((error: unknown) => fail('play-rejected', String(error)))
      }
    }

    if (video.readyState >= 3) {
      play()
      return
    }

    const onCanPlay = () => {
      video.removeEventListener('canplay', onCanPlay)
      if (isActiveRef.current) {
        play()
      }
    }
    video.addEventListener('canplay', onCanPlay)
    return () => video.removeEventListener('canplay', onCanPlay)
  }, [isActive, src])

  // only failures are logged, a regular end happens on every playback
  function fail(reason: string, message?: string) {
    const video = videoRef.current
    log({
      type: 'Video.Ended',
      url: url,
      reason: reason,
      message: message,
      currentTime: video ? video.currentTime : null,
      errorCode: video && video.error ? video.error.code : null,
    })
    if (isActiveRef.current) {
      onEndedRef.current()
    }
  }

  if (!src) {
    return <div class="h-full w-full bg-black" />
  }

  return (
    <video
      ref={videoRef}
      class="h-full w-full bg-black object-cover"
      src={src}
      loop={loop}
      muted
      playsInline
      preload="auto"
      onEnded={() => isActiveRef.current && onEndedRef.current()}
      onError={() => fail('error')}
    />
  )
}
