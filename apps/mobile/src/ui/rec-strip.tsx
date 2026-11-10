import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable } from 'react-native';

import { PauseMark, StatusDot } from './status-dot';
import { Text } from './text';

const strip = cva('h-10 flex-row items-center gap-2 px-4 active:opacity-70', {
  variants: { tone: { recording: 'bg-recording-soft', paused: 'bg-paused-soft' } },
});

export type StripTone = NonNullable<VariantProps<typeof strip>['tone']>;

const stripText = cva('', {
  variants: {
    tone: { recording: 'text-recording', paused: 'text-paused' } satisfies Record<
      StripTone,
      string
    >,
  },
});

const stripDetail = cva('', {
  variants: {
    tone: {
      recording: 'text-recording-detail',
      paused: 'text-paused',
    } satisfies Record<StripTone, string>,
  },
});

export function RecStrip({
  tone,
  label,
  time,
  detail,
  onPress,
}: {
  tone: StripTone;
  label: string;
  time: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${time}, back to Record`}
      onPress={onPress}
      className={strip({ tone })}
    >
      {tone === 'paused' ? <PauseMark barClassName="bg-paused" /> : <StatusDot tone="recording" />}
      <Text variant="footnote-strong" className={stripText({ tone })}>
        {label}
      </Text>
      <Text variant="mono-meta" className={stripText({ tone })}>
        {time}
      </Text>
      <Text variant="footnote" className={stripDetail({ tone })}>
        {detail}
      </Text>
      <Text variant="footnote-strong" className={`ml-auto ${stripText({ tone })}`}>
        Back to Record ›
      </Text>
    </Pressable>
  );
}
