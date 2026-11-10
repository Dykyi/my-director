import { cva, type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';

import { PauseMark, StatusDot } from './status-dot';
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

function Mark({ tone }: { tone: PillTone }) {
  switch (tone) {
    case 'neutral':
      return <StatusDot tone="idle" />;
    case 'recording':
      return <StatusDot tone="recording" />;
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
