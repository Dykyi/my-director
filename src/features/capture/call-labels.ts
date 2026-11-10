import type { CallQuality, HealthSnapshot } from '@modules/capture-core';

export type ChipTone = 'neutral' | 'recording' | 'paused' | 'accent' | 'success' | 'danger';
export type QualityLook = { label: string; tone: ChipTone; lit: number };

const KBPS_PER_MBPS = 1_000;

export const QUALITY_LOOK: Record<CallQuality, QualityLook> = {
  excellent: { label: 'excellent', tone: 'success', lit: 3 },
  good: { label: 'good', tone: 'accent', lit: 2 },
  poor: { label: 'poor', tone: 'paused', lit: 1 },
  lost: { label: 'lost', tone: 'danger', lit: 0 },
  unknown: { label: 'measuring', tone: 'neutral', lit: 0 },
};

export const mbps = (kbps: number) => `${(kbps / KBPS_PER_MBPS).toFixed(1)} Mbps`;

export function sendingText({
  sentWidth,
  sentHeight,
  sentFps,
  bitrateKbps,
}: HealthSnapshot['call']): string | undefined {
  if (sentWidth === 0) return undefined;
  return `${sentWidth}×${sentHeight} ${sentFps.toFixed(0)} fps ${mbps(bitrateKbps)}`;
}
