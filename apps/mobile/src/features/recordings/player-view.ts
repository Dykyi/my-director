import type {
  PauseReason,
  RecordingSummary,
  RecoveryReport,
  SegmentState,
  SegmentSummary,
} from '@modules/capture-core';

import { PAUSE_REASON } from '@features/capture/session-labels';
import { formatBytes, formatDuration, formatLoss } from '@shared/format';
import type { ChipView } from '@ui/tone';

import { isCompleteSegment, segmentFileName } from './recording-labels';

export type SegmentItem = {
  index: number;
  title: string;
  meta: string;
  durationSec: number;
  current: boolean;
  playable: boolean;
  recovered: boolean;
  chip?: ChipView;
  pauseAfter?: PauseReason;
  note?: string;
};

export type Playback = 'playing' | 'paused' | 'ended';

export type PlayerPosition = { current: number; elapsedSec: number; playback: Playback };

export type PlayerView = {
  title: string;
  file: string;
  startedAfter: string;
  overallTime: string;
  progress: number;
  previous?: number;
  next?: number;
  endsInCrash: boolean;
  items: SegmentItem[];
};

const OTHER_CHIP: Partial<Record<SegmentState, SegmentItem['chip']>> = {
  recovered: { label: 'recovered', tone: 'paused' },
  unplayable: { label: 'could not be opened', tone: 'danger' },
  writing: { label: 'recording', tone: 'recording' },
};

function segmentChip(
  state: SegmentState,
  current: boolean,
  playback: Playback,
): SegmentItem['chip'] {
  if (!current) return OTHER_CHIP[state];
  if (state === 'recovered') return { label: `recovered · ${playback}`, tone: 'paused' };
  return { label: playback, tone: playback === 'playing' ? 'accent' : 'neutral' };
}

function crashNote(report: RecoveryReport | undefined): string {
  const closed = 'The app was closed here.';
  if (!report || (report.knownLossSec === 0 && report.maxUnseenLossSec === 0)) return closed;
  return `${closed} Lost ${formatLoss(report)} at the end.`;
}

export function nextPlayable(segments: SegmentSummary[], index: number): number | undefined {
  return segments.find((segment) => segment.index > index && isCompleteSegment(segment))?.index;
}

function previousPlayable(segments: SegmentSummary[], index: number): number | undefined {
  return segments.findLast((segment) => segment.index < index && isCompleteSegment(segment))?.index;
}

export function startingSegment(segments: SegmentSummary[], requested: number): number | undefined {
  const asked = segments.find((segment) => segment.index === requested);
  return asked && isCompleteSegment(asked) ? asked.index : segments.find(isCompleteSegment)?.index;
}

export function playerView(
  { segments, totalSec }: RecordingSummary,
  { current, elapsedSec, playback }: PlayerPosition,
  report?: RecoveryReport,
): PlayerView {
  const place = segments.findIndex((segment) => segment.index === current);
  const playing = segments[place];
  const before = segments[place - 1];
  const doneBefore = segments
    .slice(0, Math.max(place, 0))
    .reduce((sum, segment) => sum + segment.durationSec, 0);
  const durationSec = playing?.durationSec ?? 0;
  const items = segments.map((segment, order): SegmentItem => {
    const isCurrent = segment.index === current;
    const recovered = segment.state === 'recovered';
    return {
      index: segment.index,
      title: `Segment ${segment.index}`,
      meta: `${formatDuration(segment.durationSec)} · ${formatBytes(segment.bytes)}`,
      durationSec: segment.durationSec,
      current: isCurrent,
      playable: isCompleteSegment(segment),
      recovered,
      chip: segmentChip(segment.state, isCurrent, playback),
      pauseAfter: order < segments.length - 1 ? segment.pauseReason : undefined,
      note: recovered ? crashNote(report) : undefined,
    };
  });
  return {
    title: `Segment ${current} of ${segments.length}`,
    file: playing ? `${segmentFileName(playing.uri)} · ${formatDuration(durationSec)}` : '',
    startedAfter: !before
      ? 'Start of the recording'
      : `Starts ${before.pauseReason ? PAUSE_REASON[before.pauseReason].after : 'after a pause'}`,
    overallTime: `${formatDuration(doneBefore + elapsedSec)} of ${formatDuration(totalSec)}`,
    progress: durationSec > 0 ? Math.min(elapsedSec / durationSec, 1) : 0,
    previous: previousPlayable(segments, current),
    next: nextPlayable(segments, current),
    endsInCrash: segments.at(-1)?.state === 'recovered',
    items,
  };
}

export function playerTarget(
  recordings: RecordingSummary[],
  reports: RecoveryReport[],
  sessionId: string,
  segment: string | undefined,
) {
  const recording = recordings.find((candidate) => candidate.sessionId === sessionId);
  const start = recording && startingSegment(recording.segments, Number(segment));
  if (!recording || start === undefined) return undefined;
  return { recording, start, report: reports.find((report) => report.sessionId === sessionId) };
}
