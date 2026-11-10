import { Pressable } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
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
      className="size-10 items-center justify-center active:opacity-60"
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
