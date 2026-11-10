import { cva } from 'class-variance-authority';
import { View } from 'react-native';

import { Button } from '@ui/button';
import { Icon } from '@ui/icon';
import { Text } from '@ui/text';

import type { AccessAction, AccessCardView } from '../access-card-view';

const status = cva('ml-auto', {
  variants: {
    tone: {
      muted: 'text-muted',
      accent: 'text-accent',
      success: 'text-success',
      danger: 'text-danger',
    },
  },
});

export function AccessCard({
  card,
  onAction,
}: {
  card: AccessCardView;
  onAction: (action: AccessAction) => void;
}) {
  const { primary, secondary } = card;
  return (
    <View className="w-full gap-3.5 rounded-xl border border-border border-continuous bg-background p-5">
      <Text variant="title" className="text-foreground">
        {card.title}
      </Text>
      <Text variant="body" className="text-subtle">
        {card.body}
      </Text>
      <View>
        {card.rows.map((row) => (
          <View key={row.label} className="h-11 flex-row items-center gap-3 border-t border-border">
            <Icon name={row.icon} className="size-5.5" tint="accent-subtle" />
            <Text variant="row-title" className="text-foreground">
              {row.label}
            </Text>
            <Text variant="footnote-strong" className={status({ tone: row.tone })}>
              {row.status}
            </Text>
          </View>
        ))}
      </View>
      <Button title={primary.title} variant="primary" onPress={() => onAction(primary.action)} />
      {secondary && (
        <Button
          title={secondary.title}
          variant="ghost"
          onPress={() => onAction(secondary.action)}
        />
      )}
    </View>
  );
}
