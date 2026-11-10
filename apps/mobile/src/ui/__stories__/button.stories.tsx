import type { Meta, StoryObj } from '@storybook/react-native';

import { iconControl, selectOf } from '@test/story-controls';

import { Button } from '../button';
import type { ButtonSize, ButtonVariant } from '../button-classes';

const meta = {
  title: 'UI/Controls/Button',
  component: Button,
  args: {
    title: 'Start recording',
    variant: 'record',
    size: 'large',
    icon: 'dot',
    disabled: false,
    iconOnly: false,
    onPress: () => {},
  },
  argTypes: {
    variant: selectOf<ButtonVariant>({
      record: true,
      primary: true,
      resume: true,
      upload: true,
      raised: true,
      ghost: true,
      delete: true,
      danger: true,
      notice: true,
    }),
    size: selectOf<ButtonSize>({ large: true, regular: true, compact: true }),
    icon: iconControl,
  },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Record: Story = {};
export const PauseRaised: Story = { args: { title: 'Pause', variant: 'raised', icon: 'pause' } };
export const StopPrimary: Story = { args: { title: 'Stop', variant: 'primary', icon: 'stop' } };
export const Resume: Story = { args: { title: 'Resume', variant: 'resume', icon: 'play' } };
export const StopAndKeep: Story = {
  args: { title: 'Stop and keep 2 segments', variant: 'raised', size: 'regular', icon: undefined },
};
export const Upload: Story = {
  args: { title: 'Upload', variant: 'upload', size: 'compact', icon: undefined },
};
export const DeleteSquare: Story = {
  args: {
    title: 'Delete recording',
    variant: 'delete',
    size: 'compact',
    icon: 'trash',
    iconOnly: true,
  },
};
export const Notice: Story = {
  args: { title: 'Reconnect', variant: 'notice', size: 'compact', icon: 'rotate' },
};
export const Disabled: Story = {
  args: { title: 'Finishing file…', disabled: true, icon: undefined },
};
