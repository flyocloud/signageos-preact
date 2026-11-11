import { describe, expect, it } from 'vitest'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
// @ts-expect-error plain JS config and plugins
import tailwindConfig from '../tailwind.config.js'
// @ts-expect-error plain JS plugin
import legacy from '../scripts/postcss-legacy.js'
import autoprefixer from 'autoprefixer'
// @ts-expect-error plain JS module
import { checkCss, checkEs5, checkSource } from '../scripts/compat.mjs'

describe('Tailwind on old TV browsers', () => {
  // Generates every utility that tailwind.config.js enables (plus a few
  // variants) and runs it through the same rules as the build. Fails when a
  // plugin is enabled that old players cannot render.
  it('every enabled utility is legacy-safe', async () => {
    const config = {
      ...tailwindConfig,
      content: [{ raw: '<div class="before:block after:absolute hover:opacity-50 first:mt-0 bg-black/50 inset-x-2 ms-4 rounded-s-lg">' }],
      safelist: [{ pattern: /.*/ }],
    }
    const result = await postcss([tailwind(config), legacy(), autoprefixer()]).process(
      '@tailwind base; @tailwind components; @tailwind utilities;',
      { from: undefined },
    )
    expect(checkCss(result.css)).toEqual([])
  }, 120000)
})

describe('compat rules', () => {
  it('finds modern CSS', () => {
    expect(checkCss('.a { gap: 1rem; }')).toHaveLength(1)
    expect(checkCss('.a { color: var(--brand); }')).toHaveLength(1)
    expect(checkCss('.a { display: grid; }')).toHaveLength(1)
    expect(checkCss('.a { margin-left: 1rem; }')).toEqual([])
  })

  it('finds modern JavaScript syntax', () => {
    expect(checkEs5('var a = function () { return 1 }')).toEqual([])
    expect(checkEs5('const a = () => 1')).toHaveLength(1)
  })

  it('finds browser APIs core-js cannot add, but not in comments', () => {
    expect(checkSource('const p = new Proxy({}, {})')).toHaveLength(1)
    expect(checkSource('el.closest(".x")')).toHaveLength(1)
    expect(checkSource('// never use new Proxy() here')).toEqual([])
  })
})
