/**
 * Keeps the applet running on old TV browsers (Chromium 30+).
 *
 * `node scripts/compat.mjs` runs after every build (npm run build -> postbuild)
 * and fails it when dist/ or src/ contains something old players cannot run.
 * The tests use the same rules.
 *
 * Every rule says what breaks and what to use instead. Add a rule when you
 * hit a new problem on a real device.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import * as acorn from 'acorn'

// CSS old Chromium does not understand: it silently drops the declaration or the whole rule.
export const CSS_RULES = [
  [/var\(--/, 'CSS variables need Chromium 49. Use a fixed value.'],
  [/:(where|is|has)\(/, ':where()/:is()/:has() need Chromium 88+. Write the plain selector.'],
  [/(^|[;{\s])inset\s*:/, 'inset needs Chromium 87. Use top/right/bottom/left.'],
  [/(^|[;{\s])(row-|column-)?gap\s*:/, 'gap in flexbox needs Chromium 84. Use margins on the children.'],
  [/display\s*:\s*(inline-)?grid/, 'CSS grid needs Chromium 57. Use flexbox.'],
  [/aspect-ratio\s*:/, 'aspect-ratio needs Chromium 88. Use fixed sizes or the padding-top trick.'],
  [/\b(oklch|oklab|lab|lch|color-mix)\(/, 'Modern color functions need Chromium 111. Use hex or rgba().'],
  [/rgba?\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\//, 'rgb(r g b / a) needs Chromium 65. Use rgba(r, g, b, a).'],
  [/(^|[\s:,(])(clamp|min|max)\(/, 'clamp()/min()/max() need Chromium 79. Use a fixed value or vw/vh.'],
  [/@(layer|property|container)\b/, '@layer/@property/@container are not supported. Write plain rules.'],
  [/(^|[;{\s])(margin|padding|inset|border)-(inline|block)(-start|-end)?\s*:/, 'Logical properties need Chromium 69+. Use left/right/top/bottom.'],
]

// Browser APIs old Chromium does not have and core-js cannot add.
// Checked in src/ only: libraries usually test for them before using them.
export const SOURCE_RULES = [
  [/\bnew Proxy\s*\(/, 'Proxy needs Chromium 49 and cannot be polyfilled.'],
  [/\b(IntersectionObserver|ResizeObserver|MutationObserver)\b/, 'Observers need Chromium 51+. Use timers or callbacks.'],
  [/\.closest\s*\(/, 'Element.closest needs Chromium 41. Walk parentNode yourself.'],
  [/\.(append|prepend|replaceWith)\s*\(/, 'These DOM helpers need Chromium 54. Use appendChild/insertBefore.'],
  [/\bAbortController\b/, 'AbortController needs Chromium 66. Use a timer, see fetchWithTimeout in src/flyo.ts.'],
  [/\b(requestIdleCallback|structuredClone|queueMicrotask)\b/, 'Needs a modern browser. Use setTimeout.'],
  [/\bimport\s*\(/, 'No lazy chunks: an applet is one bundle that must work offline. Use a static import.'],
  [/\bCSS\.supports\b/, 'CSS.supports needs Chromium 61.'],
]

// blanks out comments, keeps the line numbers
function codeLines(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
}

function match(code, rules) {
  const errors = []
  codeLines(code).forEach((line, index) => {
    for (const [pattern, reason] of rules) {
      if (pattern.test(line)) {
        errors.push({ line: index + 1, code: line.trim().slice(0, 120), reason })
      }
    }
  })
  return errors
}

export const checkCss = (css) => match(css, CSS_RULES)
export const checkSource = (code) => match(code, SOURCE_RULES)

// built JavaScript must be plain ES5: no let/const, arrow functions, classes, template strings ...
export function checkEs5(code) {
  try {
    acorn.parse(code, { ecmaVersion: 5, sourceType: 'script' })
    return []
  } catch (error) {
    const loc = error.loc || { line: 0, column: 0 }
    const line = code.split('\n')[loc.line - 1] || ''
    return [{
      line: loc.line,
      code: line.slice(Math.max(0, loc.column - 60), loc.column + 60).trim(),
      reason: 'Not ES5 (' + error.message + '). A file or package is not transpiled, see the babel rule in webpack.config.js.',
    }]
  }
}

export function checkHtml(html) {
  return /type=["']module["']/.test(html)
    ? [{ line: 0, code: 'type="module"', reason: 'Module scripts need Chromium 61, load the bundle as a classic script.' }]
    : []
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

// The CSS is bundled into index.js, so it is built here once more with the
// same PostCSS pipeline (Tailwind classes used in src/ included) and checked.
async function buildCss(root) {
  const require = createRequire(join(root, 'package.json'))
  const postcss = require('postcss')
  const { plugins } = require(join(root, 'postcss.config.js'))
  const file = join(root, 'src', 'styles.css')
  const result = await postcss(plugins).process(readFileSync(file, 'utf8'), { from: file })
  return result.css
}

async function run() {
  const root = process.cwd()
  if (!existsSync(join(root, 'dist', 'index.html'))) {
    console.error('dist/index.html is missing, run npm run build first.')
    process.exit(1)
  }

  const problems = []
  const report = (file, errors) => {
    for (const error of errors) {
      problems.push({ file, ...error })
    }
  }
  const check = (file, fn) => report(relative(root, file), fn(readFileSync(file, 'utf8')))

  for (const file of walk(join(root, 'dist'))) {
    if (file.endsWith('.js')) check(file, checkEs5)
    if (file.endsWith('.html')) check(file, checkHtml)
  }
  for (const file of walk(join(root, 'src'))) {
    if (/\.(ts|tsx|js|jsx)$/.test(file)) check(file, checkSource)
  }
  report('src/styles.css (built)', checkCss(await buildCss(root)))

  if (problems.length > 0) {
    console.error('\nCompatibility check failed, ' + problems.length + ' problem(s) for old TV browsers:\n')
    for (const p of problems) {
      console.error('  ' + p.file + ':' + p.line + '\n    ' + p.code + '\n    -> ' + p.reason + '\n')
    }
    process.exit(1)
  }
  console.log('Compatibility check passed: ES5 JavaScript, legacy-safe CSS, no unsupported browser APIs in src/.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await run()
}
