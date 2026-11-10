import { cva } from 'class-variance-authority';
import { View } from 'react-native';

import { cn } from '@ui/cn';
import { Icon } from '@ui/icon';
import { PauseMark } from '@ui/status-dot';
import type { PillTone } from '@ui/status-pill';

const centre = cva('size-2 rounded-pill', {
  variants: { selected: { true: 'bg-accent', false: 'bg-muted' }, recording: { true: '' } },
  compoundVariants: [{ recording: true, className: 'bg-recording-dot' }],
});

export function RecordTabIcon({ tone, selected }: { tone: PillTone; selected: boolean }) {
  return (
    <View className="size-6.5 items-center justify-center">
      <Icon
        name="ring"
        className="absolute size-6.5"
        tint={selected ? 'accent-accent' : 'accent-muted'}
      />
      {tone === 'paused' ? (
        <PauseMark barClassName="bg-paused" />
      ) : (
        <View className={cn(centre({ selected, recording: tone === 'recording' }))} />
      )}
    </View>
  );
}
