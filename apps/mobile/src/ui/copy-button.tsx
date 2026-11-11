import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from './icon';

const COPIED_MS = 2_000;

/** `copy` resolves to whether it put something on the clipboard and reports its own failures. */
export function CopyButton({ copy, label }: { copy: () => Promise<boolean>; label: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const press = async () => {
    setCopied(false);
    setBusy(true);
    const done = await copy();
    setBusy(false);
    if (!done) return;
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      hitSlop={8}
      onPress={() => void press()}
      className={busy ? 'opacity-40' : 'active:opacity-60'}
    >
      <Icon
        name={copied ? 'check' : 'copy'}
        className="size-3.5"
        tint={copied ? 'accent-success' : 'accent-muted'}
      />
    </Pressable>
  );
}
