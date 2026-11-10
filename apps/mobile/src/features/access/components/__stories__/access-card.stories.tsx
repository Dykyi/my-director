import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { ScopedTheme } from 'uniwind';

import type { PermissionStatus } from '@modules/capture-core';

import { selectOf } from '@test/story-controls';

import { accessCard, type NoticesAnswer } from '../../access-card-view';
import { AccessCard } from '../access-card';

const PERMISSION = selectOf<PermissionStatus>({ granted: true, denied: true, undetermined: true });
const NOTICES = selectOf<NoticesAnswer | 'unanswered'>({
  unanswered: true,
  asked: true,
  skipped: true,
});

function AccessCardStory({
  camera,
  microphone,
  notices,
}: {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  notices: NoticesAnswer | 'unanswered';
}) {
  const card = accessCard({ camera, microphone }, notices === 'unanswered' ? undefined : notices);
  return (
    <ScopedTheme theme="dark">
      <View className="rounded-lg border-continuous bg-surface p-4">
        {card && <AccessCard card={card} onAction={() => {}} />}
      </View>
    </ScopedTheme>
  );
}

const meta = {
  title: 'Features/Record/AccessCard',
  component: AccessCardStory,
  args: { camera: 'undetermined', microphone: 'undetermined', notices: 'unanswered' },
  argTypes: { camera: PERMISSION, microphone: PERMISSION, notices: NOTICES },
} satisfies Meta<typeof AccessCardStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstLaunch: Story = {};
export const UploadNotices: Story = { args: { camera: 'granted', microphone: 'granted' } };
export const MicrophoneOff: Story = { args: { camera: 'granted', microphone: 'denied' } };
export const BothOff: Story = { args: { camera: 'denied', microphone: 'denied' } };
