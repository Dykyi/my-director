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
    accent: { true: '' },
    pressed: { true: '' },
    disabled: { true: 'text-faint' },
  },
  compoundVariants: [{ accent: true, pressed: true, className: 'text-accent-pressed' }],
});

export function TextButton({
  title,
  onPress,
  disabled = false,
  textClassName = 'text-accent',
  compact,
}: VariantProps<typeof textButton> & {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  textClassName?: string;
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
        <Text
          variant="link"
          className={cn(
            textClassName,
            label({ accent: textClassName === 'text-accent', pressed, disabled }),
          )}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
