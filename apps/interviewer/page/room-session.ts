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
import { displayName, isPhoneIdentity } from './phone-identity.ts';

/** Set by the phone before it mutes (CallPublisher.swift). */
const PAUSE_REASON = 'pauseReason';
/** The voice track belongs to the page's audio bus; the next Join sends and records it again. */
const STOP_TRACKS_ON_LEAVE = false;

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
  #followed: RemoteParticipant | undefined;
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
    room = new Room({ adaptiveStream: false, dynacast: false }),
  ): Promise<RoomSession> {
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
      await room.disconnect(STOP_TRACKS_ON_LEAVE);
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

  get phoneName(): string | undefined {
    const phone = this.#phone;
    return phone && displayName(phone);
  }

  get pauseReason(): string {
    return this.#phone?.attributes[PAUSE_REASON] ?? '';
  }

  /** A phone that rejoins on pause shares why but publishes nothing until Resume (CallPublisher.swift). */
  get phonePausedWithoutVideo(): boolean {
    const phone = this.#phone;
    return Boolean(phone?.attributes[PAUSE_REASON]) && phone?.videoTrackPublications.size === 0;
  }

  leave(): Promise<void> {
    return this.#room.disconnect(STOP_TRACKS_ON_LEAVE);
  }

  // The first phone by join order, kept until its own leave event: LiveKit drops
  // a leaving participant from the room before it sends that participant's last events.
  get #phone(): RemoteParticipant | undefined {
    this.#followed ??= [...this.#room.remoteParticipants.values()].find((participant) =>
      this.#hasPhoneIdentity(participant),
    );
    return this.#followed;
  }

  #hasPhoneIdentity(participant: Participant): boolean {
    return isPhoneIdentity(participant.identity, this.names.phone);
  }

  #isPhone(participant: Participant): boolean {
    return participant === this.#phone;
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
      .on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
        this.#followPauseWithoutVideo(participant, listener);
        listener.changed();
      })
      .on(RoomEvent.ParticipantNameChanged, (name, participant) => {
        if (!this.#isPhone(participant)) return;
        listener.log(`The phone is now named ${name}`);
        listener.changed();
      })
      .on(RoomEvent.ConnectionQualityChanged, () => listener.changed())
      .on(RoomEvent.ParticipantConnected, (participant) => {
        if (this.#hasPhoneIdentity(participant) && !this.#isPhone(participant)) {
          const name = `${displayName(participant)} (${participant.identity})`;
          listener.log(`Another phone joined: ${name}, following the first`);
        } else listener.log(`${participant.identity} joined`);
        this.#followPauseWithoutVideo(participant, listener);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        listener.log(`${participant.identity} left`);
        if (!this.#isPhone(participant)) return;
        this.#followed = undefined;
        listener.phoneLeft();
        this.#followNext(listener);
      })
      .on(RoomEvent.Reconnecting, () => this.#setReconnecting(true, listener))
      .on(RoomEvent.Reconnected, () => this.#setReconnecting(false, listener))
      .on(RoomEvent.Disconnected, () => listener.left());
  }

  // A phone already in the room sent its tracks while another one was followed.
  #followNext(listener: RoomListener): void {
    const phone = this.#phone;
    if (!phone) return;
    listener.log(`Now following ${displayName(phone)} (${phone.identity})`);
    for (const { track, isMuted } of phone.trackPublications.values())
      if (track) listener.phoneTrack(track, isMuted);
    this.#followPauseWithoutVideo(phone, listener);
  }

  #followPauseWithoutVideo(participant: Participant, listener: RoomListener): void {
    if (this.#isPhone(participant) && this.phonePausedWithoutVideo) listener.phonePaused();
  }

  #setReconnecting(reconnecting: boolean, listener: RoomListener): void {
    this.#reconnecting = reconnecting;
    listener.log(reconnecting ? 'Reconnecting' : 'Reconnected');
    listener.changed();
  }
}
