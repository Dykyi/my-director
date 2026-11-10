import type { CallStatus, HealthSnapshot } from '@modules/capture-core';

import { formatBytes } from '../capture/format';

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

export function formatRoomLine({ room, participants }: CallStatus): string {
  if (room === undefined) return 'room not joined';
  const people = participants.map(
    ({ identity, quality, microphone, camera, isSpeaking }) =>
      `${identity} ${quality} mic ${microphone} camera ${camera}${isSpeaking ? ' speaking' : ''}`,
  );
  return `room ${room} | ${people.length > 0 ? people.join(' | ') : 'nobody else'}`;
}
