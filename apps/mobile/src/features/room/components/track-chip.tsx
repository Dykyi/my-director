import { View } from 'react-native';

import { Chip } from '@ui/chip';
import { cn } from '@ui/cn';

import type { TrackChipView } from '../room-labels';

const SPEAKING_BARS = ['h-1.5', 'h-2.5', 'h-2'] as const;

export function TrackChip({ track }: { track: TrackChipView }) {
  return (
    <Chip kind="track" label={track.label} tone={track.tone} icon={track.icon}>
      {track.speaking && (
        <View accessibilityLabel="speaking" className="flex-row items-end gap-0.5">
          {SPEAKING_BARS.map((height) => (
            <View key={height} className={cn('w-0.5 rounded-pill bg-success', height)} />
          ))}
        </View>
      )}
    </Chip>
  );
}
