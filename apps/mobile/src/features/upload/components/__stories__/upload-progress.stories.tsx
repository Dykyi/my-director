import type { Meta, StoryObj } from '@storybook/react-native';

import type { UploadPhase } from '@modules/background-upload';

import { rangeOf, selectOf } from '@test/story-controls';

import { UploadProgress } from '../upload-progress';

const MB = 1_024 ** 2;
const PART_MB = 16;
const actions = {
  startRecording: async () => true,
  retry: async () => true,
  cancel: async () => true,
  cancelRecording: async () => true,
  removeFromBucket: async () => true,
  copyLink: async () => {},
};

function UploadProgressStory({
  uploaded,
  phase,
  partsDone,
  partsTotal,
}: {
  uploaded: boolean;
  phase: UploadPhase;
  partsDone: number;
  partsTotal: number;
}) {
  const bytesTotal = partsTotal * PART_MB * MB;
  return (
    <UploadProgress
      label={`segment-001.mov 4:12 ${partsTotal * PART_MB}.0 MB`}
      actions={actions}
      upload={
        uploaded
          ? {
              id: 'job-1',
              fileUri: 'file:///Documents/Recordings/s1/segment-001.mov',
              objectKey: '2026-11-10T09-12-33Z-4F2A/segment-001.mov',
              uploadId: '4_ze54080e31840cc2dab1e0a1b_f20003fe41981e9ac',
              phase,
              bytesTotal,
              bytesConfirmed: partsDone * PART_MB * MB,
              partsTotal,
              partsDone,
              retries: [],
              serverSize: phase === 'verified' ? bytesTotal : undefined,
              error: phase === 'failed' ? 'Part 7 failed after 5 attempts' : undefined,
              updatedAt: '2026-11-10T09:31:00.000Z',
            }
          : undefined
      }
    />
  );
}

const meta = {
  title: 'Features/Recordings/UploadProgress',
  component: UploadProgressStory,
  args: { uploaded: true, phase: 'uploading', partsDone: 6, partsTotal: 15 },
  argTypes: {
    phase: selectOf<UploadPhase>({
      preparing: true,
      uploading: true,
      completing: true,
      verified: true,
      failed: true,
      cancelled: true,
    }),
    partsDone: rangeOf(0, 30),
    partsTotal: rangeOf(1, 30),
  },
} satisfies Meta<typeof UploadProgressStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SixOfFifteenParts: Story = {};
export const OnServer: Story = { args: { phase: 'verified', partsDone: 15 } };
export const Failed: Story = { args: { phase: 'failed' } };
export const NotUploaded: Story = { args: { uploaded: false } };
