import type { Meta, StoryObj } from '@storybook/react-native';

import { sampleLogs } from '@test/session-fixtures';
import { rangeOf } from '@test/story-controls';

import { EventLog } from '../event-log';

function EventLogStory({
  entries,
  badge,
  badgeCount,
}: {
  entries: number;
  badge: 'none' | 'warning' | 'error';
  badgeCount: number;
}) {
  return (
    <EventLog
      entries={sampleLogs.slice(0, entries)}
      badge={badge === 'none' ? undefined : { count: badgeCount, severity: badge }}
    />
  );
}

const meta = {
  title: 'Features/Debug/EventLog',
  component: EventLogStory,
  args: { entries: sampleLogs.length, badge: 'warning', badgeCount: 1 },
  argTypes: {
    entries: rangeOf(0, sampleLogs.length),
    badge: { control: { type: 'radio' }, options: ['none', 'warning', 'error'] },
    badgeCount: rangeOf(1, 9),
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof EventLogStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithWarning: Story = {};
export const Empty: Story = { args: { entries: 0, badge: 'none' } };
