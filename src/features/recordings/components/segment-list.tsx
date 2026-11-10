import { cva } from 'class-variance-authority';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';

import { PAUSE_REASON } from '@features/capture/session-labels';
import { Chip } from '@ui/chip';
import { Icon } from '@ui/icon';
import { Text } from '@ui/text';

import type { SegmentItem } from '../player-view';

const CAPTION =
  'When a segment ends, the next one starts. Scrub inside a segment with the video controls.';

const card = cva('gap-1 rounded-md border border-continuous bg-surface p-3 active:opacity-80', {
  variants: { current: { true: 'border-accent', false: 'border-border' } },
});
const number = cva('size-8 items-center justify-center rounded-pill', {
  variants: { current: { true: 'bg-accent', false: 'bg-surface-raised' } },
});
const numberText = cva('', {
  variants: { current: { true: 'text-background', false: 'text-subtle' } },
});

function SegmentRow({ item, onSelect }: { item: SegmentItem; onSelect: (index: number) => void }) {
  const { current } = item;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play segment ${item.index}`}
      accessibilityState={{ disabled: !item.playable, selected: current }}
      disabled={!item.playable || current}
      onPress={() => onSelect(item.index)}
      className={card({ current })}
    >
      <View className="flex-row items-center gap-3">
        <View className={number({ current })}>
          <Text variant="footnote-strong" className={numberText({ current })}>
            {item.index}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="row-title" className="text-foreground">
            {item.title}
          </Text>
          <Text selectable variant="mono-meta" className="text-muted">
            {item.meta}
          </Text>
        </View>
        {item.chip ? (
          <Chip label={item.chip.label} tone={item.chip.tone} />
        ) : (
          <Icon name="play" className="size-4" tint="accent-subtle" />
        )}
      </View>
      {item.note && (
        <Text variant="footnote" className="pl-11 text-paused">
          {item.note}
        </Text>
      )}
    </Pressable>
  );
}

export function SegmentList({
  items,
  onSelect,
}: {
  items: SegmentItem[];
  onSelect: (index: number) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="section-label" className="px-1 pb-0.5 text-muted">
        SEGMENTS · {items.length}
      </Text>
      {items.map((item) => (
        <Fragment key={item.index}>
          <SegmentRow item={item} onSelect={onSelect} />
          {item.pauseAfter && (
            <View className="h-6.5 flex-row items-center gap-2 pl-6.5">
              <Icon
                name={PAUSE_REASON[item.pauseAfter].icon}
                className="size-3.5"
                tint="accent-muted"
              />
              <Text variant="caption" className="text-muted">
                {PAUSE_REASON[item.pauseAfter].title}
              </Text>
            </View>
          )}
        </Fragment>
      ))}
      <Text variant="caption" className="px-1 pt-1.5 text-muted">
        {CAPTION}
      </Text>
    </View>
  );
}
