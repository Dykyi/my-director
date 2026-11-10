import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type TrackPublication,
} from 'livekit-client';

import type { RoomAccess } from '../server/token-service.ts';

const PAUSE_REASON = 'pauseReason';

export interface RoomNames {
  room: string;
  identity: string;
  phone: string;
}

export interface RoomListener {
  phoneTrack(track: RemoteTrack, muted: boolean): void;
  phoneTrackEnded(track: RemoteTrack): void;
  phonePaused(): void;
  phoneResumed(): void;
  phoneLeft(): void;
  changed(): void;
  left(): void;
  log(message: string): void;
}

export class RoomSession {
  readonly names: RoomNames;
  readonly #room: Room;
  #reconnecting = false;

  private constructor(room: Room, names: RoomNames, listener: RoomListener) {
    this.#room = room;
    this.names = names;
    this.#listen(listener);
  }

  static async join(
    access: RoomAccess,
    names: RoomNames,
    sent: MediaStream,
    listener: RoomListener,
  ): Promise<RoomSession> {
    const room = new Room({ adaptiveStream: false, dynacast: false });
    const session = new RoomSession(room, names, listener);
    try {
      await room.connect(access.url, access.token);
      for (const track of sent.getAudioTracks()) {
        await room.localParticipant.publishTrack(track, {
          name: 'interviewer-voice',
          source: Track.Source.Microphone,
        });
      }
    } catch (error) {
      await room.disconnect();
      throw error;
    }
    return session;
  }

  get reconnecting(): boolean {
    return this.#reconnecting;
  }

  get quality(): ConnectionQuality {
    return this.#phone?.connectionQuality ?? ConnectionQuality.Unknown;
  }

  get pauseReason(): string {
    return this.#phone?.attributes[PAUSE_REASON] ?? '';
  }

  leave(): Promise<void> {
    return this.#room.disconnect();
  }

  get #phone(): RemoteParticipant | undefined {
    return this.#room.remoteParticipants.get(this.names.phone);
  }

  #isPhone(participant: Participant): boolean {
    return participant.identity === this.names.phone;
  }

  #isPhoneVideo(publication: TrackPublication, participant: Participant): boolean {
    return this.#isPhone(participant) && publication.kind === Track.Kind.Video;
  }

  #listen(listener: RoomListener): void {
    this.#room
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (this.#isPhone(participant)) listener.phoneTrack(track, publication.isMuted);
        else listener.log(`${participant.identity} sends ${track.kind}`);
      })
      .on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        if (this.#isPhone(participant)) listener.phoneTrackEnded(track);
      })
      .on(RoomEvent.TrackMuted, (publication, participant) => {
        if (this.#isPhoneVideo(publication, participant)) listener.phonePaused();
      })
      .on(RoomEvent.TrackUnmuted, (publication, participant) => {
        if (this.#isPhoneVideo(publication, participant)) listener.phoneResumed();
      })
      .on(RoomEvent.ParticipantAttributesChanged, () => listener.changed())
      .on(RoomEvent.ConnectionQualityChanged, () => listener.changed())
      .on(RoomEvent.ParticipantConnected, (participant) =>
        listener.log(`${participant.identity} joined`),
      )
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        listener.log(`${participant.identity} left`);
        if (this.#isPhone(participant)) listener.phoneLeft();
      })
      .on(RoomEvent.Reconnecting, () => this.#setReconnecting(true, listener))
      .on(RoomEvent.Reconnected, () => this.#setReconnecting(false, listener))
      .on(RoomEvent.Disconnected, () => listener.left());
  }

  #setReconnecting(reconnecting: boolean, listener: RoomListener): void {
    this.#reconnecting = reconnecting;
    listener.log(reconnecting ? 'Reconnecting' : 'Reconnected');
    listener.changed();
  }
}
