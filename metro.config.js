// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Data loaded lazily at runtime ships as assets: the pronunciation dictionary
// (assets/data/cmudict.txt) and the handwriting model (assets/models/handwriting.bin).
config.resolver.assetExts.push('txt', 'bin');

module.exports = config;
