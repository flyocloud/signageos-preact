import logoUrl from '../flyo-logo.svg'

interface Props {
  /** status under the logo: loading, retrying, error */
  message: string
  /** true once the content is ready: the screen slides out, then App removes it */
  leaving?: boolean
}

/** Full screen loader: the Flyo logo pulsing, the current status underneath. */
export function Loading({ message, leaving }: Props) {
  return (
    <div
      class={
        'absolute top-0 left-0 z-40 flex h-full w-full flex-col items-center justify-center bg-white' +
        (leaving ? ' slide-out' : '')
      }
    >
      <img src={logoUrl} alt="Flyo" class="logo-pulse w-[14vw]" />
      <p class="mt-[3vw] px-[8vw] text-center font-sans text-[1.6vw] text-gray-600">{message}</p>
    </div>
  )
}
