/**
 * The only file that talks to signageOS. Everything else imports from here,
 * so a view never depends on the SDK directly.
 *
 * `npm start` runs the signageOS emulator, so all of this also works locally.
 * SDK reference: https://developers.signageos.io/sdk/
 */
import sos from '@signageos/front-applet'

export { sos }

/**
 * The URL of the Flyo data API. Flyo sets the applet configuration key `api`
 * when it assigns the applet to a screen. Locally it comes from
 * sos.config.local.json (see sos.config.local.example.json).
 */
export function apiUrl(): string | null {
  const value = sos.config && sos.config.api
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * One log entry. Flyo shows them per screen: integration, tab «Bildschirme»,
 * info icon, «Logs anzeigen».
 * - `type`: letters, numbers, dot, dash and underscore, max 100 chars (Area.Event)
 * - further flat fields as context, errors as String(error)
 */
export interface LogEntry {
  type: string
  [field: string]: string | number | boolean | null | undefined
}

/**
 * Sends a log entry to signageOS. Never throws, not even with an invalid type.
 *
 * Only log when something goes wrong: a working screen writes no entries at
 * all, otherwise the real errors get lost. signageOS throttles to about 30
 * entries per 30 seconds. Never log slide changes or successful loads.
 */
export function log(entry: LogEntry): void {
  console.log('[log]', entry)
  Promise.resolve()
    .then(() => sos.command.dispatch(entry))
    .catch(() => undefined)
}

/**
 * Downloads a file into the device's offline cache (once) and returns the
 * local path to use as src. The screen keeps running when the network drops.
 * The cache lives as long as the applet: Flyo reloads the applet on every
 * content change, then the files are checked again.
 */
export async function cacheFile(url: string): Promise<string> {
  const file = await sos.offline.cache.loadOrSaveFile(cacheUid(url), url)
  return file.filePath
}

/**
 * The cache key of a URL. signageOS wants a unique id that keeps the file
 * extension (used for the mime type).
 */
export function cacheUid(url: string): string {
  const path = url.split('?')[0].split('#')[0]
  const match = /\.([a-z0-9]{2,5})$/i.exec(path)
  const extension = match ? '.' + match[1].toLowerCase() : ''
  const rest = path.slice(0, path.length - extension.length) + url.slice(path.length)
  // the end of the URL is what differs, the host is the same for every file
  return rest.replace(/[^a-zA-Z0-9]/g, '').slice(-100) + extension
}
