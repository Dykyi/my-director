import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';

import type { CaptureConfig } from '@modules/capture-core';

import { ABOUT } from './about';

export function useCopySettings(config: CaptureConfig) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(JSON.stringify({ about: ABOUT, config }, null, 2));
    setCopied(true);
  };
  return { copied, copy };
}
