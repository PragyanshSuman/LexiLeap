/** Data files bundled as assets (see metro.config.js). Importing one gives its asset id. */
declare module '*.txt' {
  const asset: number;
  export default asset;
}

declare module '*.bin' {
  const asset: number;
  export default asset;
}
