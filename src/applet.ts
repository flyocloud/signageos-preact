/**
 * The knobs of this applet: timings and every text the screen can show.
 *
 * Values that differ per screen or customer do not belong here: they come
 * from Flyo (config.timeout, vars) or from the signageOS applet configuration.
 */
export const settings = {
  /** how long an image stays when Flyo sends no config.timeout, in ms */
  defaultSlideDuration: 15000,

  /**
   * Videos advance when they end. This timer is only a safety net for a
   * hanging video: the slide duration, but at least this long, in ms.
   */
  videoSafetyTimeout: 60000,

  /** length of the slide-out animation, keep in sync with .slide-out in src/styles.css */
  transitionDuration: 900,

  /**
   * Screens often boot before the network is up. A failed load is retried
   * every retryDelay ms, at most maxRetries times (15 x 10s = 2.5 minutes).
   * After the last attempt the message stays until Flyo reloads the applet
   * (next content change) or the device restarts.
   */
  retryDelay: 10000,
  maxRetries: 15,

  /** fetch() can hang forever on a broken connection, give up after this many ms */
  fetchTimeout: 30000,

  /**
   * Identifier of an optional text variable (Flyo integration, tab «Konfiguration»,
   * «Variabeln»). If it is set, its text is shown as a bar over the slides.
   */
  noticeVariable: 'notice',
}

/** Every text on the screen. Flyo always speaks to the viewer with «du». */
export const texts = {
  loading: 'Inhalte werden geladen …',
  noConnection: 'Keine Verbindung zum Server',
  httpError: (status: number) => 'Inhalte konnten nicht geladen werden (Fehler ' + status + ')',
  invalidResponse: 'Ungültige Antwort vom Server',
  retrying: (message: string, attempt: number, max: number) =>
    message + ', neuer Versuch (' + attempt + '/' + max + ')',
  noContent: 'Keine Inhalte verfügbar',
  missingApi: 'Keine Datenschnittstelle konfiguriert',
  structuredNotSupported:
    'Dieses Applet zeigt Slides. Wähle in der Integration unter «Verknüpfung der Inhalte» die Datenstruktur «Slides».',
}
