import type { Meta, StoryObj } from '@storybook/react-native';

import { iconControl } from '@test/story-controls';

import { Button } from '../button';
import { EmptyState } from '../empty-state';

function EmptyStateStory({
  actionTitle,
  ...props
}: Parameters<typeof EmptyState>[0] & { actionTitle: string }) {
  return (
    <EmptyState {...props}>
      {actionTitle ? (
        <Button title={actionTitle} size="compact" icon="copy" onPress={() => {}} />
      ) : null}
    </EmptyState>
  );
}

const meta = {
  title: 'UI/Feedback/EmptyState',
  component: EmptyStateStory,
  args: {
    icon: 'film',
    title: 'No recordings yet',
    text: 'Start one on the Record tab.',
    actionTitle: '',
  },
  argTypes: { icon: iconControl },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof EmptyStateStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recordings: Story = {};
export const Room: Story = {
  args: {
    icon: 'users',
    title: 'Nobody else here yet',
    text: 'Send the interviewer the room name.',
    actionTitle: 'Copy room name',
  },
};
