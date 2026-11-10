import type { RemoteTrack } from 'livekit-client';

import { download, stamp } from './files.ts';
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
  #lastVideoBytes: { bytes: number; at: number } | undefined;

  get latest(): Readonly<PhoneStats> {
    return this.#latest;
  }

  get rowCount(): number {
    return this.#rows.length - 1;
  }

  async collect(phone: PhoneFeed, keepRow: boolean): Promise<void> {
    if (!phone.video && !phone.audio) return;
    const [video, audio] = await Promise.all([inboundOf(phone.video), inboundOf(phone.audio)]);
    this.#latest = {
      frameWidth: video?.frameWidth,
      frameHeight: video?.frameHeight,
      framesPerSecond: video?.framesPerSecond,
      freezeCount: video?.freezeCount,
      totalFreezesDuration: video?.totalFreezesDuration,
      videoPacketsLost: video?.packetsLost,
      audioPacketsLost: audio?.packetsLost,
      bitrate: this.#bitrate(video?.bytesReceived),
    };
    if (!keepRow) return;
    const row: Row = {
      at: new Date().toISOString(),
      paused: phone.paused ? 1 : 0,
      frameWidth: video?.frameWidth,
      frameHeight: video?.frameHeight,
      framesPerSecond: video?.framesPerSecond,
      framesDecoded: video?.framesDecoded,
      freezeCount: video?.freezeCount,
      totalFreezesDuration: video?.totalFreezesDuration,
      videoPacketsLost: video?.packetsLost,
      videoJitter: video?.jitter,
      videoBytesReceived: video?.bytesReceived,
      audioPacketsLost: audio?.packetsLost,
      audioJitter: audio?.jitter,
      audioLevel: phone.level.toFixed(LEVEL_DIGITS),
      concealedSamples: audio?.concealedSamples,
      audioBytesReceived: audio?.bytesReceived,
    };
    this.#rows.push(CSV_COLUMNS.map((column) => row[column] ?? '').join(','));
  }

  download(): void {
    download(new Blob([this.#rows.join('\n')], { type: 'text/csv' }), `stats-${stamp()}.csv`);
  }

  #bitrate(bytes: number | undefined): number | undefined {
    const at = performance.now();
    const last = this.#lastVideoBytes;
    this.#lastVideoBytes = bytes === undefined ? undefined : { bytes, at };
    if (!last || bytes === undefined) return undefined;
    return ((bytes - last.bytes) * BITS_PER_BYTE * MS_PER_SECOND) / (at - last.at);
  }
}
