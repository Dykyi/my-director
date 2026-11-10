import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ScopedTheme, withUniwind } from 'uniwind';

import {
  CapturePreview,
  type CaptureConfig,
  type HealthSnapshot,
  type SessionSnapshot,
} from '@modules/capture-core';

import { Icon } from '@ui/icon';
import { LevelMeter } from '@ui/level-meter';
import { Text } from '@ui/text';

import { micChip, pausedView, previewCaption, recChipText } from '../record-views';
import { METER_BARS } from '../session-labels';

const NativePreview = withUniwind(CapturePreview);

function RecordingChips({ health }: { health: HealthSnapshot }) {
  const mic = micChip(health);
  return (
    <>
      <View className="absolute right-3 top-2.5 rounded-chip border-continuous bg-overlay px-2 py-0.75">
        <Text variant="log" className="text-subtle">
          {recChipText(health)}
        </Text>
      </View>
      <View className="absolute bottom-2.5 left-3 flex-row items-center gap-2 rounded-tag border-continuous bg-overlay px-2.25 py-1.25">
        <Text variant="log" className="text-subtle">
          MIC
        </Text>
        <LevelMeter size="chip" lit={mic.lit} total={METER_BARS} />
        <Text variant="log" className="text-subtle">
          {mic.level}
        </Text>
      </View>
    </>
  );
}

function PausedOverlay({ snapshot }: { snapshot: SessionSnapshot }) {
  const view = pausedView(snapshot.pauseReason ?? 'user', snapshot.segmentIndex);
  return (
    <View className="absolute inset-0 items-center justify-center gap-3 bg-surface px-8">
      <Icon name={view.icon} className="size-12" tint="accent-faint" />
      <Text variant="overlay-title" className="text-center text-paused">
        {view.title}
      </Text>
      <Text variant="callout" className="text-center text-subtle">
        {view.text}
      </Text>
    </View>
  );
}

export function PreviewPanel({
  snapshot,
  health,
  camera,
  accessCard,
}: {
  snapshot: SessionSnapshot;
  health: HealthSnapshot | null;
  camera: CaptureConfig['camera'];
  accessCard?: ReactNode;
}) {
  const { phase } = snapshot;
  const cameraLive = phase !== 'idle' && phase !== 'preparing';
  return (
    <ScopedTheme theme="dark">
      <View className="flex-1 overflow-hidden bg-surface">
        {cameraLive ? (
          <NativePreview className="absolute inset-0" videoGravity="aspectFill" />
        ) : accessCard ? (
          <View className="flex-1 justify-center p-4">{accessCard}</View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text variant="callout" className="text-muted">
              {phase === 'preparing' ? 'Starting camera…' : 'Camera off'}
            </Text>
          </View>
        )}
        {phase === 'ready' && (
          <Text variant="caption" className="absolute bottom-2.5 left-3 text-muted">
            {previewCaption(camera)}
          </Text>
        )}
        {phase === 'recording' && health && <RecordingChips health={health} />}
        {phase === 'paused' && <PausedOverlay snapshot={snapshot} />}
      </View>
    </ScopedTheme>
  );
}
