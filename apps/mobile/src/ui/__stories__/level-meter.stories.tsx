import type { Meta, StoryObj } from '@storybook/react-native';

import { rangeOf, selectOf } from '@test/story-controls';

import { LevelMeter, type MeterSize } from '../level-meter';

const meta = {
  title: 'UI/Status/LevelMeter',
  component: LevelMeter,
  args: { lit: 3, total: 5, size: 'grid' },
  argTypes: {
    lit: rangeOf(0, 10),
    total: rangeOf(1, 10),
    size: selectOf<MeterSize>({ grid: true, chip: true }),
  },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof LevelMeter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Grid: Story = {};
export const Chip: Story = { args: { size: 'chip' } };
export const Silent: Story = { args: { lit: 0 } };
