import type { Meta, StoryObj } from '@storybook/react-native';

import { selectOf } from '@test/story-controls';
import { TYPE_STYLES } from '@theme/type-styles';

import { Text } from '../text';

const meta = {
  title: 'UI/Type/Text',
  component: Text,
  args: {
    variant: 'body',
    className: 'text-foreground',
    children: 'Segment 2 is closed and safe on disk.',
  },
  argTypes: { variant: selectOf(TYPE_STYLES) },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof Text>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Body: Story = {};
export const Timer: Story = { args: { variant: 'timer', children: '05:12' } };
export const Muted: Story = { args: { variant: 'footnote', className: 'text-muted' } };
