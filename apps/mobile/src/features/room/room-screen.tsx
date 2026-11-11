import { router } from 'expo-router';

import { lastCallTarget } from '@features/call/call-target';
import { roomName } from '@features/capture/call-labels';
import { useCaptureSession, useHealth } from '@features/capture/capture-session-context';
import { Button } from '@ui/button';
import { EmptyState } from '@ui/empty-state';
import { Sheet } from '@ui/sheet';

import { ConnectionCard } from './components/connection-card';
import { OwnCard, ParticipantCard } from './components/participant-card';
import { RoomNameCopy } from './components/room-name-copy';
import { RoomSection } from './components/room-section';
import {
  connectionView,
  ownHeading,
  ownIdentity,
  ownTracks,
  participantView,
  peopleHeading,
  roomOccupancy,
} from './room-labels';
import { usePhoneName } from './use-phone-name';

export function RoomScreen() {
  const { snapshot, config, actions } = useCaptureSession();
  const health = useHealth();
  const phone = usePhoneName();
  const lastTarget = lastCallTarget.use();
  const { call } = snapshot;
  const occupancy = roomOccupancy(call);
  const room = roomName(call, lastTarget?.room);
  return (
    <Sheet title="Room" subtitle={room} onClose={() => router.back()}>
      <ConnectionCard
        view={connectionView(call)}
        canReconnect={snapshot.sessionId !== undefined}
        onReconnect={actions.reconnectCall}
      />
      <RoomSection title={ownHeading(occupancy)}>
        <OwnCard
          name={phone.name}
          identity={ownIdentity(call, lastTarget?.identity)}
          tracks={ownTracks(call, config.call.profiles[call.profile], health?.call.bitrateKbps)}
          onRename={phone.rename}
        />
      </RoomSection>
      {occupancy === 'notJoined' ? (
        <Button
          title="Start recording and join"
          variant="record"
          size="large"
          icon="dot"
          onPress={actions.start}
        />
      ) : (
        <RoomSection title={peopleHeading(call)}>
          {occupancy === 'empty' ? (
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
