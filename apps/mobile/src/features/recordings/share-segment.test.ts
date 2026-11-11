import { describe, expect, it, jest } from '@jest/globals';
import { Share } from 'react-native';

import { shareSegment } from './share-segment';

const URI = 'file:///var/mobile/Documents/Recordings/2026-11-11T13-57-16Z-E615/segment-001.mov';

describe('shareSegment', () => {
  it("opens the share sheet on the segment's own file on the phone", async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await shareSegment(URI);
    expect(share).toHaveBeenCalledWith({ url: URI });
  });
});
