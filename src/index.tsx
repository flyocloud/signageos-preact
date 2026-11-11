// fetch for Chromium < 42. Everything else (Promise, Object.assign ...) is
// added by Babel from core-js automatically, only where the code uses it.
import 'whatwg-fetch'
import './styles.css'

import { render } from 'preact'
import { App } from './App'
import { log, sos } from './sos'

// Screens run unattended for weeks: unexpected errors go to the signageOS log
// instead of failing silently.
window.addEventListener('error', (event) => {
  log({ type: 'Applet.Error', message: String(event.message), source: event.filename + ':' + event.lineno })
})
window.addEventListener('unhandledrejection', (event) => {
  log({ type: 'Applet.UnhandledRejection', message: String((event as PromiseRejectionEvent).reason) })
})

// every sos call has to wait for onReady, so the app starts afterwards
sos.onReady().then(() => {
  render(<App />, document.getElementById('app') as HTMLElement)
})
