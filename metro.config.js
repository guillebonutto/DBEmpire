const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
    transform: {
        experimentalImportSupport: true,
        inlineRequires: true,
    },
});

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.assetExts.push('wasm', 'pdf');

config.resolver.blockList = [
    ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList].filter(Boolean)),
    /.*[\\/]android[\\/]build[\\/].*/,
    /.*[\\/]\.gradle[\\/].*/,
    /.*[\\/]node_modules[\\/].*[\\/]build[\\/]classes[\\/]kotlin[\\/].*/,
    /.*[\\/]node_modules[\\/].*[\\/]build[\\/]kotlin[\\/].*/,
    /.*[\\/]node_modules[\\/].*gradle-plugin[\\/]build[\\/].*/,
];

module.exports = config;