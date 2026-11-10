import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, View } from 'react-native';

import { ActionButton } from './action-button';
import { colors, gutter } from './theme';

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => instance.play());
  return <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />;
}

export function PlayerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal
      visible={uri !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.ground, padding: gutter, gap: 12 }}>
        {uri && <Player uri={uri} />}
        <ActionButton title="Close" onPress={onClose} />
      </View>
    </Modal>
  );
}
