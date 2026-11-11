// Babel compiles our code and node_modules to ES5 for old TV browsers.
// The browser floor is "browserslist" in package.json.
module.exports = {
  // node_modules mix ES modules and CommonJS, detect it per file
  sourceType: 'unambiguous',
  presets: [
    [
      '@babel/preset-env',
      {
        // adds only the core-js polyfills the code actually uses
        useBuiltIns: 'usage',
        corejs: '3.51',
        // webpack handles import/export
        modules: false,
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic', importSource: 'preact' }]],
}
