import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { TypeStyle } from '@theme/type-styles';

import { cn } from './cn';
import { Icon } from './icon';
import type { IconName } from './icons';
import { Text } from './text';
import { chipGround, chipText, chipTint, type ChipTone } from './tone';

const chip = cva('flex-row items-center self-start', {
  variants: {
    kind: {
      state: 'rounded-pill px-2 py-0.5',
      count: 'rounded-pill px-1.75 py-0.25',
      track: 'gap-1.5 rounded-tag border-continuous px-2.5 py-1.25',
    },
  },
});

export type ChipKind = NonNullable<VariantProps<typeof chip>['kind']>;

const LABEL: Record<ChipKind, TypeStyle> = {
  state: 'chip-label',
  count: 'count-label',
  track: 'chip-label',
};

export function Chip({
  label,
  tone,
  kind = 'state',
  icon,
  children,
  className,
}: {
  kind?: ChipKind;
  label: string;
  tone: ChipTone;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn(chip({ kind }), chipGround({ tone }), className)}>
      {icon && <Icon name={icon} className="size-3.5" tint={chipTint({ tone })} />}
      <Text variant={LABEL[kind]} className={chipText({ tone })}>
        {label}
      </Text>
      {children}
    </View>
  );
}
