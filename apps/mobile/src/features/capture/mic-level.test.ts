import { describe, expect, it } from '@jest/globals';

import { litBars, METER_BARS } from './mic-level';

describe('litBars', () => {
  it('lights nothing at the floor and every bar at full scale', () => {
    expect(litBars(-120)).toBe(0);
    expect(litBars(0)).toBe(METER_BARS);
  });

  it('rounds a partial bar up', () => expect(litBars(-30)).toBe(3));
});
