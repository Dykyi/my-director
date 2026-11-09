const { withPodfile } = require('expo/config-plugins');

const SPEC_SOURCES = [
  "source 'https://github.com/livekit/podspecs.git'",
  "source 'https://cdn.cocoapods.org/'",
];

module.exports = function withLiveKitPodspecs(config) {
  return withPodfile(config, (podfileConfig) => {
    const { contents } = podfileConfig.modResults;
    const missing = SPEC_SOURCES.filter((line) => !contents.includes(line));
    podfileConfig.modResults.contents = [...missing, contents].join('\n');
    return podfileConfig;
  });
};
