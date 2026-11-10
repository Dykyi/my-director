import { Pressable } from 'react-native';

import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-classes';
import { cn } from './cn';
import { Icon } from './icon';
import type { IconName } from './icons';
import { Text } from './text';

export function Button({
  title,
  onPress,
  variant = 'raised',
  size = 'regular',
  icon: iconName,
  disabled = false,
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  title: string;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  const classes = buttonClasses({ variant, size, disabled, iconOnly });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(classes.frame, className)}
    >
      {iconName && <Icon name={iconName} className={classes.icon} tint={classes.tint} />}
      {!iconOnly && (
        <Text variant={classes.textStyle} className={classes.label}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
