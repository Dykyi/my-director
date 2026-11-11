import type { Meta, StoryObj } from '@storybook/react-native';

import type { VerificationCheck } from '@modules/capture-core';

import { rangeOf } from '@test/story-controls';

import { VerificationReport } from '../verification-report';

const check = (
  label: string,
  actual: string,
  expected: string,
  pass = true,
): VerificationCheck => ({
  id: label,
  label,
  actual,
  expected,
  pass,
});
const CHECKS = [
  check('Plays', 'true', 'true'),
  check('Video codec', 'hvc1', 'hvc1 or avc1'),
  check('Frame rate', '30.00', '≥ 29.50'),
];
const LATE_AUDIO = check('Audio and video length', '598 ms', 'differ ≤ 100 ms', false);
const CRASH_TAIL: VerificationCheck = {
  ...check('Frame gaps', '0.02 %, longest 133 ms', '≤ 0.50 %, longest ≤ 100 ms'),
  crashTail: true,
  note: 'at the crash point: the app was closed here',
};

function VerificationReportStory({
  segments,
  failing,
  recovered,
  checking,
}: {
  segments: number;
  failing: boolean;
  recovered: boolean;
  checking: boolean;
}) {
  const items = Array.from({ length: segments }, (_, index) => {
    const last = index === segments - 1;
    const fails = failing && last;
    const checks = [...CHECKS];
    if (recovered && last) checks.push(CRASH_TAIL);
    if (fails) checks.push(LATE_AUDIO);
    return { index: index + 1, uri: `segment-00${index + 1}.mov`, checks, pass: !fails };
  });
  return (
    <VerificationReport
      report={
        checking
          ? null
          : {
              sessionId: '2026-11-10T09-12-33Z-4F2A',
              verifiedAt: '2026-11-10T09:30:00.000Z',
              segments: items,
              pass: !failing,
            }
      }
      onClose={() => {}}
    />
  );
}

const meta = {
  title: 'Features/Recordings/VerificationReport',
  component: VerificationReportStory,
  args: { segments: 1, failing: false, recovered: false, checking: false },
  argTypes: { segments: rangeOf(1, 4) },
  parameters: { backdrop: 'sheet', inset: 'none' },
} satisfies Meta<typeof VerificationReportStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pass: Story = {};
export const Fail: Story = { args: { segments: 2, failing: true } };
export const Recovered: Story = { args: { segments: 2, recovered: true } };
export const Checking: Story = { args: { checking: true } };
