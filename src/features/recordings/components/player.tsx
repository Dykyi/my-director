import { useVideoPlayer, VideoView } from 'expo-video';
import { View } from 'react-native';

import { ActionButton } from '@features/capture/components/action-button';
import { colors, gutter } from '@features/capture/components/theme';

export function Player({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (instance) => instance.play());
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground, padding: gutter, gap: 12 }}>
      <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />
      <ActionButton title="Close" onPress={onClose} />
    </View>
  );
}
