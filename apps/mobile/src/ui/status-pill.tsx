import { cva, type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';

import { cn } from './cn';
import { Text } from './text';

const pill = cva('flex-row items-center gap-1.5 rounded-pill px-2.5 py-1', {
  variants: {
    tone: {
      neutral: 'bg-surface-raised',
      recording: 'bg-recording-soft',
      paused: 'bg-paused-soft',
    },
  },
});

export type PillTone = NonNullable<VariantProps<typeof pill>['tone']>;

const pillText = cva('', {
  variants: {
    tone: {
      neutral: 'text-foreground',
      recording: 'text-recording',
      paused: 'text-paused',
    } satisfies Record<PillTone, string>,
  },
});

export function PauseMark({ barClassName }: { barClassName: string }) {
  return (
    <View className="h-2.5 flex-row gap-0.5">
      <View className={cn('w-0.75 rounded-[1px]', barClassName)} />
      <View className={cn('w-0.75 rounded-[1px]', barClassName)} />
    </View>
  );
}

function Mark({ tone }: { tone: PillTone }) {
  switch (tone) {
    case 'neutral':
      return <View className="size-2.5 rounded-pill border-[1.5px] border-muted" />;
    case 'recording':
      return <View className="size-2.5 rounded-pill bg-recording-dot" />;
    case 'paused':
      return <PauseMark barClassName="bg-paused" />;
  }
}

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <View accessibilityRole="header" className={pill({ tone })}>
      <Mark tone={tone} />
      <Text variant="pill-label" className={pillText({ tone })}>
        {label}
      </Text>
    </View>
  );
}
