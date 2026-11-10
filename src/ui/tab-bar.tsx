import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from './text';

const badge = cva(
  'absolute -right-3.5 -top-1 h-4.5 min-w-4.5 items-center justify-center rounded-pill px-1.25',
  { variants: { severity: { warning: 'bg-resume', error: 'bg-record' } } },
);

const badgeText = cva('', {
  variants: { severity: { warning: 'text-on-resume', error: 'text-on-record' } },
});

export type TabBadge = {
  count: number;
  severity: NonNullable<VariantProps<typeof badge>['severity']>;
};

const tabLabel = cva('', { variants: { selected: { true: 'text-accent', false: 'text-muted' } } });

export function TabBar({ bottomInset, children }: { bottomInset: number; children: ReactNode }) {
  return (
    <View
      accessibilityRole="tabbar"
      className="flex-row border-t border-border bg-surface-bar px-2 pt-1.5"
      style={{ paddingBottom: bottomInset }}
    >
      {children}
    </View>
  );
}

export function TabBarItem({
  title,
  icon,
  selected,
  badge: tabBadge,
  onPress,
}: {
  title: string;
  icon: ReactNode;
  selected: boolean;
  badge?: TabBadge;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={tabBadge ? `${title}, ${tabBadge.count} ${tabBadge.severity}` : title}
      onPress={onPress}
      className="h-12.25 flex-1 items-center justify-center gap-0.75"
    >
      <View>
        {icon}
        {tabBadge && (
          <View className={badge({ severity: tabBadge.severity })}>
            <Text variant="badge-label" className={badgeText({ severity: tabBadge.severity })}>
              {tabBadge.count}
            </Text>
          </View>
        )}
      </View>
      <Text
        variant={selected ? 'tab-label-active' : 'tab-label'}
        className={tabLabel({ selected })}
      >
        {title}
      </Text>
    </Pressable>
  );
}
