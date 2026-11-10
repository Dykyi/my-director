import type { Meta, StoryObj } from '@storybook/react-native';

import { segment } from '@test/session-fixtures';
import { rangeOf } from '@test/story-controls';

import { lossNote } from '../../recording-labels';
import { RecoveryDialog } from '../recovery-dialog';

function RecoveryDialogStory({
  playable,
  unplayable,
  recoveredSec,
  knownLossSec,
  maxUnseenLossSec,
  fragmentIntervalSec,
  heartbeatIntervalSec,
}: {
  playable: number;
  unplayable: number;
  recoveredSec: number;
  knownLossSec: number;
  maxUnseenLossSec: number;
  fragmentIntervalSec: number;
  heartbeatIntervalSec: number;
}) {
  const segments = [
    ...Array.from({ length: playable }, (_, index) => segment(index + 1, { state: 'recovered' })),
    ...Array.from({ length: unplayable }, (_, index) =>
      segment(playable + index + 1, { state: 'unplayable' }),
    ),
  ];
  return (
    <RecoveryDialog
      report={{
        sessionId: '2026-11-10T09-12-33Z-4F2A',
        createdAt: '2026-11-10T09:12:33.000Z',
        segments,
        recoveredSec,
        knownLossSec,
        maxUnseenLossSec,
      }}
      note={lossNote({ recording: { fragmentIntervalSec }, session: { heartbeatIntervalSec } })}
      onPlay={() => {}}
      onVerify={() => {}}
      onDismiss={() => {}}
    />
  );
}

const meta = {
  title: 'Features/Recordings/RecoveryDialog',
  component: RecoveryDialogStory,
  args: {
    playable: 2,
    unplayable: 0,
    recoveredSec: 252,
    knownLossSec: 0.4,
    maxUnseenLossSec: 1,
    fragmentIntervalSec: 2,
    heartbeatIntervalSec: 1,
  },
  argTypes: {
    playable: rangeOf(0, 5),
    unplayable: rangeOf(0, 3),
    recoveredSec: rangeOf(0, 3600),
    knownLossSec: rangeOf(0, 5, 0.1),
    maxUnseenLossSec: rangeOf(0, 2, 0.1),
    fragmentIntervalSec: rangeOf(0.5, 4, 0.5),
    heartbeatIntervalSec: rangeOf(0.5, 4, 0.5),
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof RecoveryDialogStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recovery: Story = {};
export const NothingPlays: Story = { args: { playable: 0, unplayable: 1, recoveredSec: 0 } };
