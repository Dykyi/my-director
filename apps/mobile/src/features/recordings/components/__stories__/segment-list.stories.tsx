import type { Meta, StoryObj } from '@storybook/react-native';

import { crashed, interview } from '@test/player-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { playerView, type Playback } from '../../player-view';
import { SegmentList } from '../segment-list';

const RECORDINGS = { interview, crashed };
type Example = keyof typeof RECORDINGS;

function SegmentListStory({
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
  return <SegmentList items={view.items} onSelect={() => {}} />;
}

const meta = {
  title: 'Features/Recordings/SegmentList',
  component: SegmentListStory,
  args: { example: 'interview', current: 1, elapsedSec: 72, playback: 'playing' },
  argTypes: {
    example: selectOf<Example>(RECORDINGS),
    current: rangeOf(1, 3),
    elapsedSec: rangeOf(0, 240),
    playback: selectOf<Playback>({ playing: true, paused: true, ended: true }),
  },
} satisfies Meta<typeof SegmentListStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstSegment: Story = {};
export const AfterPhoneCall: Story = { args: { current: 2, elapsedSec: 20 } };
export const Ended: Story = { args: { current: 3, elapsedSec: 152, playback: 'ended' } };
export const Recovered: Story = { args: { example: 'crashed', current: 2, elapsedSec: 140 } };
