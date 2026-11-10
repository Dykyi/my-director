import { describe, expect, it } from '@jest/globals';

import { defaultPosition, snapToEdge } from './snap';

const bounds = { width: 400, height: 800, top: 40, bottom: 20, margin: 16, size: 48 };

describe('snapToEdge', () => {
  it('sticks to the right edge from the right half', () =>
    expect(snapToEdge({ x: 250, y: 300 }, bounds)).toEqual({ x: 336, y: 300 }));
  it('sticks to the left edge from the left half', () =>
    expect(snapToEdge({ x: 100, y: 300 }, bounds)).toEqual({ x: 16, y: 300 }));
  it('keeps the button inside the safe area vertically', () => {
    expect(snapToEdge({ x: 300, y: -50 }, bounds).y).toBe(56);
    expect(snapToEdge({ x: 300, y: 900 }, bounds).y).toBe(716);
  });
});

describe('defaultPosition', () => {
  it('starts above the tab bar at the right', () =>
    expect(defaultPosition(bounds, 90)).toEqual({ x: 336, y: 626 }));
});
