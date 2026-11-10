import type { CallQuality, CallStatus, HealthSnapshot } from '@modules/capture-core';

import { formatResolution } from '@shared/format';
import { KBIT_PER_MBIT } from '@shared/units';
import type { ChipView } from '@ui/tone';

export type QualityLook = ChipView & { lit: number };

export const QUALITY_LOOK: Record<CallQuality, QualityLook> = {
  excellent: { label: 'excellent', tone: 'success', lit: 3 },
  good: { label: 'good', tone: 'accent', lit: 2 },
  poor: { label: 'poor', tone: 'paused', lit: 1 },
  lost: { label: 'lost', tone: 'danger', lit: 0 },
  unknown: { label: 'measuring', tone: 'neutral', lit: 0 },
};

export const formatMbps = (kbps: number) => `${(kbps / KBIT_PER_MBIT).toFixed(1)} Mbps`;

export function sendingText({
  sentWidth,
  sentHeight,
  sentFps,
  bitrateKbps,
}: HealthSnapshot['call']): string | undefined {
  if (sentWidth === 0) return undefined;
  return `${formatResolution(sentWidth, sentHeight)} ${sentFps.toFixed(0)} fps ${formatMbps(bitrateKbps)}`;
}

export function participantNames({ participants }: CallStatus): string[] {
  return participants.map((participant) => participant.identity);
}

export const roomName = (call: CallStatus, fallback: string | undefined) =>
  call.room ?? fallback ?? '';
