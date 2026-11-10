import type { RemoteTrack } from 'livekit-client';

import { download, fileStamp } from './downloads.ts';
import type { PhoneFeed } from './phone-feed.ts';

const BITS_PER_BYTE = 8;
const MS_PER_SECOND = 1000;
const LEVEL_DIGITS = 4;
const CSV_COLUMNS = [
  'at',
  'paused',
  'frameWidth',
  'frameHeight',
  'framesPerSecond',
  'framesDecoded',
  'freezeCount',
  'totalFreezesDuration',
  'videoPacketsLost',
  'videoJitter',
  'videoBytesReceived',
  'audioPacketsLost',
  'audioJitter',
  'audioLevel',
  'concealedSamples',
  'audioBytesReceived',
] as const;

type Column = (typeof CSV_COLUMNS)[number];
type Row = Partial<Record<Column, string | number>>;

interface InboundRtp {
  type: string;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  framesDecoded?: number;
  freezeCount?: number;
  totalFreezesDuration?: number;
  packetsLost?: number;
  jitter?: number;
  bytesReceived?: number;
  concealedSamples?: number;
}

export interface PhoneStats {
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  freezeCount?: number;
  totalFreezesDuration?: number;
  videoPacketsLost?: number;
  audioPacketsLost?: number;
  bitrate?: number;
}

interface ByteCount {
  bytes: number;
  at: number;
}

interface CsvSample {
  at: string;
  paused: boolean;
  level: number;
  video?: InboundRtp;
  audio?: InboundRtp;
}

export const bitsPerSecond = (from: ByteCount, to: ByteCount): number =>
  ((to.bytes - from.bytes) * BITS_PER_BYTE * MS_PER_SECOND) / (to.at - from.at);

export const phoneStats = (video?: InboundRtp, audio?: InboundRtp): PhoneStats => ({
  frameWidth: video?.frameWidth,
  frameHeight: video?.frameHeight,
  framesPerSecond: video?.framesPerSecond,
  freezeCount: video?.freezeCount,
  totalFreezesDuration: video?.totalFreezesDuration,
  videoPacketsLost: video?.packetsLost,
  audioPacketsLost: audio?.packetsLost,
});

export function csvRow({ at, paused, level, video, audio }: CsvSample): string {
  const row: Row = {
    at,
    paused: paused ? 1 : 0,
    ...phoneStats(video, audio),
    framesDecoded: video?.framesDecoded,
    videoJitter: video?.jitter,
    videoBytesReceived: video?.bytesReceived,
    audioJitter: audio?.jitter,
    audioLevel: level.toFixed(LEVEL_DIGITS),
    concealedSamples: audio?.concealedSamples,
    audioBytesReceived: audio?.bytesReceived,
  };
  return CSV_COLUMNS.map((column) => row[column] ?? '').join(',');
}

async function inboundOf(track: RemoteTrack | undefined): Promise<InboundRtp | undefined> {
  let inbound: InboundRtp | undefined;
  (await track?.getRTCStatsReport())?.forEach((report: InboundRtp) => {
    if (report.type === 'inbound-rtp') inbound = report;
  });
  return inbound;
}

export class StatsCollector {
  readonly #rows: string[] = [CSV_COLUMNS.join(',')];
  #latest: PhoneStats = {};
  #lastVideoBytes: ByteCount | undefined;

  get latest(): Readonly<PhoneStats> {
    return this.#latest;
  }

  get rowCount(): number {
    return this.#rows.length - 1;
  }

  /** `audioLevel` is what the page hears, since WebRTC reports 0 while the phone is muted on this Mac. */
  async collect(phone: PhoneFeed, appendCsvRow: boolean): Promise<void> {
    if (!phone.video && !phone.audio) return;
    const [video, audio] = await Promise.all([inboundOf(phone.video), inboundOf(phone.audio)]);
    this.#latest = { ...phoneStats(video, audio), bitrate: this.#bitrate(video?.bytesReceived) };
    if (!appendCsvRow) return;
    const at = new Date().toISOString();
    this.#rows.push(csvRow({ at, paused: phone.paused, level: phone.level, video, audio }));
  }

  download(): void {
    download(new Blob([this.#rows.join('\n')], { type: 'text/csv' }), `stats-${fileStamp()}.csv`);
  }

  #bitrate(bytes: number | undefined): number | undefined {
    const last = this.#lastVideoBytes;
    const now = bytes === undefined ? undefined : { bytes, at: performance.now() };
    this.#lastVideoBytes = now;
    return last && now && bitsPerSecond(last, now);
  }
}
