import type { Meta, StoryObj } from '@storybook/react-native';

import { Text } from '@ui/text';

import { RoomCard } from '../room-card';

function RoomCardStory({ text }: { text: string }) {
  return (
    <RoomCard>
      <Text variant="callout" className="text-foreground">
        {text}
      </Text>
    </RoomCard>
  );
}

const meta = {
  title: 'Features/Room/RoomCard',
  component: RoomCardStory,
  args: { text: 'A card of the Room sheet' },
} satisfies Meta<typeof RoomCardStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
