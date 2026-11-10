import type { Meta, StoryObj } from '@storybook/react-native';

import type { HealthLineView } from '../../session-issues';
import { HealthLine } from '../health-line';

function HealthLineStory({
  tone,
  text,
  detail,
}: {
  tone: HealthLineView['tone'];
  text: string;
  detail: string;
}) {
  const view: HealthLineView =
    tone === 'warning' || tone === 'error'
      ? { tone, text, detail: detail || undefined }
      : { tone, text };
  return <HealthLine view={view} onPress={() => {}} />;
}

const meta = {
  title: 'Features/Record/HealthLine',
  component: HealthLineStory,
  args: { tone: 'ok', text: 'Camera and microphone ready', detail: '' },
  argTypes: { tone: { control: { type: 'radio' }, options: ['ok', 'paused', 'warning', 'error'] } },
  parameters: { inset: 'none' },
} satisfies Meta<typeof HealthLineStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ok: Story = {};
export const Paused: Story = {
  args: { tone: 'paused', text: 'Paused · segment 2 is safe on disk' },
};
export const Warning: Story = {
  args: { tone: 'warning', text: 'Call quality poor', detail: 'the recording is not affected' },
};
export const Error: Story = {
  args: { tone: 'error', text: 'The microphone stopped', detail: 'segment 2 closed' },
};
