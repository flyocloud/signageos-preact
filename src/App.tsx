import { useEffect, useState } from 'preact/hooks'
import { settings, texts } from './applet'
import { buildSlides, HttpError, InvalidResponseError, isSlides, loadFlyo, textVar, type FlyoResponse, type Slide } from './flyo'
import { apiUrl, log } from './sos'
import { Loading } from './views/Loading'
import { Slideshow } from './views/Slideshow'

type Phase = 'loading' | 'leaving' | 'ready'

/**
 * Loads the content from Flyo (with retries), keeps the loading screen up
 * until everything is cached, then shows the view.
 *
 * Another layout (split screen, menu board, «Strukturiert» data ...): add a
 * component in src/views/ and render it below instead of / next to <Slideshow>.
 * `response.data` and `response.vars` hold everything Flyo sends.
 */
export function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [message, setMessage] = useState(texts.loading)
  const [response, setResponse] = useState<FlyoResponse | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])

  useEffect(() => {
    const url = apiUrl()
    if (!url) {
      setMessage(texts.missingApi)
      log({ type: 'Flyo.MissingApi' })
      return
    }

    let retryTimer: number | undefined
    let leaveTimer: number | undefined
    let stopped = false

    async function load(attempt: number) {
      let result: FlyoResponse
      // only the request is retried, an error while rendering is no connection problem
      try {
        result = await loadFlyo(url as string)
      } catch (error) {
        if (stopped) return
        const status = error instanceof HttpError ? error.status : null
        log({ type: 'Flyo.LoadFailed', url: url, status: status, attempt: attempt, message: String(error) })

        const reason = status
          ? texts.httpError(status)
          : error instanceof InvalidResponseError
            ? texts.invalidResponse
            : texts.noConnection

        if (attempt <= settings.maxRetries) {
          setMessage(texts.retrying(reason, attempt, settings.maxRetries))
          retryTimer = window.setTimeout(() => load(attempt + 1), settings.retryDelay)
        } else {
          setMessage(reason)
        }
        return
      }

      if (!isSlides(result.data)) {
        setMessage(texts.structuredNotSupported)
        return
      }

      const built = await buildSlides(result)
      if (stopped) return
      if (built.length === 0) {
        setMessage(texts.noContent)
        return
      }

      setResponse(result)
      setSlides(built)
      // the loading screen slides out over the first slide, then it is removed
      setPhase('leaving')
      leaveTimer = window.setTimeout(() => setPhase('ready'), settings.transitionDuration)
    }

    load(1)

    return () => {
      stopped = true
      window.clearTimeout(retryTimer)
      window.clearTimeout(leaveTimer)
    }
  }, [])

  const notice = response ? textVar(response.vars, settings.noticeVariable) : ''

  return (
    <div class="relative h-full w-full overflow-hidden">
      {slides.length > 0 && <Slideshow slides={slides} />}

      {notice && (
        <div class="absolute top-[3vw] left-[3vw] z-30 max-w-[60vw] rounded bg-white px-[1.4vw] py-[0.8vw] font-sans text-[1.6vw] font-bold text-gray-900">
          {notice}
        </div>
      )}

      {phase !== 'ready' && <Loading message={message} leaving={phase === 'leaving'} />}
    </div>
  )
}
