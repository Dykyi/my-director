import { cva } from 'class-variance-authority';
import { View } from 'react-native';

import { cn } from './cn';

export type DotTone = 'idle' | 'live' | 'recording';

const dot = cva('size-2.5 rounded-pill', {
  variants: {
    tone: {
      idle: 'border-[1.5px] border-muted',
      live: 'bg-success',
      recording: 'bg-recording-dot',
    } satisfies Record<DotTone, string>,
  },
});

export function StatusDot({ tone }: { tone: DotTone }) {
  return <View className={dot({ tone })} />;
}

export function PauseMark({ barClassName }: { barClassName: string }) {
  return (
    <View className="h-2.5 flex-row gap-0.5">
      <View className={cn('w-0.75 rounded-tick', barClassName)} />
      <View className={cn('w-0.75 rounded-tick', barClassName)} />
    </View>
  );
}
