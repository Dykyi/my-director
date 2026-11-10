import { useVideoPlayer, VideoView } from 'expo-video';
import { View } from 'react-native';
import { withUniwind } from 'uniwind';

import { CloseButton } from '@ui/icon-button';

const Video = withUniwind(VideoView);

export function Player({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (instance) => instance.play());
  return (
    <View className="flex-1 bg-backdrop">
      <Video player={player} className="flex-1" nativeControls contentFit="contain" />
      <View className="absolute right-4 top-4">
        <CloseButton onPress={onClose} />
      </View>
    </View>
  );
}
