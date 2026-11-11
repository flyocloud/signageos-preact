const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const SignageOSPlugin = require('@signageos/webpack-plugin')

/**
 * Builds the applet into dist/: index.html, index.js (ES5, CSS included) and assets/.
 *
 * - npm start  -> webpack serve: the signageOS emulator runs on http://localhost:8090
 *                 with the real sos API (offline cache, config, logs) and rebuilds on save.
 * - npm run build -> production bundle, checked by scripts/compat.mjs afterwards.
 */
module.exports = (_env, argv) => {
  const isProduction = argv.mode === 'production'

  return {
    entry: './src/index.tsx',
    // webpack's own runtime code must be ES5 too
    target: ['web', 'es5'],
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js',
      // relative paths, the applet does not run at the web root on a device
      publicPath: '',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    devtool: isProduction ? false : 'source-map',
    module: {
      rules: [
        {
          // Babel runs on node_modules too: many packages ship ES2015+ code.
          // core-js is excluded (it is the polyfill itself), the dev server client only runs on your machine.
          test: /\.(m|c)?[jt]sx?$/,
          exclude: /node_modules[\\/](core-js|webpack|webpack-dev-server)[\\/]/,
          use: { loader: 'babel-loader', options: { cacheDirectory: true } },
        },
        {
          // The CSS goes into index.js and becomes a <style> tag. A separate index.css would
          // break the emulator's screenshots: they copy the page into an empty frame where
          // a relative <link href="index.css"> no longer resolves.
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.(svg|png|jpe?g|gif|webp|woff2?|ttf|mp4|webm)$/,
          type: 'asset/resource',
          generator: { filename: 'assets/[name].[contenthash:8][ext]' },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: 'public/index.html',
        // a classic <script> at the end of <body>, no type="module" and no defer
        scriptLoading: 'blocking',
        inject: 'body',
      }),
      // Starts the emulator in watch mode (npm start), does nothing in a production build.
      // Needs `npx sos login` and `npx sos organization set-default` once.
      new SignageOSPlugin(),
    ],
    // one bundle, no lazy chunks: the applet must work offline
    optimization: {
      splitChunks: false,
    },
    performance: { hints: false },
    devServer: {
      // Serves the bundle and the live reload. You open the emulator on :8090, not this port,
      // but the browser must reach both (SSH: forward 8090 and 8172, see README.md).
      // An uncommon port on purpose: 8080 is often taken (Docker, other dev servers).
      // Still taken? DEV_PORT=8173 npm start
      port: Number(process.env.DEV_PORT) || 8172,
      hot: false,
      liveReload: true,
      client: { overlay: false },
    },
    infrastructureLogging: { level: 'warn' },
  }
}
