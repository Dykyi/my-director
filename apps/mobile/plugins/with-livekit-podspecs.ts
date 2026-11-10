import { withPodfile, type ConfigPlugin } from 'expo/config-plugins';

// LiveKitClient's WebRTC and FFI pods are published only in LiveKit's own spec repo.
const SPEC_SOURCES = [
  "source 'https://github.com/livekit/podspecs.git'",
  "source 'https://cdn.cocoapods.org/'",
];

const withLiveKitPodspecs: ConfigPlugin = (config) =>
  withPodfile(config, (podfileConfig) => {
    const { contents } = podfileConfig.modResults;
    const missing = SPEC_SOURCES.filter((line) => !contents.includes(line));
    podfileConfig.modResults.contents = [...missing, contents].join('\n');
    return podfileConfig;
  });

export default withLiveKitPodspecs;
