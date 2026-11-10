import { cva } from 'class-variance-authority';

import type { TypeStyle } from '@theme/type-styles';

import { cn } from './cn';

const BUTTON_VARIANT = {
  record: {
    frame: 'border-record bg-record',
    label: 'text-on-record',
    tint: 'accent-on-record',
    filled: true,
  },
  primary: {
    frame: 'border-primary bg-primary',
    label: 'text-on-primary',
    tint: 'accent-on-primary',
    filled: true,
  },
  resume: {
    frame: 'border-resume bg-resume',
    label: 'text-on-resume',
    tint: 'accent-on-resume',
    filled: true,
  },
  upload: {
    frame: 'border-upload bg-upload',
    label: 'text-on-upload',
    tint: 'accent-on-upload',
    filled: true,
  },
  raised: {
    frame: 'border-border-strong bg-surface-raised',
    label: 'text-foreground',
    tint: 'accent-foreground',
    filled: false,
  },
  ghost: {
    frame: 'border-border-strong',
    label: 'text-subtle',
    tint: 'accent-subtle',
    filled: false,
  },
  delete: {
    frame: 'border-border-strong',
    label: 'text-danger',
    tint: 'accent-danger',
    filled: false,
  },
  danger: {
    frame: 'border-danger-line',
    label: 'text-danger',
    tint: 'accent-danger',
    filled: false,
  },
  notice: {
    frame: 'border-warning-line bg-warning-soft',
    label: 'text-on-warning-soft',
    tint: 'accent-warning',
    filled: false,
  },
} satisfies Record<string, { frame: string; label: string; tint: string; filled: boolean }>;

const SIZE = {
  large: {
    frame: 'h-15 rounded-lg',
    iconOnly: 'w-15',
    icon: 'size-4',
    bold: 'button-large',
    quiet: 'button-large-quiet',
  },
  regular: {
    frame: 'h-12 rounded-md',
    iconOnly: 'w-12',
    icon: 'size-3.5',
    bold: 'button',
    quiet: 'button-quiet',
  },
  compact: {
    frame: 'h-11 rounded-sm',
    iconOnly: 'w-11',
    icon: 'size-3.25',
    bold: 'button-compact',
    quiet: 'button-compact-quiet',
  },
} satisfies Record<
  string,
  { frame: string; iconOnly: string; icon: string; bold: TypeStyle; quiet: TypeStyle }
>;

export type ButtonVariant = keyof typeof BUTTON_VARIANT;
export type ButtonSize = keyof typeof SIZE;
export type ButtonLook = {
  variant: ButtonVariant;
  size: ButtonSize;
  disabled: boolean;
  iconOnly: boolean;
};

// cn keeps the later class of a kind, so the disabled colours win over the variant's.
const frame = cva(
  'flex-row items-center justify-center gap-2 border border-continuous px-4 active:opacity-70',
  {
    variants: {
      disabled: { true: 'border-border bg-transparent' },
      iconOnly: { true: 'px-0' },
    },
  },
);

export function buttonClasses({ variant, size, disabled, iconOnly }: ButtonLook) {
  const look = BUTTON_VARIANT[variant];
  const sized = SIZE[size];
  return {
    frame: cn(look.frame, sized.frame, frame({ disabled, iconOnly }), iconOnly && sized.iconOnly),
    icon: iconOnly ? 'size-4.5' : sized.icon,
    tint: disabled ? 'accent-muted' : look.tint,
    label: disabled ? 'text-muted' : look.label,
    textStyle: look.filled && !disabled ? sized.bold : sized.quiet,
  };
}
