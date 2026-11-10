import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable } from 'react-native';

import type { TypeStyle } from '@theme/type-styles';

import { cn } from './cn';
import { Icon } from './icon';
import type { IconName } from './icons';
import { Text } from './text';

const button = cva(
  'flex-row items-center justify-center gap-2 border border-continuous px-4 active:opacity-70',
  {
    variants: {
      variant: {
        record: 'border-record bg-record',
        primary: 'border-primary bg-primary',
        resume: 'border-resume bg-resume',
        upload: 'border-upload bg-upload',
        raised: 'border-border-strong bg-surface-raised',
        ghost: 'border-border-strong',
        delete: 'border-border-strong',
        danger: 'border-danger-line',
        notice: 'border-warning-line bg-warning-soft',
      },
      size: {
        large: 'h-15 rounded-lg',
        regular: 'h-12 rounded-md',
        compact: 'h-11 rounded-sm',
      },
      disabled: { true: 'border-border bg-transparent' },
      iconOnly: { true: 'px-0' },
    },
    compoundVariants: [
      { iconOnly: true, size: 'large', className: 'w-15' },
      { iconOnly: true, size: 'regular', className: 'w-12' },
      { iconOnly: true, size: 'compact', className: 'w-11' },
    ],
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof button>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof button>['size']>;

const label = cva('', {
  variants: {
    variant: {
      record: 'text-on-record',
      primary: 'text-on-primary',
      resume: 'text-on-resume',
      upload: 'text-on-upload',
      raised: 'text-foreground',
      ghost: 'text-subtle',
      delete: 'text-danger',
      danger: 'text-danger',
      notice: 'text-on-warning-soft',
    } satisfies Record<ButtonVariant, string>,
    disabled: { true: 'text-muted' },
  },
});

const tint = cva('', {
  variants: {
    variant: {
      record: 'accent-on-record',
      primary: 'accent-on-primary',
      resume: 'accent-on-resume',
      upload: 'accent-on-upload',
      raised: 'accent-foreground',
      ghost: 'accent-subtle',
      delete: 'accent-danger',
      danger: 'accent-danger',
      notice: 'accent-warning',
    } satisfies Record<ButtonVariant, string>,
    disabled: { true: 'accent-muted' },
  },
});

const icon = cva('', {
  variants: {
    size: {
      large: 'size-4',
      regular: 'size-3.5',
      compact: 'size-3.25',
    } satisfies Record<ButtonSize, string>,
    iconOnly: { true: 'size-4.5' },
  },
});

const FILLED: ReadonlySet<ButtonVariant> = new Set(['record', 'primary', 'resume', 'upload']);
const LABEL: Record<ButtonSize, { bold: TypeStyle; quiet: TypeStyle }> = {
  large: { bold: 'button-large', quiet: 'button-large-quiet' },
  regular: { bold: 'button', quiet: 'button-quiet' },
  compact: { bold: 'button-compact', quiet: 'button-compact-quiet' },
};

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
  const bold = FILLED.has(variant) && !disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(button({ variant, size, disabled, iconOnly }), className)}
    >
      {iconName && (
        <Icon
          name={iconName}
          className={cn(icon({ size, iconOnly }))}
          tint={cn(tint({ variant, disabled }))}
        />
      )}
      {!iconOnly && (
        <Text
          variant={bold ? LABEL[size].bold : LABEL[size].quiet}
          className={cn(label({ variant, disabled }))}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
