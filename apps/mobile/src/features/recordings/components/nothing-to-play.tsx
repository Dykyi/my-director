import { View } from 'react-native';

import { EmptyState } from '@ui/empty-state';
import { CloseButton } from '@ui/icon-button';
import { SafeAreaView } from '@ui/styled';

export function NothingToPlay({ onClose }: { onClose: () => void }) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 gap-4 bg-background p-4">
      <View className="items-end">
        <CloseButton onPress={onClose} />
      </View>
      <EmptyState icon="film" title="Nothing to play" text="No segment of this recording opens." />
    </SafeAreaView>
  );
}
