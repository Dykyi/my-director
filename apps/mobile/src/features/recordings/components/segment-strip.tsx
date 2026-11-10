import { cva } from 'class-variance-authority';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';

import { PAUSE_REASON } from '@features/capture/session-labels';
import { PERCENT } from '@shared/units';
import { Icon } from '@ui/icon';
import { Text } from '@ui/text';

import type { SegmentItem } from '../player-view';

const MIN_BLOCK_SEC = 1;

const block = cva('h-3 basis-0 overflow-hidden rounded-bar border-continuous', {
  variants: {
    look: {
      current: 'border-2 border-accent bg-accent-soft',
      recovered: 'bg-paused-soft',
      plain: 'bg-border-strong',
      missing: 'bg-surface-raised',
    },
  },
});

function blockLook({ current, recovered, playable }: SegmentItem) {
  if (current) return 'current';
  if (!playable) return 'missing';
  return recovered ? 'recovered' : 'plain';
}

export function SegmentStrip({
  items,
  progress,
  overallTime,
  endsInCrash,
  onSelect,
}: {
  items: SegmentItem[];
  progress: number;
  overallTime: string;
  endsInCrash: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1">
        {items.map((item) => (
          <Fragment key={item.index}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play segment ${item.index}`}
              disabled={!item.playable || item.current}
              onPress={() => onSelect(item.index)}
              hitSlop={{ top: 12, bottom: 12 }}
              className={block({ look: blockLook(item) })}
              style={{ flexGrow: Math.max(item.durationSec, MIN_BLOCK_SEC) }}
            >
              {item.current && (
                <View className="h-full bg-progress" style={{ width: `${progress * PERCENT}%` }} />
              )}
            </Pressable>
            {item.pauseAfter && (
              <Icon
                name={PAUSE_REASON[item.pauseAfter].icon}
                className="size-3.5"
                tint="accent-muted"
              />
            )}
          </Fragment>
        ))}
        {endsInCrash && <Icon name="history" className="size-3.5" tint="accent-paused" />}
      </View>
      <View className="flex-row">
        <Text selectable variant="mono-meta" className="text-muted">
          {overallTime}
        </Text>
        <Text variant="mono-meta" className="ml-auto text-muted">
          whole recording
        </Text>
      </View>
    </View>
  );
}
