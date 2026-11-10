import type { Meta, StoryObj } from '@storybook/react-native';

import { crashed, interview } from '@test/player-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { playerView, type Playback } from '../../player-view';
import { SegmentStrip } from '../segment-strip';

const RECORDINGS = { interview, crashed };
type Example = keyof typeof RECORDINGS;

function SegmentStripStory({
  example,
  current,
  elapsedSec,
  playback,
}: {
  example: Example;
  current: number;
  elapsedSec: number;
  playback: Playback;
}) {
  const view = playerView(RECORDINGS[example], { current, elapsedSec, playback });
  return (
    <SegmentStrip
      items={view.items}
      progress={view.progress}
      whole={view.whole}
      endsInCrash={view.endsInCrash}
      onSelect={() => {}}
    />
  );
}

const meta = {
  title: 'Features/Recordings/SegmentStrip',
  component: SegmentStripStory,
  args: { example: 'interview', current: 1, elapsedSec: 72, playback: 'playing' },
  argTypes: {
    example: selectOf<Example>(RECORDINGS),
    current: rangeOf(1, 3),
    elapsedSec: rangeOf(0, 240),
    playback: selectOf<Playback>({ playing: true, paused: true, ended: true }),
  },
} satisfies Meta<typeof SegmentStripStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstSegment: Story = {};
export const AfterPhoneCall: Story = { args: { current: 2, elapsedSec: 20 } };
export const Ended: Story = { args: { current: 3, elapsedSec: 152, playback: 'ended' } };
export const Recovered: Story = { args: { example: 'crashed', current: 2, elapsedSec: 140 } };
