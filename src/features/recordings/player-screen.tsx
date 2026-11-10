import { router, useLocalSearchParams } from 'expo-router';

import { Player } from './components/player';

export function PlayerScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  return <Player uri={uri} onClose={() => router.back()} />;
}
