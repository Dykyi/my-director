import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { useSession } from '@features/capture/capture-session-context';
import { recStripView } from '@features/capture/record-views';
import { RecStrip } from '@ui/rec-strip';
import { ScreenHeader } from '@ui/screen-header';
import { SafeAreaView } from '@ui/styled';

export function TabScreen({
  title,
  fact,
  caption,
  compact,
  children,
}: {
  title: string;
  fact?: string;
  caption?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const { snapshot } = useSession();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {snapshot.sessionId !== undefined && (
        <RecStrip {...recStripView(snapshot)} onPress={() => router.navigate('/')} />
      )}
      <ScreenHeader title={title} fact={fact} caption={caption} compact={compact} />
      {children}
    </SafeAreaView>
  );
}
