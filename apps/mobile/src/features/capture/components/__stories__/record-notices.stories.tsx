import type { Meta, StoryObj } from '@storybook/react-native';

import type { CaptureErrorCode } from '@modules/capture-core';

import { recordingSnapshot } from '@test/session-fixtures';

import { recordNotices } from '../../record-views';
import { RecordNotices } from '../record-notices';

const AT = '2026-11-10T09:15:00.000Z';
const CODES: (CaptureErrorCode | 'none')[] = [
  'none',
  'permissionDenied',
  'cameraUnavailable',
  'micUnavailable',
  'diskSpaceLow',
  'callDisconnected',
];

function RecordNoticesStory({
  error,
  warning,
  message,
  commandError,
}: {
  error: CaptureErrorCode | 'none';
  warning: CaptureErrorCode | 'none';
  message: string;
  commandError: string;
}) {
  return (
    <RecordNotices
      view={recordNotices(
        {
          ...recordingSnapshot,
          error: error === 'none' ? undefined : { code: error, message, at: AT, recoverable: true },
          warnings: warning === 'none' ? [] : [{ code: warning, message, since: AT }],
        },
        commandError || null,
      )}
      onDismiss={() => {}}
    />
  );
}

const meta = {
  title: 'Features/Record/RecordNotices',
  component: RecordNoticesStory,
  args: {
    error: 'permissionDenied',
    warning: 'none',
    message: 'Camera access is off.',
    commandError: '',
  },
  argTypes: {
    error: { control: { type: 'select' }, options: CODES },
    warning: { control: { type: 'select' }, options: CODES },
  },
} satisfies Meta<typeof RecordNoticesStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PermissionError: Story = {};
export const CallLost: Story = {
  args: {
    error: 'none',
    warning: 'callDisconnected',
    message: 'The call dropped. The recording goes on.',
  },
};
export const CommandFailed: Story = {
  args: { error: 'none', commandError: 'cameraUnavailable: The camera is in use.' },
};
