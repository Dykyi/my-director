import type { Meta, StoryObj } from '@storybook/react-native';
import { useEffect, useState } from 'react';

import { SegmentedControl } from '../segmented-control';

const CAMERA = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
];
const APPEARANCE = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const meta = {
  title: 'UI/Controls/SegmentedControl',
  component: SegmentedControl,
  args: { options: CAMERA, value: 'front', locked: false, onChange: () => {} },
  argTypes: { options: { control: { type: 'object' } } },
  parameters: { inset: 'centered' },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return <SegmentedControl {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Camera: Story = {};
export const Appearance: Story = { args: { options: APPEARANCE, value: 'system' } };
export const Locked: Story = { args: { locked: true } };
