// 1. tailwindcss generates the utilities (only the legacy-safe ones, see tailwind.config.js)
// 2. postcss-legacy rewrites what Tailwind still writes for modern browsers
// 3. autoprefixer adds the -webkit- prefixes old Chromium needs (browserslist in package.json)
module.exports = {
  plugins: [require('tailwindcss'), require('./scripts/postcss-legacy'), require('autoprefixer')],
}
