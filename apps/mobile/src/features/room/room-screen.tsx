import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { View } from 'react-native';

import { callTarget } from '@config/env';
import { useSession } from '@features/capture/capture-session-context';
import { Button } from '@ui/button';
import { EmptyState } from '@ui/empty-state';
import { Sheet } from '@ui/sheet';
import { Text } from '@ui/text';

import { ConnectionCard } from './components/connection-card';
import { OwnCard, ParticipantCard } from './components/participant-card';
import { RoomSection } from './components/room-section';
import {
  connectionView,
  ownHeading,
  ownTracks,
  participantView,
  peopleHeading,
  roomView,
} from './room-labels';

function RoomNameCopy({ room }: { room: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="rounded-tag border border-border border-continuous bg-surface px-3 py-2">
        <Text selectable variant="mono-body" className="text-foreground">
          {room}
        </Text>
      </View>
      <Button title="Copy" size="compact" onPress={() => void Clipboard.setStringAsync(room)} />
    </View>
  );
}

export function RoomScreen() {
  const { snapshot, health, config, actions } = useSession();
  const { call } = snapshot;
  const view = roomView(call);
  const room = call.room ?? callTarget.room ?? '';
  return (
    <Sheet title="Room" subtitle={room} onClose={() => router.back()}>
      <ConnectionCard
        view={connectionView(call)}
        canReconnect={snapshot.sessionId !== undefined}
        onReconnect={actions.reconnectCall}
      />
      <RoomSection title={ownHeading(view)}>
        <OwnCard
          identity={call.identity ?? callTarget.identity ?? 'this phone'}
          tracks={ownTracks(call, config.call.profiles[call.profile], health?.call.bitrateKbps)}
        />
      </RoomSection>
      {view === 'notJoined' ? (
        <Button
          title="Start recording and join"
          variant="record"
          size="large"
          icon="dot"
          onPress={actions.start}
        />
      ) : (
        <RoomSection title={peopleHeading(call)}>
          {view === 'empty' ? (
            <EmptyState
              icon="users"
              title="Nobody else in the room yet"
              text="The recording runs anyway. Send the interviewer the room name to join:"
            >
              <RoomNameCopy room={room} />
            </EmptyState>
          ) : (
            call.participants.map((participant, index) => (
              <ParticipantCard
                key={participant.identity}
                participant={participantView(participant)}
                index={index}
              />
            ))
          )}
        </RoomSection>
      )}
    </Sheet>
  );
}
