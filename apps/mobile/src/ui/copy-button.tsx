import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from './icon';

const COPIED_MS = 2_000;

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      hitSlop={8}
      onPress={() => void copy()}
      className="active:opacity-60"
    >
      <Icon
        name={copied ? 'check' : 'copy'}
        className="size-3.5"
        tint={copied ? 'accent-success' : 'accent-muted'}
      />
    </Pressable>
  );
}
