const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Metro's default resolver handles the Firebase ESM/CJS dual builds fine; the
// app simply needs deterministic resolution order so the same bundle is produced
// for iOS, Android and the web preview.
config.resolver.sourceExts = Array.from(
  new Set([...config.resolver.sourceExts, 'cjs', 'mjs']),
).sort();

module.exports = config;
