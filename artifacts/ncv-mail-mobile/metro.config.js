const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro walks the entire pnpm node_modules tree. `vite-plugin-pwa`
// (used by the web artifact) creates short-lived `vite-plugin-pwa_tmp_*`
// directories during web builds, which Metro tries to watch and then
// crashes when they disappear (ENOENT). Block them out — Metro has no
// business looking at web-only build artifacts anyway.
const pwaBlocks = [
  /\/node_modules\/.*\/vite-plugin-pwa\/.*/,
  /\/node_modules\/.*vite-plugin-pwa_tmp_.*/,
  /\/node_modules\/.pnpm\/vite-plugin-pwa[^/]*\/.*/,
];

config.resolver = config.resolver || {};
const existingBlockList = config.resolver.blockList;
const existingBlocks = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList
    ? [existingBlockList]
    : [];
config.resolver.blockList = [...existingBlocks, ...pwaBlocks];

module.exports = config;
