import type { Meta, StoryObj } from '@storybook/react-native';

import { Button } from '../button';
import { ErrorNotice, WarningNotice } from '../notice';

function NoticeStory({
  kind,
  title,
  message,
  locked,
  linkTitle,
  actionTitle,
}: {
  kind: 'warning' | 'error';
  title: string;
  message: string;
  locked: boolean;
  linkTitle: string;
  actionTitle: string;
}) {
  if (kind === 'error') {
    return (
      <ErrorNotice title={title} message={message}>
        <Button title={actionTitle} size="compact" onPress={() => {}} />
      </ErrorNotice>
    );
  }
  const link = linkTitle ? { title: linkTitle, onPress: () => {} } : undefined;
  return <WarningNotice message={message} locked={locked} link={link} />;
}

const meta = {
  title: 'UI/Feedback/Notice',
  component: NoticeStory,
  args: {
    kind: 'warning',
    title: 'Camera access is off',
    message: 'The call dropped. The recording goes on.',
    locked: false,
    linkTitle: '',
    actionTitle: 'Open Settings',
  },
  argTypes: { kind: { control: { type: 'radio' }, options: ['warning', 'error'] } },
} satisfies Meta<typeof NoticeStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Warning: Story = {};
export const CameraLocked: Story = {
  args: { message: 'Stop the recording to change the camera.', locked: true, linkTitle: 'Record' },
};
export const Error: Story = {
  args: { kind: 'error', message: 'Allow the camera in Settings to record.' },
};
