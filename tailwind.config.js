/**
 * Tailwind 3.4, cut down to what old TV browsers (Chromium 30+) can render.
 *
 * Many Tailwind utilities are built on CSS custom properties (var(--tw-...)),
 * which Chromium only supports from version 49. On older players such a class
 * silently does nothing. So only the utilities listed in `corePlugins` below
 * exist; everything else is switched off on purpose and not generated at all.
 *
 * Switched off, and what to use instead (plain CSS in src/styles.css):
 *   translate / rotate / scale / skew / transform  -> transform: ... in CSS
 *   boxShadow / ring                               -> box-shadow: ... in CSS
 *   gradients (bg-gradient-*)                      -> background-image: linear-gradient(...) in CSS
 *   blur / brightness / ... / backdrop-*           -> no replacement, avoid filters
 *   gap / space-x / space-y / divide               -> margins on the children (m-*, last:m-0)
 *   grid-*                                         -> flex (CSS grid needs Chromium 57)
 *   aspect-ratio                                   -> padding-top trick or fixed sizes
 *   bg-opacity-* / text-opacity-* ...              -> the color modifier: bg-black/50 (becomes rgba())
 *   content-[...]                                  -> before:/after: work, but without text content
 *
 * A few utilities are rewritten for old browsers by scripts/postcss-legacy.js
 * (inset-0, ms-4, bg-black/50 ...), you can use them normally.
 *
 * `npm test` generates every enabled utility and fails if one of them is not
 * legacy-safe, so enabling a plugin here that breaks old players is caught.
 */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  // single classes of enabled plugins that old players cannot render
  // (grid needs Chromium 57, flow-root 58, contents 65)
  blocklist: ['grid', 'inline-grid', 'flow-root', 'contents'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  corePlugins: [
    'preflight',
    // layout
    'container',
    'display',
    'position',
    'inset',
    'zIndex',
    'float',
    'clear',
    'overflow',
    'visibility',
    'boxSizing',
    'objectFit',
    'objectPosition',
    'order',
    // flexbox
    'flex',
    'flexDirection',
    'flexWrap',
    'flexGrow',
    'flexShrink',
    'flexBasis',
    'alignItems',
    'alignContent',
    'alignSelf',
    'justifyContent',
    // spacing and sizing
    'margin',
    'padding',
    'width',
    'minWidth',
    'maxWidth',
    'height',
    'minHeight',
    'maxHeight',
    'size',
    // typography
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'fontSmoothing',
    'letterSpacing',
    'lineHeight',
    'lineClamp',
    'textAlign',
    'textColor',
    'textDecoration',
    'textTransform',
    'textOverflow',
    'textIndent',
    'verticalAlign',
    'whitespace',
    'wordBreak',
    'listStyleType',
    'listStylePosition',
    // backgrounds and borders
    'backgroundColor',
    'backgroundSize',
    'backgroundPosition',
    'backgroundRepeat',
    'backgroundAttachment',
    'backgroundClip',
    'backgroundOrigin',
    'borderWidth',
    'borderStyle',
    'borderColor',
    'borderRadius',
    'outlineStyle',
    'outlineWidth',
    'outlineColor',
    'outlineOffset',
    // effects, motion, interaction
    'opacity',
    'transitionProperty',
    'transitionDuration',
    'transitionTimingFunction',
    'transitionDelay',
    'animation',
    'cursor',
    'pointerEvents',
    'userSelect',
  ],
}
