import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable } from 'react-native';

import { cn } from './cn';
import { Text } from './text';

const textButton = cva('justify-center px-1', {
  variants: { compact: { true: 'h-8', false: 'h-9' } },
  defaultVariants: { compact: false },
});

const label = cva('', {
  variants: {
    tone: { accent: 'text-accent', warning: 'text-warning' },
    pressed: { true: '' },
    disabled: { true: 'text-faint' },
  },
  compoundVariants: [{ tone: 'accent', pressed: true, className: 'text-accent-pressed' }],
  defaultVariants: { tone: 'accent' },
});

export function TextButton({
  title,
  onPress,
  disabled = false,
  tone,
  compact,
}: VariantProps<typeof textButton> &
  Pick<VariantProps<typeof label>, 'tone'> & {
    title: string;
    onPress: () => void;
    disabled?: boolean;
  }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={textButton({ compact })}
    >
      {({ pressed }) => (
        <Text variant="link" className={cn(label({ tone, pressed, disabled }))}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
