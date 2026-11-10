import type { CallStatus, ParticipantStatus } from '@modules/capture-core';

export const participant = (identity: string, overrides: Partial<ParticipantStatus> = {}): ParticipantStatus => ({
  identity,
  joinedAt: '2026-11-10T09:17:40.000Z',
  quality: 'excellent',
  isSpeaking: false,
  microphone: 'live',
  camera: 'none',
  ...overrides,
});

export const noCall: CallStatus = {
  state: 'disconnected',
  reconnectCount: 0,
  isMuted: false,
  participants: [],
  quality: 'unknown',
  profile: 'standard',
};

export const inRoom = (participants: ParticipantStatus[] = [participant('interviewer')]): CallStatus => ({
  ...noCall,
  state: 'connected',
  room: 'mydirector-poc',
  identity: 'iphone',
  connectedAt: '2026-11-10T09:18:03.000Z',
  participants,
  quality: 'excellent',
});
