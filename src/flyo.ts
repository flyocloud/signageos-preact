/**
 * The Flyo data API of a signageOS integration, and how this applet reads it.
 * Docs: https://docs.flyo.cloud/doc/integrations-signage-os-applet
 *
 * Every response looks like { data, config: { timeout }, vars }. `data`
 * depends on the data structure chosen in the integration («Verknüpfung der Inhalte»):
 * - «Slides»: an array, one item per content pool entry (FlyoSlideItem)
 * - «Strukturiert»: an object, one list per development identifier
 *
 * The exact fields of one integration (custom fields, variables with their
 * types) are in its OpenAPI definition, tab «Entwickler». Types can be
 * generated from it, see README.md.
 */
import { settings } from './applet'
import { cacheFile, log } from './sos'

/** One entry in the «Slides» structure. */
export interface FlyoSlideItem {
  /** image (or video) URL; false or empty when the entry has none */
  image?: string | false
  /** empty string when not mapped */
  title: string
  teaser: string
  /** the raw QR code link, only when mapped */
  link?: string
  uid: string
  entity_id: number
  entity_type: string
  pool_id: number
  /** development identifier of the content pool, optional */
  item_identifier?: string
  /** tracking pixel: one request counts one display in the Flyo metrics */
  metric?: string
  /** ready QR code as SVG data URI, false without a link */
  qrcode: string | false
  /** the URL behind the QR code, false without a link */
  scanurl: string | false
  /** the integration's own fields, key = field name ([] when there are none) */
  custom?: Record<string, unknown> | unknown[]
}

/** One entry in the «Strukturiert» structure: your own fields plus these. */
export interface FlyoStructuredItem {
  uid: string
  link?: string
  qrcode: string | false
  scanurl: string | false
  [field: string]: unknown
}

/**
 * Variables of the integration, key = identifier. They carry the full value of
 * their type: text as string, image as { source, caption, ... }, link as
 * { href, ... }, multi input as an array of rows. See the OpenAPI definition.
 */
export type FlyoVars = Record<string, unknown>

export interface FlyoResponse {
  data: FlyoSlideItem[] | Record<string, FlyoStructuredItem[]>
  config: { timeout?: number }
  vars: FlyoVars
}

/** What the slideshow renders, built from a FlyoSlideItem. */
export interface Slide {
  id: string
  /** text: an entry without image, shown on a neutral background */
  type: 'image' | 'video' | 'text'
  /** original file URL, for logs ('' for text slides) */
  url: string
  /** local path from the offline cache, use it as src ('' for text slides) */
  filePath: string
  title: string
  teaser: string
  /** QR code as data URI */
  qrcode: string | null
  metric: string | null
  /** display time in ms (videos run until they end) */
  duration: number
}

/** An HTTP error response. fetch() only rejects on network errors, not on a 502. */
export class HttpError extends Error {
  status: number

  constructor(status: number) {
    super('HTTP ' + status)
    this.status = status
    // keeps instanceof working once Babel compiles the class to ES5
    Object.setPrototypeOf(this, HttpError.prototype)
  }
}

/** Thrown when the response is not the Flyo shape. */
export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, InvalidResponseError.prototype)
  }
}

/**
 * fetch() with a timeout: on a broken connection fetch() can hang forever and
 * no retry would ever start. (AbortController needs Chromium 66, so the timeout
 * stops waiting but does not cancel the request.)
 */
export function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout after ' + timeout + 'ms')), timeout)
    fetch(url).then(
      (response) => {
        clearTimeout(timer)
        resolve(response)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Loads the data API once. Rejects on network errors, timeouts, HTTP errors and an invalid shape. */
export async function loadFlyo(url: string): Promise<FlyoResponse> {
  const response = await fetchWithTimeout(url, settings.fetchTimeout)
  if (!response.ok) {
    throw new HttpError(response.status)
  }
  return parseResponse(await response.json())
}

/** Checks the shape and fills in what may be missing (vars, config). */
export function parseResponse(json: unknown): FlyoResponse {
  if (!json || typeof json !== 'object') {
    throw new InvalidResponseError('Invalid response: not an object')
  }
  const body = json as Partial<FlyoResponse>
  if (!body.data || typeof body.data !== 'object') {
    throw new InvalidResponseError('Invalid response: data is missing')
  }
  return {
    data: body.data,
    config: body.config && typeof body.config === 'object' ? body.config : {},
    vars: body.vars && typeof body.vars === 'object' && !Array.isArray(body.vars) ? body.vars : {},
  }
}

/** true for the «Slides» structure, false for «Strukturiert». */
export function isSlides(data: FlyoResponse['data']): data is FlyoSlideItem[] {
  return Array.isArray(data)
}

/**
 * Turns the slide items into slides and puts every file into the offline cache.
 *
 * - An entry with an image or video becomes an image or video slide.
 * - An entry without image (image: false) but with a title or teaser becomes a
 *   text slide. An entry with neither is skipped.
 * - A file that cannot be cached is skipped (logged as Content.CacheFailed),
 *   so one broken file never stops the screen.
 */
export async function buildSlides(response: FlyoResponse, cache = cacheFile): Promise<Slide[]> {
  if (!isSlides(response.data)) {
    return []
  }
  const duration = response.config.timeout || settings.defaultSlideDuration
  const slides: Slide[] = []

  for (const item of response.data) {
    const image = typeof item.image === 'string' ? item.image : ''
    const slide: Slide = {
      id: item.uid,
      type: image ? (isVideoUrl(image) ? 'video' : 'image') : 'text',
      url: image,
      filePath: '',
      title: item.title || '',
      teaser: item.teaser || '',
      qrcode: item.qrcode || null,
      metric: item.metric || null,
      duration: duration,
    }

    if (slide.type === 'text') {
      if (slide.title || slide.teaser) {
        slides.push(slide)
      }
      continue
    }

    try {
      slide.filePath = await cache(image)
      slides.push(slide)
    } catch (error) {
      log({ type: 'Content.CacheFailed', url: image, message: String(error) })
    }
  }

  return slides
}

/**
 * The default API has no video field: a video mapped to the image field
 * arrives as a plain file URL, so the extension decides.
 */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|m4v|mov)(\?.*)?$/i.test(url)
}

/** A text variable, or '' when it is not set or not a text. */
export function textVar(vars: FlyoVars, identifier: string): string {
  const value = vars[identifier]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Counts one display of a slide in the Flyo metrics. The metric URL is a
 * tracking pixel, an Image request works everywhere, also without CORS.
 * Failures are ignored: a missed count must never disturb the screen.
 */
export function trackDisplay(metric: string | null): void {
  if (metric) {
    new Image().src = metric
  }
}
