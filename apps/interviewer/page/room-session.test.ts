import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { RoomEvent, type Room } from 'livekit-client';

import { RoomSession, type RoomListener } from './room-session.ts';

const NAMES = { room: 'mydirector-poc', identity: 'interviewer', phone: 'iphone' };
const ACCESS = { url: 'wss://example.livekit.cloud', token: 'token' };
const NOTHING_SENT = { getAudioTracks: () => [] } as unknown as MediaStream;

class FakeTrack {
  readonly kind = 'audio';
  readyState: MediaStreamTrackState = 'live';
  stop(): void {
    this.readyState = 'ended';
  }
}

class FakeRoom extends EventEmitter {
  readonly remoteParticipants = new Map<string, FakeParticipant>();
  readonly #published: FakeTrack[] = [];
  readonly localParticipant = {
    publishTrack: async (track: FakeTrack) => {
      this.#published.push(track);
    },
  };
  async connect(): Promise<void> {}
  // Like LiveKit, a disconnect stops the published local tracks unless told not to.
  async disconnect(stopTracks = true): Promise<void> {
    if (stopTracks) this.#published.forEach((track) => track.stop());
  }
}

interface FakePublication {
  kind: string;
  isMuted: boolean;
  track: { kind: string } | undefined;
}

class FakeParticipant {
  readonly identity: string;
  readonly name: string;
  readonly attributes: Record<string, string>;
  readonly trackPublications = new Map<string, FakePublication>();
  connectionQuality = 'excellent';

  constructor(identity: string, name: string, attributes: Record<string, string> = {}) {
    this.identity = identity;
    this.name = name;
    this.attributes = attributes;
  }

  get videoTrackPublications(): Map<string, FakePublication> {
    return new Map([...this.trackPublications].filter(([, { kind }]) => kind === 'video'));
  }

  publish(kind: string, isMuted = false): FakePublication {
    const publication = { kind, isMuted, track: { kind } };
    this.trackPublications.set(kind, publication);
    return publication;
  }
}

const recordingListener = (events: string[]): RoomListener => ({
  phoneTrack: (track, muted) => events.push(`phoneTrack ${track.kind} muted=${muted}`),
  phoneTrackEnded: (track) => events.push(`phoneTrackEnded ${track.kind}`),
  phonePaused: () => events.push('phonePaused'),
  phoneResumed: () => events.push('phoneResumed'),
  phoneLeft: () => events.push('phoneLeft'),
  changed: () => events.push('changed'),
  left: () => events.push('left'),
  log: (message) => events.push(message),
});

async function setUp(...participants: FakeParticipant[]) {
  const room = new FakeRoom();
  for (const participant of participants)
    room.remoteParticipants.set(participant.identity, participant);
  const events: string[] = [];
  const session = await RoomSession.join(
    ACCESS,
    NAMES,
    NOTHING_SENT,
    recordingListener(events),
    room as unknown as Room,
  );
  const leave = (participant: FakeParticipant) => {
    room.remoteParticipants.delete(participant.identity);
    room.emit(RoomEvent.ParticipantDisconnected, participant);
  };
  return { room, session, events, leave };
}

describe('RoomSession', () => {
  it('follows the first phone and only logs a second one', async () => {
    const first = new FakeParticipant('iphone-AAAA', 'Studio phone');
    const { room, session, events } = await setUp(first);
    const second = new FakeParticipant('iphone-BBBB', 'Spare');
    room.remoteParticipants.set(second.identity, second);
    room.emit(RoomEvent.ParticipantConnected, second);
    const video = second.publish('video');
    room.emit(RoomEvent.TrackSubscribed, video.track, video, second);
    assert.equal(session.phoneName, 'Studio phone');
    assert.deepEqual(events, [
      'Another phone joined: Spare (iphone-BBBB), following the first',
      'iphone-BBBB sends video',
    ]);
  });

  it('shows a new name of the phone at once', async () => {
    const phone = new FakeParticipant('iphone-AAAA', 'Studio phone');
    const { room, events } = await setUp(phone);
    room.emit(RoomEvent.ParticipantNameChanged, 'Desk', phone);
    assert.deepEqual(events, ['The phone is now named Desk', 'changed']);
  });

  it('hands over the tracks of the next phone when the followed one leaves', async () => {
    const first = new FakeParticipant('iphone-AAAA', 'Studio phone');
    const second = new FakeParticipant('iphone-BBBB', 'Spare');
    second.publish('video');
    second.publish('audio', true);
    const { session, events, leave } = await setUp(first, second);
    assert.equal(session.phoneName, 'Studio phone');
    leave(first);
    assert.equal(session.phoneName, 'Spare');
    assert.deepEqual(events, [
      'iphone-AAAA left',
      'phoneLeft',
      'Now following Spare (iphone-BBBB)',
      'phoneTrack video muted=false',
      'phoneTrack audio muted=true',
    ]);
  });

  it('hands over a next phone that paused without a picture as paused', async () => {
    const first = new FakeParticipant('iphone-AAAA', 'Studio phone');
    const second = new FakeParticipant('iphone-BBBB', 'Spare', { pauseReason: 'user' });
    const { session, events, leave } = await setUp(first, second);
    assert.equal(session.phoneName, 'Studio phone');
    leave(first);
    assert.deepEqual(events.slice(-2), ['Now following Spare (iphone-BBBB)', 'phonePaused']);
  });

  it('keeps the voice track live after Leave, so the next Join can send and record it', async () => {
    const voice = new FakeTrack();
    const sent = { getAudioTracks: () => [voice] } as unknown as MediaStream;
    const room = new FakeRoom() as unknown as Room;
    const session = await RoomSession.join(ACCESS, NAMES, sent, recordingListener([]), room);
    await session.leave();
    assert.equal(voice.readyState, 'live');
  });
});
