import { useEventListener } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { useState } from 'react';

import type { SegmentSummary } from '@modules/capture-core';

import { nextPlayable, type Playback, type PlayerPosition } from './player-view';

const PROGRESS_INTERVAL_SEC = 0.25;

export function useSegmentPlayer(segments: SegmentSummary[], start: number) {
  const [current, setCurrent] = useState(start);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [playback, setPlayback] = useState<Playback>('playing');
  const uri = segments.find((segment) => segment.index === current)?.uri ?? null;
  // A new source makes a new player, which starts on its own.
  const player = useVideoPlayer(uri, (instance) => {
    instance.timeUpdateEventInterval = PROGRESS_INTERVAL_SEC;
    instance.play();
  });

  const select = (index: number) => {
    setCurrent(index);
    setElapsedSec(0);
    setPlayback('playing');
  };
  useEventListener(player, 'timeUpdate', ({ currentTime }) => setElapsedSec(currentTime));
  // The stop at the end comes with or without playToEnd before it, so a stop never undoes `ended`.
  useEventListener(player, 'playingChange', ({ isPlaying }) =>
    setPlayback((was) => (isPlaying ? 'playing' : was === 'ended' ? 'ended' : 'paused')),
  );
  useEventListener(player, 'playToEnd', () => {
    const next = nextPlayable(segments, current);
    if (next === undefined) setPlayback('ended');
    else select(next);
  });

  const position: PlayerPosition = { current, elapsedSec, playback };
  return { player, position, select };
}
