import { cva } from 'class-variance-authority';
import { View } from 'react-native';

import { cn } from './cn';
import { Text } from './text';
import { chipBar, chipGround, chipText, type ChipTone } from './tone';

const BAR_HEIGHTS = ['h-1', 'h-[7px]', 'h-2.5'] as const;

const bar = cva('w-[2.5px] rounded-[0.5px]', {
  variants: { lit: { false: 'bg-border-strong' } },
});

export function QualityChip({
  label,
  tone,
  lit,
  className,
}: {
  label: string;
  tone: ChipTone;
  lit: number;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.25 self-start rounded-pill px-2.25 py-0.75',
        chipGround({ tone }),
        className,
      )}
    >
      <View className="flex-row items-end gap-0.5">
        {BAR_HEIGHTS.map((height, index) => {
          const isLit = index < lit;
          return (
            <View
              key={height}
              className={cn(bar({ lit: isLit }), height, isLit && chipBar({ tone }))}
            />
          );
        })}
      </View>
      <Text variant="chip-label" className={chipText({ tone })}>
        {label}
      </Text>
    </View>
  );
}
