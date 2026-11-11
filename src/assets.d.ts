// webpack turns image imports into a URL string (asset/resource in webpack.config.js)
declare module '*.svg' {
  const url: string
  export default url
}
declare module '*.png' {
  const url: string
  export default url
}
declare module '*.jpg' {
  const url: string
  export default url
}
