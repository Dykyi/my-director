import type { Meta, StoryObj } from '@storybook/react-native';

import { participant } from '@test/call-fixtures';
import { rangeOf } from '@test/story-controls';

import { participantView } from '../../room-labels';
import { ParticipantCard } from '../participant-card';
import { RoomSection } from '../room-section';

const PEOPLE = ['interviewer', 'producer', 'editor'];

function RoomSectionStory({ title, people }: { title: string; people: number }) {
  return (
    <RoomSection title={title}>
      {PEOPLE.slice(0, people).map((name, index) => (
        <ParticipantCard
          key={name}
          participant={participantView(participant(name))}
          index={index}
        />
      ))}
    </RoomSection>
  );
}

const meta = {
  title: 'Features/Room/RoomSection',
  component: RoomSectionStory,
  args: { title: 'IN THE ROOM · 2', people: 2 },
  argTypes: { people: rangeOf(0, PEOPLE.length) },
} satisfies Meta<typeof RoomSectionStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TwoPeople: Story = {};
