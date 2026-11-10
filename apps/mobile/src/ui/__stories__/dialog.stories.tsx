import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

import { Button } from '../button';
import { Dialog } from '../dialog';
import { StatTile } from '../stat-tile';
import { Text } from '../text';

function DialogStory({
  title,
  recovered,
  lost,
  segments,
}: {
  title: string;
  recovered: string;
  lost: string;
  segments: string;
}) {
  return (
    <Dialog>
      <Text variant="headline" className="text-foreground">
        {title}
      </Text>
      <View className="flex-row gap-2">
        <StatTile label="Recovered" value={recovered} />
        <StatTile label="Lost" value={lost} />
        <StatTile label="Segments" value={segments} />
      </View>
      <View className="flex-row gap-2">
        <Button title="Play" variant="primary" className="flex-1" onPress={() => {}} />
        <Button title="Dismiss" variant="ghost" className="flex-1" onPress={() => {}} />
      </View>
    </Dialog>
  );
}

const meta = {
  title: 'UI/Feedback/Dialog',
  component: DialogStory,
  args: {
    title: 'Unfinished recording · Today 09:12',
    recovered: '4:12',
    lost: '0.4 to 1.4 s',
    segments: '2',
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof DialogStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithStats: Story = {};
export const LongLoss: Story = { args: { lost: '12.4 to 14.9 s' } };
