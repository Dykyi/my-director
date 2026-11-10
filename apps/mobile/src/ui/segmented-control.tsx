import { cva } from 'class-variance-authority';
import { Pressable, View } from 'react-native';

import { Text } from './text';

type SegmentOption<T extends string> = { value: T; label: string };

const TRACK =
  'flex-row self-end rounded-segmented border border-border border-continuous bg-background p-0.5';

const segment = cva(
  'h-8 min-w-19 items-center justify-center rounded-segment border-continuous px-3',
  {
    variants: { selected: { true: '' }, locked: { true: '' } },
    compoundVariants: [
      { selected: true, locked: false, className: 'bg-segment-selected' },
      { selected: true, locked: true, className: 'bg-border' },
    ],
  },
);

const segmentText = cva('', {
  variants: { selected: { true: '' }, locked: { true: '' } },
  compoundVariants: [
    { selected: true, locked: false, className: 'text-foreground' },
    { selected: true, locked: true, className: 'text-muted' },
    { selected: false, locked: false, className: 'text-subtle' },
    { selected: false, locked: true, className: 'text-faint' },
  ],
});

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  locked = false,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  locked?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" className={TRACK}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: locked }}
            disabled={locked}
            onPress={() => onChange(option.value)}
            className={segment({ selected, locked })}
          >
            <Text variant="link" className={segmentText({ selected, locked })}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
