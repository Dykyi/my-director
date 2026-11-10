import type {
  CaptureConfig,
  RecordingState,
  RecordingSummary,
  SegmentState,
  SegmentSummary,
} from '@modules/capture-core';

import type { UploadStatus } from '@features/upload/upload-plan';
import { formatBytes, formatDuration, plural } from '@shared/format';
import type { ChipTone } from '@ui/tone';

export type CardAction = 'play' | 'verify' | 'upload' | 'cancel' | 'delete';

export const PLAYABLE: ReadonlySet<SegmentState> = new Set(['finalized', 'recovered']);

const STATE_TONE: Record<RecordingState, ChipTone> = {
  recording: 'recording',
  paused: 'paused',
  recovered: 'paused',
  finished: 'success',
};

export function recordingChip(
  { state }: RecordingSummary,
  { uploading, verified, pending }: UploadStatus,
): { label: string; tone: ChipTone } {
  if (uploading) return { label: 'uploading', tone: 'accent' };
  if (verified && pending.length === 0) return { label: 'uploaded', tone: 'success' };
  return { label: state, tone: STATE_TONE[state] };
}

export const recordingMeta = ({ totalSec, segments, totalBytes }: RecordingSummary) =>
  `${formatDuration(totalSec)} · ${segments.length} seg · ${formatBytes(totalBytes)}`;

export const fileName = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

export const segmentLine = ({ uri, durationSec, bytes }: SegmentSummary) =>
  `${fileName(uri)} ${formatDuration(durationSec)} ${formatBytes(bytes)}`;

export function recoveredNote({ segments }: RecordingSummary): string {
  const playable = segments.filter((segment) => PLAYABLE.has(segment.state)).length;
  return `Recovered after the app was closed. Playable segments: ${playable} of ${segments.length}.`;
}

export function cardActions({ uploading, pending }: UploadStatus, isActive: boolean): CardAction[] {
  if (uploading) return ['play', 'verify', 'cancel'];
  const upload: CardAction[] = pending.length > 0 ? ['upload'] : [];
  return isActive ? ['play', 'verify', ...upload] : ['play', 'verify', ...upload, 'delete'];
}

export function deleteMessage(
  { segments, totalBytes }: RecordingSummary,
  uploaded: number,
): string {
  const local = `${plural(segments.length, 'segment')}, ${formatBytes(totalBytes)} will be removed from the phone.`;
  return uploaded > 0 ? `${local} Uploaded to the bucket: ${plural(uploaded, 'segment')}.` : local;
}

export function lossNote({
  recording,
  session,
}: {
  recording: Pick<CaptureConfig['recording'], 'fragmentIntervalSec'>;
  session: Pick<CaptureConfig['session'], 'heartbeatIntervalSec'>;
}): string {
  return `Video reaches the disk every ${recording.fragmentIntervalSec} s and the progress note every ${session.heartbeatIntervalSec} s, so a crash loses only the tail after the last save.`;
}
