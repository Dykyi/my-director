import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';

const button = cva('items-center justify-center active:opacity-60', {
  variants: {
    look: {
      plain: 'size-10',
      round: 'size-11 rounded-pill bg-surface-raised',
    },
  },
  defaultVariants: { look: 'plain' },
});

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  look,
}: VariantProps<typeof button> & {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      className={button({ look })}
    >
      <Icon name={icon} className="size-4.5" tint={disabled ? 'accent-faint' : 'accent-accent'} />
    </Pressable>
  );
}

export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={onPress}
      className="size-11 items-center justify-center rounded-pill bg-surface-raised active:opacity-60"
    >
      <Icon name="close" className="size-3.5" tint="accent-subtle" />
    </Pressable>
  );
}
