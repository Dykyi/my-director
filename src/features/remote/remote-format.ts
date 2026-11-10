import type { HealthSnapshot, LogEntry } from '@modules/capture-core';

import { formatBytes } from '../capture/format';

const TIME_START = 11;
const TIME_END = 23;

export function formatLogLine({ at, level, category, message, data }: LogEntry): string {
  const details = data ? Object.entries(data).map(([key, value]) => ` ${key}=${value}`).join('') : '';
  return `${at.slice(TIME_START, TIME_END)} ${level} ${category} ${message}${details}`;
}

export function formatHealthLine({ camera, file, audio, call, audioRoute, thermal, diskFreeBytes }: HealthSnapshot): string {
  return [
    `camera ${camera.fps.toFixed(1)} fps ${camera.width}x${camera.height}`,
    `file ${file.fps.toFixed(1)} fps ${file.writer} ${formatBytes(file.bytes)} dropped ${file.droppedFrames}`,
    `audio ${audio.levelDb.toFixed(0)} dB age ${audio.lastBufferAgeMs.toFixed(0)} ms drift ${audio.driftMs.toFixed(0)} ms resync ${audio.resyncCount}`,
    `call ${call.sentWidth}x${call.sentHeight} ${call.sentFps.toFixed(0)} fps ${call.bitrateKbps.toFixed(0)} kbps limit ${call.qualityLimitation}`,
    `route ${audioRoute.input} -> ${audioRoute.output}`,
    `thermal ${thermal} disk ${formatBytes(diskFreeBytes)}`,
  ].join(' | ');
}
