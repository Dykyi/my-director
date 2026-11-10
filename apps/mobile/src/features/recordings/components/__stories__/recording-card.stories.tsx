import type { Meta, StoryObj } from '@storybook/react-native';

import type { RecordingState } from '@modules/capture-core';

import { UploadProgress } from '@features/upload/components/upload-progress';
import { recording, segment } from '@test/session-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { segmentLine } from '../../recording-labels';
import { RecordingCard } from '../recording-card';

const handlers = {
  play: () => {},
  verify: () => {},
  upload: () => {},
  cancel: () => {},
  delete: () => {},
};
const actions = {
  startRecording: async () => true,
  retry: async () => true,
  cancel: async () => true,
  cancelRecording: async () => true,
  removeFromBucket: async () => true,
};

type Upload = 'none' | 'uploading' | 'uploaded';

function RecordingCardStory({
  state,
  segments,
  upload,
  isActive,
}: {
  state: RecordingState;
  segments: number;
  upload: Upload;
  isActive: boolean;
}) {
  const parts = Array.from({ length: segments }, (_, index) => segment(index + 1));
  return (
    <RecordingCard
      recording={recording({ state, segments: parts })}
      status={{
        pending: upload === 'none' ? parts : [],
        uploading: upload === 'uploading',
        verified: upload === 'uploaded',
      }}
      isActive={isActive}
      handlers={handlers}
      renderSegment={(item) => (
        <UploadProgress
          key={item.index}
          label={segmentLine(item)}
          actions={actions}
          upload={
            upload === 'none'
              ? undefined
              : {
                  id: `job-${item.index}`,
                  fileUri: item.uri,
                  objectKey: `2026-11-10T09-12-33Z-4F2A/segment-00${item.index}.mov`,
                  uploadId: 'upload-1',
                  phase: upload === 'uploaded' ? 'verified' : 'uploading',
                  bytesTotal: item.bytes,
                  bytesConfirmed: upload === 'uploaded' ? item.bytes : item.bytes / 3,
                  partsTotal: 12,
                  partsDone: upload === 'uploaded' ? 12 : 4,
                  retries: [],
                  updatedAt: '2026-11-10T09:31:00.000Z',
                }
          }
        />
      )}
    />
  );
}

const meta = {
  title: 'Features/Recordings/RecordingCard',
  component: RecordingCardStory,
  args: { state: 'finished', segments: 2, upload: 'none', isActive: false },
  argTypes: {
    state: selectOf<RecordingState>({
      recording: true,
      paused: true,
      finished: true,
      recovered: true,
    }),
    segments: rangeOf(1, 5),
    upload: { control: { type: 'radio' }, options: ['none', 'uploading', 'uploaded'] },
  },
} satisfies Meta<typeof RecordingCardStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotUploaded: Story = {};
export const Uploading: Story = { args: { upload: 'uploading' } };
export const Uploaded: Story = { args: { upload: 'uploaded' } };
export const Recovered: Story = { args: { state: 'recovered' } };
export const BeingRecorded: Story = { args: { state: 'recording', isActive: true } };
