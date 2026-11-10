import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

import { rangeOf } from '@test/story-controls';

import { Icon } from '../icon';
import type { IconName } from '../icons';
import { TabBar, TabBarItem } from '../tab-bar';

const TABS: { title: string; icon: IconName }[] = [
  { title: 'Record', icon: 'ring' },
  { title: 'Recordings', icon: 'film' },
  { title: 'Debug', icon: 'activity' },
  { title: 'Settings', icon: 'sliders' },
];

function TabBarStory({
  selected,
  badge,
  badgeCount,
}: {
  selected: string;
  badge: 'none' | 'warning' | 'error';
  badgeCount: number;
}) {
  return (
    <View className="flex-1 justify-end">
      <TabBar bottomInset={0}>
        {TABS.map(({ title, icon }) => (
          <TabBarItem
            key={title}
            title={title}
            selected={title === selected}
            badge={
              title === 'Debug' && badge !== 'none'
                ? { count: badgeCount, severity: badge }
                : undefined
            }
            icon={
              <Icon
                name={icon}
                className="size-6.5"
                tint={title === selected ? 'accent-accent' : 'accent-muted'}
              />
            }
            onPress={() => {}}
          />
        ))}
      </TabBar>
    </View>
  );
}

const meta = {
  title: 'UI/Navigation/TabBar',
  component: TabBarStory,
  args: { selected: 'Record', badge: 'none', badgeCount: 1 },
  argTypes: {
    selected: { control: { type: 'select' }, options: TABS.map(({ title }) => title) },
    badge: { control: { type: 'radio' }, options: ['none', 'warning', 'error'] },
    badgeCount: rangeOf(1, 9),
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof TabBarStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FourTabs: Story = {};
export const Warning: Story = { args: { badge: 'warning' } };
export const Error: Story = { args: { badge: 'error', badgeCount: 2 } };
