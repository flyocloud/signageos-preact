import { describe, expect, it, vi } from 'vitest'

// the signageOS SDK needs a device or the emulator, the tests only need its shape
vi.mock('@signageos/front-applet', () => ({
  default: { config: {}, command: { dispatch: () => Promise.resolve() }, offline: { cache: {} } },
}))

import { buildSlides, isSlides, isVideoUrl, parseResponse, textVar, type FlyoResponse } from '../src/flyo'
import { cacheUid } from '../src/sos'

// the example from https://docs.flyo.cloud/doc/integrations-signage-os-applet
const slidesResponse = {
  data: [
    {
      image: 'https://storage.flyo.cloud/welcome_ab12cd34.jpg',
      title: 'Willkommen',
      teaser: 'Neue Wasserwelten',
      uid: 'f8855c2b6709de28df52df51aabe6ab6',
      entity_id: 29,
      entity_type: 'poi',
      pool_id: 1,
      metric: 'https://flyo.cloud/integration/metric/h/c3f0',
      qrcode: 'data:image/svg+xml;base64,PHN2Zz4=',
      scanurl: 'https://api.flyo.cloud/integration/sosc/12/1712000000/f8855c2b',
    },
    { image: 'https://storage.flyo.cloud/clip_1.mp4', title: '', teaser: '', uid: 'b2', entity_id: 30, entity_type: 'file', pool_id: 1, qrcode: false, scanurl: false },
    // an entry without image, as the API really sends it (image: false, custom: [])
    { image: false, title: 'Schneesporttag', teaser: 'Am 5. März', uid: 'c3', entity_id: 31, entity_type: 'schema', pool_id: 1, qrcode: 'data:image/svg+xml;base64,PHN2Zz4=', scanurl: 'x', custom: [] },
    // neither image nor text: nothing to show
    { image: false, title: '', teaser: '', uid: 'd4', entity_id: 32, entity_type: 'schema', pool_id: 1, qrcode: false, scanurl: false },
  ],
  config: { timeout: 20000 },
  vars: { notice: '  Heute geöffnet  ', cover: { source: 'https://storage.flyo.cloud/cover.jpg' } },
}

describe('parseResponse', () => {
  it('accepts the Slides structure', () => {
    const response = parseResponse(slidesResponse)
    expect(isSlides(response.data)).toBe(true)
    expect(response.config.timeout).toBe(20000)
  })

  it('accepts the Strukturiert structure', () => {
    const response = parseResponse({ data: { hero: [{ uid: 'a', qrcode: false, scanurl: false }] }, config: {} })
    expect(isSlides(response.data)).toBe(false)
  })

  it('fills in missing vars and config', () => {
    const response = parseResponse({ data: [] })
    expect(response.vars).toEqual({})
    expect(response.config).toEqual({})
  })

  it('rejects a response without data', () => {
    expect(() => parseResponse({ message: 'error' })).toThrow('data is missing')
    expect(() => parseResponse(null)).toThrow()
  })
})

describe('buildSlides', () => {
  it('builds image, video and text slides, skips entries with nothing to show', async () => {
    const slides = await buildSlides(parseResponse(slidesResponse), (url) => Promise.resolve('cached/' + url))
    expect(slides.map((slide) => slide.type)).toEqual(['image', 'video', 'text'])
    expect(slides[0]).toMatchObject({ title: 'Willkommen', duration: 20000, qrcode: 'data:image/svg+xml;base64,PHN2Zz4=' })
    expect(slides[0].filePath).toBe('cached/https://storage.flyo.cloud/welcome_ab12cd34.jpg')
    expect(slides[1]).toMatchObject({ qrcode: null, metric: null })
    expect(slides[2]).toMatchObject({ title: 'Schneesporttag', teaser: 'Am 5. März', filePath: '', url: '' })
  })

  it('skips a file that cannot be cached instead of failing', async () => {
    const cache = (url: string) => (url.endsWith('.mp4') ? Promise.reject(new Error('disk full')) : Promise.resolve(url))
    const slides = await buildSlides(parseResponse(slidesResponse), cache)
    expect(slides.map((slide) => slide.type)).toEqual(['image', 'text'])
  })

  it('uses the default duration without config.timeout', async () => {
    const response: FlyoResponse = { ...parseResponse(slidesResponse), config: {} }
    const slides = await buildSlides(response, (url) => Promise.resolve(url))
    expect(slides[0].duration).toBe(15000)
  })

  it('returns no slides for the Strukturiert structure', async () => {
    const slides = await buildSlides(parseResponse({ data: { hero: [] } }), (url) => Promise.resolve(url))
    expect(slides).toEqual([])
  })
})

describe('helpers', () => {
  it('detects videos by extension', () => {
    expect(isVideoUrl('https://x/a.mp4')).toBe(true)
    expect(isVideoUrl('https://x/a.WEBM?v=2')).toBe(true)
    expect(isVideoUrl('https://x/a.jpg')).toBe(false)
  })

  it('reads text variables only', () => {
    const vars = parseResponse(slidesResponse).vars
    expect(textVar(vars, 'notice')).toBe('Heute geöffnet')
    expect(textVar(vars, 'cover')).toBe('')
    expect(textVar(vars, 'missing')).toBe('')
  })

  it('builds a cache uid that keeps the extension and differs per file', () => {
    expect(cacheUid('https://storage.flyo.cloud/welcome_ab12cd34.jpg')).toBe('httpsstorageflyocloudwelcomeab12cd34.jpg')
    expect(cacheUid('https://storage.flyo.cloud/clip.MP4?v=2')).toMatch(/\.mp4$/)
    expect(cacheUid('https://x/a.jpg?v=1')).not.toBe(cacheUid('https://x/a.jpg?v=2'))
  })
})
