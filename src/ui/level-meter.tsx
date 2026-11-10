import { cva, type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';

const bar = cva('h-2.5', {
  variants: {
    size: { grid: 'w-1.5', chip: 'w-[5px]' },
    lit: { true: 'bg-success', false: 'bg-meter-off' },
  },
});

export type MeterSize = NonNullable<VariantProps<typeof bar>['size']>;

export function LevelMeter({ lit, total, size }: { lit: number; total: number; size: MeterSize }) {
  return (
    <View accessibilityElementsHidden className="flex-row gap-0.5">
      {Array.from({ length: total }, (_, index) => (
        <View key={index} className={bar({ size, lit: index < lit })} />
      ))}
    </View>
  );
}
