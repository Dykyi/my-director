import { View } from 'react-native';

import { Button } from '@ui/button';
import { Text } from '@ui/text';

export function CrashRow({ onCrash }: { onCrash?: () => void }) {
  return (
    <View className="flex-row items-center gap-2.5 px-4 py-2.5">
      <Text variant="caption" className="text-muted">
        Debug build only
      </Text>
      <Button
        title="Simulate crash"
        variant="danger"
        size="compact"
        className="ml-auto"
        onPress={onCrash}
      />
    </View>
  );
}
