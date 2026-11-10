import type { Meta, StoryObj } from '@storybook/react-native';

import type { CallConnectionState, CallQuality } from '@modules/capture-core';

import { QUALITY_LOOK } from '@features/capture/call-labels';
import { inRoom } from '@test/call-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { connectionView } from '../../room-labels';
import { ConnectionCard } from '../connection-card';

function ConnectionCardStory({
  state,
  reconnectCount,
  quality,
  canReconnect,
}: {
  state: CallConnectionState;
  reconnectCount: number;
  quality: CallQuality;
  canReconnect: boolean;
}) {
  return (
    <ConnectionCard
      view={connectionView({ ...inRoom(), state, reconnectCount, quality })}
      canReconnect={canReconnect}
      onReconnect={() => {}}
    />
  );
}

const meta = {
  title: 'Features/Room/ConnectionCard',
  component: ConnectionCardStory,
  args: { state: 'disconnected', reconnectCount: 0, quality: 'excellent', canReconnect: false },
  argTypes: {
    state: selectOf<CallConnectionState>({
      disconnected: true,
      connecting: true,
      connected: true,
      reconnecting: true,
    }),
    reconnectCount: rangeOf(0, 5),
    quality: selectOf(QUALITY_LOOK),
  },
} satisfies Meta<typeof ConnectionCardStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotJoined: Story = {};
export const Connected: Story = { args: { state: 'connected' } };
export const Reconnects: Story = {
  args: { state: 'reconnecting', reconnectCount: 2, canReconnect: true },
};
