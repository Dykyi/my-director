import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from './text';

export type SettingsRowItem = {
  label: string;
  value?: string;
  mono?: boolean;
  control?: ReactNode;
};

const row = cva('flex-row items-center gap-3 px-3.5', {
  variants: {
    control: { true: 'min-h-12', false: 'min-h-11' },
    first: { false: 'border-t border-border' },
  },
});

const rowLabel = cva('', {
  variants: { locked: { true: 'text-muted', false: 'text-foreground' } },
});

function SettingsRow({
  row: item,
  first,
  locked,
}: {
  row: SettingsRowItem;
  first: boolean;
  locked: boolean;
}) {
  return (
    <View className={row({ control: item.control !== undefined, first })}>
      <Text variant="body" className={rowLabel({ locked })}>
        {item.label}
      </Text>
      <View className="flex-1 items-end">
        {item.control ?? (
          <Text
            selectable
            numberOfLines={1}
            ellipsizeMode="middle"
            variant={item.mono ? 'mono-value' : 'body'}
            className="text-right text-muted"
          >
            {item.value}
          </Text>
        )}
      </View>
    </View>
  );
}

export function SettingsGroup({
  label,
  rows,
  banner,
  note,
  action,
  locked = false,
}: {
  label: string;
  rows: SettingsRowItem[];
  banner?: ReactNode;
  note?: string;
  action?: ReactNode;
  locked?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="section-label" className="px-1 text-muted">
        {label}
      </Text>
      {banner}
      <View className="rounded-md border border-border border-continuous bg-surface">
        {rows.map((item, index) => (
          <SettingsRow key={item.label} row={item} first={index === 0} locked={locked} />
        ))}
      </View>
      {note !== undefined && (
        <Text variant="caption" className="px-1 text-muted">
          {note}
        </Text>
      )}
      {action}
    </View>
  );
}
