/**
 * Rewrites what Tailwind 3 emits for modern browsers into CSS that old TV
 * browsers (Chromium 30+) understand. Runs after Tailwind, see postcss.config.js.
 *
 * - `inset: x`                   -> top/right/bottom/left (inset needs Chromium 87)
 * - `:where(a)`                  -> `a` (needs Chromium 88; an unknown pseudo class drops the whole rule)
 * - `rgb(1 2 3 / 0.5)`           -> `rgba(1, 2, 3, 0.5)` (needs Chromium 65, written for bg-black/50)
 * - logical properties           -> left/right/top/bottom (need Chromium 69+, screens are left-to-right)
 * - `content: var(--tw-content)` -> `content: ''` (written by the before:/after: variants)
 *
 * What cannot be rewritten is switched off in tailwind.config.js and caught
 * by scripts/compat.mjs.
 */
const LOGICAL = {
  'margin-inline-start': 'margin-left',
  'margin-inline-end': 'margin-right',
  'padding-inline-start': 'padding-left',
  'padding-inline-end': 'padding-right',
  'inset-inline-start': 'left',
  'inset-inline-end': 'right',
  'border-inline-start-width': 'border-left-width',
  'border-inline-end-width': 'border-right-width',
  'border-inline-start-color': 'border-left-color',
  'border-inline-end-color': 'border-right-color',
  'border-start-start-radius': 'border-top-left-radius',
  'border-start-end-radius': 'border-top-right-radius',
  'border-end-start-radius': 'border-bottom-left-radius',
  'border-end-end-radius': 'border-bottom-right-radius',
}

const RGB_SLASH = /rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\/\s*([\d.]+%?)\s*\)/g

module.exports = () => ({
  postcssPlugin: 'flyo-legacy',
  Declaration(decl) {
    if (decl.prop === 'content' && decl.value === 'var(--tw-content)') {
      decl.value = "''"
    }
    if (LOGICAL[decl.prop]) {
      decl.prop = LOGICAL[decl.prop]
    }
    if (decl.value.indexOf('/') !== -1) {
      decl.value = decl.value.replace(RGB_SLASH, (_, r, g, b, a) => {
        const alpha = a.slice(-1) === '%' ? parseFloat(a) / 100 : a
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'
      })
    }
    if (decl.prop === 'inset') {
      const [top, right = top, bottom = top, left = right] = decl.value.trim().split(/\s+/)
      decl.cloneBefore({ prop: 'top', value: top })
      decl.cloneBefore({ prop: 'right', value: right })
      decl.cloneBefore({ prop: 'bottom', value: bottom })
      decl.cloneBefore({ prop: 'left', value: left })
      decl.remove()
    }
  },
  Rule(rule) {
    if (rule.selector.indexOf(':where(') !== -1) {
      rule.selector = unwrapWhere(rule.selector)
    }
  },
})
module.exports.postcss = true

// replaces every :where(...) with its content, nested parentheses included
function unwrapWhere(selector) {
  let result = ''
  let index = 0
  while (index < selector.length) {
    const start = selector.indexOf(':where(', index)
    if (start === -1) {
      result += selector.slice(index)
      break
    }
    result += selector.slice(index, start)
    let depth = 1
    let cursor = start + ':where('.length
    while (cursor < selector.length && depth > 0) {
      if (selector[cursor] === '(') depth++
      if (selector[cursor] === ')') depth--
      cursor++
    }
    result += selector.slice(start + ':where('.length, cursor - 1)
    index = cursor
  }
  return result
}
