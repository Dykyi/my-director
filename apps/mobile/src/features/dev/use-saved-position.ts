import Storage from 'expo-sqlite/kv-store';
import { useEffect } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { snapToEdge, type Bounds, type Point } from './snap';

const POSITION_KEY = 'dev.storybook-button';

export function useSavedPosition(bounds: Bounds, x: SharedValue<number>, y: SharedValue<number>) {
  // The saved place goes through the snap again: the screen may have changed size.
  useEffect(() => {
    void Storage.getItem(POSITION_KEY).then((saved) => {
      if (!saved) return;
      const target = snapToEdge(JSON.parse(saved) as Point, bounds);
      x.set(target.x);
      y.set(target.y);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (target: Point) => void Storage.setItem(POSITION_KEY, JSON.stringify(target));
}
