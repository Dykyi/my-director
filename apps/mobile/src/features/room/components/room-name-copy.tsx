import * as Clipboard from 'expo-clipboard';
import { View } from 'react-native';

import { Button } from '@ui/button';
import { Text } from '@ui/text';

export function RoomNameCopy({ room }: { room: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="rounded-tag border border-border border-continuous bg-surface px-3 py-2">
        <Text selectable variant="mono-body" className="text-foreground">
          {room}
        </Text>
      </View>
      <Button title="Copy" size="compact" onPress={() => void Clipboard.setStringAsync(room)} />
    </View>
  );
}
